import type { InvoiceStatus } from './api';

export interface StatusPresentation {
  label: string;
  /** Tailwind classes for the status pill. */
  className: string;
  /** True when no further status change is possible. */
  terminal: boolean;
}

/**
 * Terminality mirrors server/src/invoices/invoice-state.ts, where UNDERPAID
 * is an OPEN status with a legal UNDERPAID -> PAID transition. Only PAID,
 * EXPIRED and FAILED have no outgoing transitions.
 */
const PRESENTATION: Record<InvoiceStatus, StatusPresentation> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-pending-wash text-pending-ink ring-pending-line',
    terminal: false,
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-progress-wash text-progress-ink ring-progress-line',
    terminal: false,
  },
  PAID: {
    label: 'Paid',
    className: 'bg-positive-wash text-positive-ink ring-positive-line',
    terminal: true,
  },
  EXPIRED: {
    label: 'Expired',
    className: 'bg-neutral-wash text-neutral-ink ring-neutral-line',
    terminal: true,
  },
  UNDERPAID: {
    label: 'Underpaid',
    className: 'bg-caution-wash text-caution-ink ring-caution-line',
    terminal: false,
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-negative-wash text-negative-ink ring-negative-line',
    terminal: true,
  },
};

export function presentStatus(status: InvoiceStatus): StatusPresentation {
  return PRESENTATION[status];
}

export function isTerminal(status: InvoiceStatus): boolean {
  return PRESENTATION[status].terminal;
}
