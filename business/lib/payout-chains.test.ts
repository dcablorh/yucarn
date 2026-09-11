import { describe, it, expect } from 'vitest';
import { PAYOUT_CHAINS } from './payout-chains';

// The browser cannot import server/src/config/payout-chains.ts across the
// app boundary, so there is no way to assert against the server's table
// directly from here. The expected list below is pinned literally — it
// must be updated by hand whenever the server table's keys change, and
// server/src/config/payout-chains.spec.ts is where that table's own
// invariants (Arc's domain/chainId, key uniqueness) are actually checked.
const EXPECTED_KEYS = [
  'arc-testnet',
  'ethereum-sepolia',
  'avalanche-fuji',
  'op-sepolia',
  'arbitrum-sepolia',
  'base-sepolia',
  'polygon-amoy',
  'unichain-sepolia',
  'linea-sepolia',
];

describe('PAYOUT_CHAINS', () => {
  it('has the same keys, in the same order, as the server table', () => {
    expect(PAYOUT_CHAINS.map((chain) => chain.key)).toEqual(EXPECTED_KEYS);
  });
});
