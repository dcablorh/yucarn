import './bigint-json';

describe('BigInt JSON patch', () => {
  it('lets JSON.stringify serialise a BigInt (via the app graph import, not main.ts)', () => {
    expect(JSON.stringify({ amountBase: 100_000_417n })).toBe('{"amountBase":"100000417"}');
  });
});
