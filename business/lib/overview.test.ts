import { describe, it, expect } from 'vitest';
import { deriveOverview } from './overview';
import type { Invoice, InvoiceStatus } from './api';

function invoice(status: InvoiceStatus, payableBase: string): Invoice {
  return {
    id: `id-${status}-${payableBase}`,
    amountBase: payableBase,
    payableBase,
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
  };
}

describe('deriveOverview', () => {
  it('returns zeroes for an empty list', () => {
    expect(deriveOverview([])).toEqual({
      receivedBase: 0n,
      awaitingBase: 0n,
      openCount: 0,
      paidCount: 0,
    });
  });

  it('sums only paid invoices into received', () => {
    const stats = deriveOverview([
      invoice('PAID', '100000000'),
      invoice('PAID', '50000000'),
      invoice('PENDING', '25000000'),
    ]);
    expect(stats.receivedBase).toBe(150_000_000n);
    expect(stats.paidCount).toBe(2);
  });

  it('sums non-terminal invoices into awaiting', () => {
    const stats = deriveOverview([
      invoice('PENDING', '25000000'),
      invoice('PROCESSING', '10000000'),
      invoice('UNDERPAID', '5000000'),
      invoice('EXPIRED', '99000000'),
    ]);
    expect(stats.awaitingBase).toBe(40_000_000n);
    expect(stats.openCount).toBe(3);
  });

  it('excludes expired and failed invoices from both figures', () => {
    const stats = deriveOverview([
      invoice('EXPIRED', '100000000'),
      invoice('FAILED', '100000000'),
    ]);
    expect(stats.receivedBase).toBe(0n);
    expect(stats.awaitingBase).toBe(0n);
    expect(stats.openCount).toBe(0);
    expect(stats.paidCount).toBe(0);
  });

  it('sums payableBase, which is what actually arrived', () => {
    // amountBase is what the merchant asked for; payableBase adds the
    // amount nonce and is what the customer actually sent.
    const paid = invoice('PAID', '100004417');
    paid.amountBase = '100000000';
    expect(deriveOverview([paid]).receivedBase).toBe(100_004_417n);
  });
});
