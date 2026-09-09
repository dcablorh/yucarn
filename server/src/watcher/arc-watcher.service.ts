import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArcRpcClient } from './arc-rpc.client';
import { matchTransfers } from './transfer-matcher';
import { isOpen } from '../invoices/invoice-state';
import { ARC_CHAIN_KEY } from '../config/chains';

const MAX_BLOCK_SPAN = 2000n;
const OPEN_STATUSES = Object.values(InvoiceStatus).filter(isOpen);

/**
 * Blocks to hold back from the chain head before scanning them. PAID is
 * terminal, so a transfer credited from a block that later gets reorged
 * out would leave a permanently wrong PAID invoice — 2 is generous for a
 * fast testnet.
 */
const CONFIRMATIONS = 2n;

/**
 * The sole authority for marking an invoice PAID (spec §10). Polls Arc for
 * USDC Transfer events to merchant addresses and matches them to open
 * invoices by exact amount.
 */
@Injectable()
export class ArcWatcherService {
  private readonly logger = new Logger(ArcWatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rpc: ArcRpcClient,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron(): Promise<void> {
    try {
      await this.pollOnce();
    } catch (error) {
      // Swallow so a transient RPC failure does not kill the schedule.
      // The cursor is not advanced, so the range is rescanned next tick.
      this.logger.error('Arc watcher poll failed', error as Error);
    }
  }

  async pollOnce(): Promise<number> {
    const head = await this.rpc.getBlockNumber();
    // Never scan past head - CONFIRMATIONS: an unconfirmed block can still
    // be reorged out, and PAID is terminal (no walk-back).
    const confirmedHead = head > CONFIRMATIONS ? head - CONFIRMATIONS : 0n;

    const cursor = await this.prisma.watcherCursor.findUnique({
      where: { chain: ARC_CHAIN_KEY },
    });

    const open = await this.prisma.invoice.findMany({
      where: { status: { in: OPEN_STATUSES }, destChain: ARC_CHAIN_KEY },
      select: { id: true, recipient: true, payableBase: true },
    });

    if (open.length === 0) {
      // Still advance the cursor to the confirmed head even with nothing to
      // match. Otherwise the cursor freezes for the whole idle period and
      // has to catch up at MAX_BLOCK_SPAN blocks/tick once an invoice opens
      // again. Never move it backwards (a lower confirmedHead than an
      // already-recorded cursor should not happen, but guard it anyway).
      if (!cursor || confirmedHead > cursor.lastBlock) {
        await this.prisma.watcherCursor.upsert({
          where: { chain: ARC_CHAIN_KEY },
          create: { chain: ARC_CHAIN_KEY, lastBlock: confirmedHead },
          update: { lastBlock: confirmedHead },
        });
      }
      return 0;
    }

    const fromBlock = cursor ? cursor.lastBlock + 1n : confirmedHead;
    if (fromBlock > confirmedHead) return 0;

    const maxToBlock = fromBlock + MAX_BLOCK_SPAN - 1n;
    const toBlock = maxToBlock > confirmedHead ? confirmedHead : maxToBlock;

    const recipients = [...new Set(open.map((i) => i.recipient.toLowerCase()))];
    const transfers = await this.rpc.getTransferLogs(fromBlock, toBlock, recipients);
    const matches = matchTransfers(transfers, open);

    let paid = 0;
    for (const match of matches) {
      // Conditional update: a concurrent poll or a terminal status makes this
      // a no-op, so an invoice is never credited twice. The write gate must
      // match the fetch filter (OPEN_STATUSES) exactly — a narrower gate here
      // (e.g. omitting UNDERPAID) would let a genuine match fall through as a
      // silent no-op count of 0, and since the scan itself still succeeded
      // the cursor advances past it, permanently losing the payment.
      const { count } = await this.prisma.invoice.updateMany({
        where: {
          id: match.invoiceId,
          status: { in: OPEN_STATUSES },
        },
        data: {
          status: InvoiceStatus.PAID,
          destTxHash: match.txHash,
          paidAt: new Date(),
          activeNonce: null,
        },
      });
      paid += count;
    }

    await this.prisma.watcherCursor.upsert({
      where: { chain: ARC_CHAIN_KEY },
      create: { chain: ARC_CHAIN_KEY, lastBlock: toBlock },
      update: { lastBlock: toBlock },
    });

    return paid;
  }
}
