import {
  pickNonce,
  applyNonce,
  NONCE_MIN,
  NONCE_MAX,
  NonceSpaceExhaustedError,
} from './amount-nonce';

describe('amount nonce', () => {
  it('picks a nonce inside the sub-cent range', () => {
    const nonce = pickNonce(new Set());
    expect(nonce).toBeGreaterThanOrEqual(NONCE_MIN);
    expect(nonce).toBeLessThanOrEqual(NONCE_MAX);
  });

  it('never picks a nonce already taken', () => {
    const taken = new Set<number>();
    for (let i = NONCE_MIN; i < NONCE_MAX; i++) taken.add(i);
    expect(pickNonce(taken)).toBe(NONCE_MAX);
  });

  it('throws rather than reusing when the space is exhausted', () => {
    const taken = new Set<number>();
    for (let i = NONCE_MIN; i <= NONCE_MAX; i++) taken.add(i);
    expect(() => pickNonce(taken)).toThrow(NonceSpaceExhaustedError);
  });

  it('adds the nonce so the merchant is never underpaid', () => {
    // 100 USDC = 100_000_000 base units
    expect(applyNonce(100_000_000n, 417)).toBe(100_000_417n);
  });

  it('keeps the surcharge strictly below one cent', () => {
    const oneCent = 10_000n;
    expect(applyNonce(100_000_000n, NONCE_MAX) - 100_000_000n).toBeLessThan(oneCent);
  });

  it('rejects a nonce outside the range', () => {
    expect(() => applyNonce(100_000_000n, 0)).toThrow(/range/);
    expect(() => applyNonce(100_000_000n, NONCE_MAX + 1)).toThrow(/range/);
  });
});
