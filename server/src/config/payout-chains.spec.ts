import { ARC_CCTP_DOMAIN, ARC_CHAIN_ID } from './chains';
import { PAYOUT_CHAINS } from './payout-chains';

describe('PAYOUT_CHAINS', () => {
  it("keys the Arc entry so it agrees with chains.ts's settlement constants", () => {
    // The comment on PAYOUT_CHAINS asserts this agreement as the reason the
    // table is safe to key the way it is, but nothing enforced it — this
    // test is that enforcement.
    const arc = PAYOUT_CHAINS.find((chain) => chain.key === 'arc-testnet');
    expect(arc?.domain).toBe(ARC_CCTP_DOMAIN);
    expect(arc?.chainId).toBe(ARC_CHAIN_ID);
  });

  it('has no duplicate keys', () => {
    const keys = PAYOUT_CHAINS.map((chain) => chain.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
