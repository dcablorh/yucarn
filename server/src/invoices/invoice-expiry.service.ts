import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isOpen } from './invoice-state';

const OPEN_STATUSES = Object.values(InvoiceStatus).filter(isOpen);

/**
 * Closes invoices past their expiry and releases their amount nonce back to
 * the pool. Without this the nonce space leaks: an abandoned invoice would
 * hold its slot forever (spec §10).
 *
 * A paid invoice is never expired — PAID is terminal, and the status filter
 * here excludes it.
 */
@Injectable()
export class InvoiceExpiryService {
  private readonly logger = new Logger(InvoiceExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron(): Promise<void> {
    try {
      const expired = await this.expireOnce();
      if (expired > 0) this.logger.log(`Expired ${expired} invoice(s)`);
    } catch (error) {
      this.logger.error('Invoice expiry sweep failed', error as Error);
    }
  }

  async expireOnce(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.invoice.updateMany({
      where: { status: { in: OPEN_STATUSES }, expiresAt: { lt: now } },
      data: { status: InvoiceStatus.EXPIRED, activeNonce: null },
    });
    return count;
  }
}
