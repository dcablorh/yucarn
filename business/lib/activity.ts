import type { Invoice } from './api';
import type { PayrollBatch } from './payroll';

export interface ActivityEntry {
  id: string;
  /** Money arriving from a customer, or leaving to an employee. */
  direction: 'in' | 'out';
  title: string;
  detail: string;
  amountBase: bigint;
  /** ISO timestamp the money actually moved. */
  at: string;
  /** Arc transaction hash, when one was recorded. */
  txHash: string | null;
  /** Where this row links inside the dashboard. */
  href: string;
}

/**
 * One ledger of money that actually moved, built from what we already know
 * rather than from the chain.
 *
 * Reading USDC Transfer logs for the merchant's address would be the
 * literal on-chain history, but it is both worse and less reliable here:
 * public RPCs cap `getLogs` block ranges, so a wallet older than that
 * window silently loses its earliest rows, and a raw log can only say
 * "0x36… moved 100.00 to 0x11…". These rows can say "Order #1234" and
 * "Payroll to Ada", because the invoice and payroll records carry the
 * meaning the chain has no way to store.
 *
 * Only settled money appears. A PENDING invoice is a request, not a
 * payment, and it is already counted under "Awaiting payment" — showing it
 * here too would let a merchant read the same money twice.
 */
export function deriveActivity(
  invoices: Invoice[],
  batches: PayrollBatch[],
  limit = 8,
): ActivityEntry[] {
  const entries: ActivityEntry[] = [];

  for (const invoice of invoices) {
    if (invoice.status !== 'PAID') continue;
    entries.push({
      id: `invoice-${invoice.id}`,
      direction: 'in',
      title: invoice.description ?? 'Invoice',
      // payableBase, not amountBase: the nonce-bearing sum is what the
      // customer actually transferred.
      detail: 'Invoice paid',
      amountBase: BigInt(invoice.payableBase),
      at: invoice.paidAt ?? invoice.createdAt,
      txHash: invoice.sourceTxHash,
      href: `/dashboard/invoices/${invoice.id}`,
    });
  }

  for (const batch of batches) {
    for (const item of batch.items) {
      if (item.status !== 'PAID') continue;
      entries.push({
        id: `payroll-${item.id}`,
        direction: 'out',
        title: item.name,
        detail: 'Payroll',
        amountBase: BigInt(item.amountBase),
        // The item carries no timestamp of its own; the batch's execution
        // is when every item in it moved.
        at: batch.executedAt ?? batch.createdAt,
        txHash: item.payTxHash,
        href: `/dashboard/payroll/${batch.id}`,
      });
    }
  }

  return entries
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

/** Net movement across the entries shown, for the wallet card's summary. */
export function netMovement(entries: ActivityEntry[]): bigint {
  return entries.reduce(
    (total, entry) =>
      entry.direction === 'in' ? total + entry.amountBase : total - entry.amountBase,
    0n,
  );
}
