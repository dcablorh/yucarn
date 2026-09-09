import { InvoiceStatus } from '@prisma/client';

export class InvalidTransitionError extends Error {
  constructor(from: InvoiceStatus, to: InvoiceStatus) {
    super(`Illegal invoice transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

const TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  [InvoiceStatus.PENDING]: [
    InvoiceStatus.PROCESSING,
    InvoiceStatus.PAID,
    InvoiceStatus.UNDERPAID,
    InvoiceStatus.EXPIRED,
    InvoiceStatus.FAILED,
  ],
  [InvoiceStatus.PROCESSING]: [
    InvoiceStatus.PAID,
    InvoiceStatus.UNDERPAID,
    InvoiceStatus.FAILED,
    // A cross-chain payment can stall indefinitely, so a stalled PROCESSING
    // invoice must be expirable — invoice-expiry.service.ts expires
    // everything in OPEN_STATUSES, which includes PROCESSING.
    InvoiceStatus.EXPIRED,
  ],
  [InvoiceStatus.UNDERPAID]: [InvoiceStatus.PAID, InvoiceStatus.EXPIRED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.EXPIRED]: [],
  [InvoiceStatus.FAILED]: [],
};

const OPEN_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.PENDING,
  InvoiceStatus.PROCESSING,
  InvoiceStatus.UNDERPAID,
];

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/** Open invoices hold an activeNonce and are candidates for settlement matching. */
export function isOpen(status: InvoiceStatus): boolean {
  return OPEN_STATUSES.includes(status);
}
