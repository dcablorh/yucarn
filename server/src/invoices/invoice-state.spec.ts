import { InvoiceStatus } from '@prisma/client';
import { canTransition, assertTransition, isOpen, InvalidTransitionError } from './invoice-state';

describe('invoice state machine', () => {
  it('allows the happy path', () => {
    expect(canTransition(InvoiceStatus.PENDING, InvoiceStatus.PROCESSING)).toBe(true);
    expect(canTransition(InvoiceStatus.PROCESSING, InvoiceStatus.PAID)).toBe(true);
  });

  it('allows PENDING to jump straight to PAID', () => {
    // The consumer app does not yet report PROCESSING, so the watcher
    // observes settlement without an intermediate transition.
    expect(canTransition(InvoiceStatus.PENDING, InvoiceStatus.PAID)).toBe(true);
  });

  it('treats PAID as terminal', () => {
    for (const status of Object.values(InvoiceStatus)) {
      expect(canTransition(InvoiceStatus.PAID, status)).toBe(false);
    }
  });

  it('refuses to walk backwards', () => {
    expect(canTransition(InvoiceStatus.PROCESSING, InvoiceStatus.PENDING)).toBe(false);
  });

  it('refuses to reopen an expired invoice', () => {
    expect(canTransition(InvoiceStatus.EXPIRED, InvoiceStatus.PAID)).toBe(false);
  });

  it('throws a descriptive error on an illegal transition', () => {
    expect(() => assertTransition(InvoiceStatus.PAID, InvoiceStatus.PENDING)).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertTransition(InvoiceStatus.PAID, InvoiceStatus.PENDING)).toThrow(
      /PAID.*PENDING/,
    );
  });

  it('reports which statuses are open', () => {
    expect(isOpen(InvoiceStatus.PENDING)).toBe(true);
    expect(isOpen(InvoiceStatus.PROCESSING)).toBe(true);
    expect(isOpen(InvoiceStatus.PAID)).toBe(false);
    expect(isOpen(InvoiceStatus.EXPIRED)).toBe(false);
    expect(isOpen(InvoiceStatus.UNDERPAID)).toBe(true);
    expect(isOpen(InvoiceStatus.FAILED)).toBe(false);
  });

  it('allows a stalled PROCESSING invoice to expire', () => {
    // A cross-chain payment can stall indefinitely, and
    // invoice-expiry.service.ts expires every OPEN_STATUSES invoice
    // (which includes PROCESSING) via a raw updateMany — this transition
    // must be legal or that write silently violates the state machine.
    expect(canTransition(InvoiceStatus.PROCESSING, InvoiceStatus.EXPIRED)).toBe(true);
  });

  it('allows an underpaid invoice to still be topped up to PAID', () => {
    expect(canTransition(InvoiceStatus.UNDERPAID, InvoiceStatus.PAID)).toBe(true);
  });

  it('allows an underpaid invoice to expire', () => {
    expect(canTransition(InvoiceStatus.UNDERPAID, InvoiceStatus.EXPIRED)).toBe(true);
  });
});
