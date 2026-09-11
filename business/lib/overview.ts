import type { Invoice } from './api';
import { isTerminal } from './status';

export interface OverviewStats {
  /** Sum of payableBase across PAID invoices. */
  receivedBase: bigint;
  /** Sum of payableBase across invoices that can still be paid. */
  awaitingBase: bigint;
  openCount: number;
  paidCount: number;
}

/**
 * Aggregates client-side from the invoice list the dashboard already polls,
 * rather than through a dedicated stats endpoint. A merchant's invoice list
 * is small, the list is already in memory, and adding a server route would
 * put this plan into server/ for no gain.
 *
 * Figures use payableBase, not amountBase: payableBase carries the amount
 * nonce and is the sum the customer actually transferred.
 */
export function deriveOverview(invoices: Invoice[]): OverviewStats {
  let receivedBase = 0n;
  let awaitingBase = 0n;
  let openCount = 0;
  let paidCount = 0;

  for (const invoice of invoices) {
    const payable = BigInt(invoice.payableBase);

    if (invoice.status === 'PAID') {
      receivedBase += payable;
      paidCount += 1;
    } else if (!isTerminal(invoice.status)) {
      awaitingBase += payable;
      openCount += 1;
    }
  }

  return { receivedBase, awaitingBase, openCount, paidCount };
}
