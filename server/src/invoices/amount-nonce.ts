/**
 * Each open invoice for a business gets a unique sub-cent surcharge so an
 * incoming USDC transfer maps to exactly one invoice. USDC has 6 decimals,
 * so 1..9999 base units is 0.000001..0.009999 USDC — always under one cent.
 *
 * The nonce is ADDED, never subtracted: the merchant is always paid at least
 * the amount requested.
 */
export const NONCE_MIN = 1;
export const NONCE_MAX = 9999;

export class NonceSpaceExhaustedError extends Error {
  constructor() {
    super(
      `All ${NONCE_MAX} amount nonces are in use for this business; ` +
        'close an open invoice before creating another',
    );
    this.name = 'NonceSpaceExhaustedError';
  }
}

export function pickNonce(taken: ReadonlySet<number>): number {
  const available: number[] = [];
  for (let candidate = NONCE_MIN; candidate <= NONCE_MAX; candidate++) {
    if (!taken.has(candidate)) available.push(candidate);
  }

  if (available.length === 0) {
    throw new NonceSpaceExhaustedError();
  }

  return available[Math.floor(Math.random() * available.length)];
}

export function applyNonce(amountBase: bigint, nonce: number): bigint {
  if (!Number.isInteger(nonce) || nonce < NONCE_MIN || nonce > NONCE_MAX) {
    throw new Error(`Nonce ${nonce} is outside the range ${NONCE_MIN}..${NONCE_MAX}`);
  }
  return amountBase + BigInt(nonce);
}
