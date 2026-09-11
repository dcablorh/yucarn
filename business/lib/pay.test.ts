import { describe, it, expect } from 'vitest';
import { encodeUsdcTransfer, buildPaymentTransaction, isPayable } from './pay';
import { ARC_USDC_ADDRESS } from './chains';

const RECIPIENT = '0x1111111111111111111111111111111111111111' as const;

describe('encodeUsdcTransfer', () => {
  it('encodes the ERC-20 transfer selector, recipient and amount', () => {
    // 100.000417 USDC — a whole-cent amount plus the invoice's nonce tail.
    const data = encodeUsdcTransfer(RECIPIENT, 100_000_417n);

    expect(data).toBe(
      '0xa9059cbb' +
        '0000000000000000000000001111111111111111111111111111111111111111' +
        '0000000000000000000000000000000000000000000000000000000005f5e2a1',
    );
  });

  it('preserves the nonce tail exactly', () => {
    const withNonce = encodeUsdcTransfer(RECIPIENT, 100_000_417n);
    const withoutNonce = encodeUsdcTransfer(RECIPIENT, 100_000_000n);
    expect(withNonce).not.toBe(withoutNonce);
  });

  it('rejects a zero amount', () => {
    expect(() => encodeUsdcTransfer(RECIPIENT, 0n)).toThrow(/greater than zero/);
  });

  it('rejects a negative amount', () => {
    expect(() => encodeUsdcTransfer(RECIPIENT, -1n)).toThrow(/greater than zero/);
  });
});

describe('buildPaymentTransaction', () => {
  it('sends the call to the Arc USDC contract, not the recipient', () => {
    const tx = buildPaymentTransaction(RECIPIENT, 100_000_417n);
    expect(tx.to).toBe(ARC_USDC_ADDRESS);
    expect(tx.data.startsWith('0xa9059cbb')).toBe(true);
  });
});

describe('isPayable', () => {
  it('allows paying an open invoice', () => {
    expect(isPayable('PENDING')).toBe(true);
  });

  it('allows paying while a reported transfer is still settling', () => {
    expect(isPayable('PROCESSING')).toBe(true);
  });

  it('allows topping up an underpaid invoice', () => {
    // The server still permits UNDERPAID -> PAID, so this is not terminal.
    expect(isPayable('UNDERPAID')).toBe(true);
  });

  it.each(['PAID', 'EXPIRED', 'FAILED'])('refuses a %s invoice', (status) => {
    expect(isPayable(status)).toBe(false);
  });
});
