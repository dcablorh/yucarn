import { Injectable } from '@nestjs/common';
import {
  createPublicClient,
  decodeEventLog,
  http,
  parseAbiItem,
  type Log,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import { arcTestnet } from 'viem/chains';
import { ARC_RPC_URL, ARC_USDC_ADDRESS } from '../config/chains';
import type { ObservedTransfer } from './transfer-matcher';

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

/**
 * Whether `logs` contains a USDC Transfer to `to` for exactly
 * `amountBase`. A successful transaction alone proves nothing about what
 * it paid — this is the part that proves it paid THIS item: emitted by
 * the USDC contract, decodes as Transfer, and matches recipient and
 * amount exactly, the same exactness `transfer-matcher.ts` requires of an
 * observed transfer before crediting an invoice.
 *
 * Exported standalone (rather than folded into `verifyUsdcTransfer`) so
 * this decode-and-match logic can be unit tested without a live RPC
 * client — `ArcRpcClient` itself is normally exercised through a mock.
 */
export function containsMatchingTransfer(
  logs: readonly Pick<Log, 'address' | 'topics' | 'data'>[],
  to: string,
  amountBase: bigint,
): boolean {
  const wantTo = to.toLowerCase();

  for (const log of logs) {
    if (log.address.toLowerCase() !== ARC_USDC_ADDRESS.toLowerCase()) continue;

    try {
      const decoded = decodeEventLog({
        abi: [TRANSFER_EVENT],
        data: log.data,
        topics: log.topics,
      });
      if (
        decoded.eventName === 'Transfer' &&
        decoded.args.to.toLowerCase() === wantTo &&
        decoded.args.value === amountBase
      ) {
        return true;
      }
    } catch {
      // Not a Transfer log (or not decodable as one) -- not a match.
      continue;
    }
  }

  return false;
}

/**
 * What Arc was able to tell us about a reported transaction hash.
 *
 * `unknown` is the whole reason this is not a boolean: "the chain says no"
 * and "we could not reach the chain" are different facts, and only the
 * first one is evidence that a payment did not happen.
 */
export type VerificationOutcome = 'confirmed' | 'rejected' | 'unknown';

/**
 * A receipt read that hangs holds a payroll report open for as long as the
 * socket stays alive, and a batch does one of these per person. Bounded
 * here so a slow endpoint costs a bounded wait and an honest `unknown`,
 * rather than an open-ended stall that some layer above eventually turns
 * into a failed payment.
 */
export const RECEIPT_READ_TIMEOUT_MS = 10_000;

class ReceiptReadTimeout extends Error {
  constructor(ms: number) {
    super(`Arc did not answer within ${ms}ms`);
    this.name = 'ReceiptReadTimeout';
  }
}

/**
 * `work`, or a rejection once `ms` has passed — whichever lands first.
 *
 * The timer is always cleared, including on the happy path: an uncleared
 * timer keeps the Node event loop alive and would hold the process open
 * past the end of a request (and past the end of a test).
 */
export async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new ReceiptReadTimeout(ms)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Reads a receipt we actually managed to fetch into one of the two
 * checkable answers.
 *
 * A receipt whose status is neither 'success' nor 'reverted' is not a
 * negative we can stand behind — it is a response we do not understand,
 * which is `unknown`, not `rejected`.
 *
 * Exported so the three-way decision can be unit tested without a live RPC
 * client, the same reason `containsMatchingTransfer` is exported.
 */
export function receiptOutcome(
  receipt:
    | {
        status?: string;
        logs?: readonly Pick<Log, 'address' | 'topics' | 'data'>[];
      }
    | null
    | undefined,
  to: string,
  amountBase: bigint,
): VerificationOutcome {
  if (!receipt || !Array.isArray(receipt.logs)) return 'unknown';

  if (receipt.status === 'reverted') return 'rejected';
  if (receipt.status !== 'success') return 'unknown';

  // Succeeded, but carrying no Transfer that matches this employee and
  // this amount. That IS a checkable negative: the chain answered, and the
  // answer is that this transaction did not pay this item.
  return containsMatchingTransfer(receipt.logs, to, amountBase)
    ? 'confirmed'
    : 'rejected';
}

@Injectable()
export class ArcRpcClient {
  private readonly client: PublicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });

  getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber();
  }

  async getTransferLogs(
    fromBlock: bigint,
    toBlock: bigint,
    recipients: readonly string[],
  ): Promise<ObservedTransfer[]> {
    const logs = await this.client.getLogs({
      address: ARC_USDC_ADDRESS,
      event: TRANSFER_EVENT,
      args: { to: recipients as `0x${string}`[] },
      fromBlock,
      toBlock,
    });

    return logs.map((log) => ({
      to: log.args.to as string,
      valueBase: log.args.value as bigint,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    }));
  }

  /**
   * What Arc says about a reported transaction hash.
   *
   * Payroll reports its transaction hashes from the browser, and a
   * reported hash is a claim rather than proof — the same stance the
   * invoice path takes toward its payment callback: `transfer-matcher.ts`
   * never trusts a hash either, it matches observed Transfer logs on
   * exact recipient and exact amount. This is that same check applied to
   * a single reported hash: the transaction must have succeeded AND
   * emitted a USDC Transfer log to the right address for the right
   * amount. A successful transaction alone is not enough — it proves
   * nothing about what it paid, or to whom.
   *
   * Three answers, not two. A boolean would have to fold "the chain says
   * this did not happen" together with "we could not ask the chain", and
   * the caller writes that answer to a database that decides whether a
   * person gets paid. A 429 from a public RPC endpoint is not evidence a
   * transfer failed; recording it as one invites the merchant to pay that
   * employee a second time. So:
   *
   *   confirmed — the receipt succeeded and carries a matching Transfer.
   *   rejected  — a real, checkable negative: the receipt says reverted,
   *               or it succeeded carrying no Transfer that matches.
   *   unknown   — we never got to read a receipt: the RPC threw, the read
   *               timed out, the transaction is not mined yet, or the
   *               response was not shaped like a receipt.
   *
   * `unknown` is deliberately NOT a failure. The caller must leave such an
   * item payable-but-unresolved and let the merchant re-check it, never
   * write it down as a payment that did not happen.
   */
  async verifyUsdcTransfer(
    txHash: string,
    to: string,
    amountBase: bigint,
  ): Promise<{ outcome: VerificationOutcome }> {
    let receipt: TransactionReceipt;
    try {
      receipt = await withTimeout(
        this.client.getTransactionReceipt({ hash: txHash as `0x${string}` }),
        RECEIPT_READ_TIMEOUT_MS,
      );
    } catch {
      // Threw, timed out, or is not mined yet (viem throws
      // TransactionReceiptNotFoundError for a pending hash). All of these
      // mean the same thing: we did not get to look.
      return { outcome: 'unknown' };
    }

    return { outcome: receiptOutcome(receipt, to, amountBase) };
  }
}
