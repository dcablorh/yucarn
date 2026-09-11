import type { Invoice } from './api';

export type TimelineState = 'done' | 'current' | 'pending' | 'skipped' | 'failed';

export interface TimelineStep {
  key: 'created' | 'processing' | 'settled';
  label: string;
  state: TimelineState;
  /** Explanatory line, or the transaction hash on a settled step. */
  detail?: string;
}

/**
 * The PDF's Pending -> Processing -> Paid, rendered honestly.
 *
 * PROCESSING is only ever set by POST /public/invoices/:id/payments, which
 * the consumer checkout app does not call today. An invoice therefore
 * normally goes straight from PENDING to PAID, and the Processing step must
 * say it was skipped and why — showing a spinner there would claim work is
 * in progress that nothing is doing.
 */
export function deriveTimeline(invoice: Invoice): TimelineStep[] {
  return [
    { key: 'created', label: 'Created', state: 'done', detail: invoice.createdAt },
    processingStep(invoice),
    settledStep(invoice),
  ];
}

function processingStep(invoice: Invoice): TimelineStep {
  const step = { key: 'processing' as const, label: 'Processing' };

  switch (invoice.status) {
    case 'PENDING':
      return { ...step, state: 'pending' };
    case 'PROCESSING':
      return { ...step, state: 'current', detail: invoice.sourceTxHash ?? undefined };
    case 'PAID':
    case 'UNDERPAID':
      return invoice.sourceTxHash
        ? { ...step, state: 'done', detail: invoice.sourceTxHash }
        : {
            ...step,
            state: 'skipped',
            detail: 'Payment was not reported by the checkout app',
          };
    case 'EXPIRED':
    case 'FAILED':
      return { ...step, state: 'skipped' };
  }
}

function settledStep(invoice: Invoice): TimelineStep {
  const step = { key: 'settled' as const, label: 'Paid on Arc' };

  switch (invoice.status) {
    case 'PENDING':
    case 'PROCESSING':
      return { ...step, state: 'pending' };
    case 'PAID':
      return { ...step, state: 'done', detail: invoice.destTxHash ?? undefined };
    case 'UNDERPAID':
      // Still open: the server allows UNDERPAID -> PAID once the balance
      // arrives, so this is a partial payment, not a failure.
      return { ...step, state: 'current', detail: 'Paid short of the invoiced amount' };
    case 'EXPIRED':
      return { ...step, state: 'skipped', detail: 'Invoice expired before payment' };
    case 'FAILED':
      return { ...step, state: 'failed' };
  }
}
