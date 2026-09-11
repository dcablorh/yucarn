import { describe, it, expect } from 'vitest';
import { deriveActivity, netMovement } from './activity';
import type { Invoice } from './api';
import type { PayrollBatch } from './payroll';

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: 'inv_1',
  amountBase: '100000000',
  payableBase: '100000417',
  recipient: '0x1111111111111111111111111111111111111111',
  destChain: 'arc-testnet',
  asset: 'USDC',
  status: 'PAID',
  description: 'Order #1234',
  sourceTxHash: '0xaaa',
  destTxHash: null,
  paidAt: '2026-09-05T10:00:00.000Z',
  expiresAt: '2026-09-06T10:00:00.000Z',
  createdAt: '2026-09-05T09:00:00.000Z',
  ...over,
});

const batch = (over: Partial<PayrollBatch> = {}): PayrollBatch => ({
  id: 'bat_1',
  status: 'COMPLETED',
  fundingChain: 'arc-testnet',
  totalBase: '50000000',
  executedAt: '2026-09-07T10:00:00.000Z',
  createdAt: '2026-09-07T09:00:00.000Z',
  items: [
    {
      id: 'itm_1',
      employeeId: 'emp_1',
      name: 'Ada',
      walletAddress: '0x2222222222222222222222222222222222222222',
      amountBase: '50000000',
      destChain: 'arc-testnet',
      destAsset: 'USDC',
      status: 'PAID',
      payTxHash: '0xbbb',
      failureReason: null,
    },
  ],
  ...over,
});

describe('deriveActivity', () => {
  it('shows a paid invoice as money in', () => {
    const [entry] = deriveActivity([invoice()], []);
    expect(entry.direction).toBe('in');
    expect(entry.amountBase).toBe(100_000_417n);
    expect(entry.txHash).toBe('0xaaa');
  });

  it('uses payableBase, the sum the customer actually sent', () => {
    const [entry] = deriveActivity([invoice()], []);
    expect(entry.amountBase).not.toBe(100_000_000n);
  });

  it('shows a paid payroll item as money out', () => {
    const [entry] = deriveActivity([], [batch()]);
    expect(entry.direction).toBe('out');
    expect(entry.title).toBe('Ada');
    expect(entry.amountBase).toBe(50_000_000n);
  });

  it('leaves out an unpaid invoice, which is a request rather than a payment', () => {
    expect(deriveActivity([invoice({ status: 'PENDING' })], [])).toHaveLength(0);
  });

  it('leaves out a payroll item that has not been paid', () => {
    const pending = batch();
    pending.items[0].status = 'PENDING';
    expect(deriveActivity([], [pending])).toHaveLength(0);
  });

  it('orders newest first across both sources', () => {
    // The payroll run is two days after the invoice.
    const entries = deriveActivity([invoice()], [batch()]);
    expect(entries.map((entry) => entry.id)).toEqual(['payroll-itm_1', 'invoice-inv_1']);
  });

  it('dates a payroll entry from the batch execution, not its creation', () => {
    const [entry] = deriveActivity([], [batch()]);
    expect(entry.at).toBe('2026-09-07T10:00:00.000Z');
  });

  it('falls back to the invoice creation date when paidAt is missing', () => {
    const [entry] = deriveActivity([invoice({ paidAt: null })], []);
    expect(entry.at).toBe('2026-09-05T09:00:00.000Z');
  });

  it('honours the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      invoice({ id: `inv_${i}`, paidAt: `2026-09-${String(i + 1).padStart(2, '0')}T10:00:00.000Z` }),
    );
    expect(deriveActivity(many, [], 8)).toHaveLength(8);
  });

  it('survives an invoice with no description', () => {
    const [entry] = deriveActivity([invoice({ description: null })], []);
    expect(entry.title).toBe('Invoice');
  });
});

describe('netMovement', () => {
  it('subtracts payroll from invoices, in BigInt', () => {
    const entries = deriveActivity([invoice()], [batch()]);
    // 100.000417 in, 50.00 out.
    expect(netMovement(entries)).toBe(50_000_417n);
  });

  it('is zero for an empty ledger', () => {
    expect(netMovement([])).toBe(0n);
  });

  it('goes negative when payroll exceeds receipts', () => {
    const big = batch();
    big.items[0].amountBase = '500000000';
    expect(netMovement(deriveActivity([invoice()], [big]))).toBe(-399_999_583n);
  });
});
