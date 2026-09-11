import { describe, it, expect } from 'vitest';
import { deriveTimeline } from './timeline';
import type { Invoice, InvoiceStatus } from './api';

function invoice(status: InvoiceStatus, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv1',
    amountBase: '100000000',
    payableBase: '100004417',
    recipient: '0x0000000000000000000000000000000000000001',
    destChain: 'arc-testnet',
    asset: 'USDC',
    status,
    description: null,
    sourceTxHash: null,
    destTxHash: null,
    paidAt: null,
    expiresAt: '2026-09-10T00:00:00.000Z',
    createdAt: '2026-09-09T00:00:00.000Z',
    ...overrides,
  };
}

const stateOf = (invoiceValue: Invoice, key: string) =>
  deriveTimeline(invoiceValue).find((step) => step.key === key)!;

describe('deriveTimeline', () => {
  it('always returns the three steps in order', () => {
    expect(deriveTimeline(invoice('PENDING')).map((step) => step.key)).toEqual([
      'created', 'processing', 'settled',
    ]);
  });

  it('marks created done for every status', () => {
    for (const status of ['PENDING', 'PROCESSING', 'PAID', 'EXPIRED', 'FAILED'] as InvoiceStatus[]) {
      expect(stateOf(invoice(status), 'created').state).toBe('done');
    }
  });

  it('leaves processing pending while the invoice is pending', () => {
    expect(stateOf(invoice('PENDING'), 'processing').state).toBe('pending');
    expect(stateOf(invoice('PENDING'), 'settled').state).toBe('pending');
  });

  it('marks processing current while the invoice is processing', () => {
    expect(stateOf(invoice('PROCESSING'), 'processing').state).toBe('current');
  });

  it('marks processing skipped when a paid invoice was never reported', () => {
    // The consumer app does not call POST /public/invoices/:id/payments
    // (spec base doc s10), so PENDING -> PAID with no sourceTxHash is the
    // normal path. It must read as skipped-and-explained, not as a step
    // that is still running.
    const step = stateOf(invoice('PAID'), 'processing');
    expect(step.state).toBe('skipped');
    expect(step.detail).toMatch(/not reported/i);
  });

  it('marks processing done when a paid invoice was reported', () => {
    const step = stateOf(invoice('PAID', { sourceTxHash: '0xabc' }), 'processing');
    expect(step.state).toBe('done');
  });

  it('marks settled done and carries the Arc transaction hash', () => {
    const step = stateOf(invoice('PAID', { destTxHash: '0xdef' }), 'settled');
    expect(step.state).toBe('done');
    expect(step.detail).toBe('0xdef');
  });

  it('marks settled skipped for an expired invoice', () => {
    expect(stateOf(invoice('EXPIRED'), 'settled').state).toBe('skipped');
    expect(stateOf(invoice('EXPIRED'), 'processing').state).toBe('skipped');
  });

  it('marks settled failed for a failed invoice', () => {
    expect(stateOf(invoice('FAILED'), 'settled').state).toBe('failed');
  });

  it('keeps an underpaid invoice open rather than failing it', () => {
    // UNDERPAID -> PAID is a legal server-side transition.
    const step = stateOf(invoice('UNDERPAID'), 'settled');
    expect(step.state).toBe('current');
    expect(step.detail).toMatch(/short/i);
  });
});
