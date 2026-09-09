import { composeBatch, PayrollCompositionError } from './payroll-composition';

const arc = (id: string, name: string) => ({
  id,
  name,
  walletAddress: `0x${id.padEnd(40, '0')}`,
  prefChain: 'arc-testnet',
  prefAsset: 'USDC',
});

describe('composeBatch', () => {
  it('turns two employees and their amounts into items and a total', () => {
    const result = composeBatch(
      [arc('a1', 'Ada'), arc('b2', 'Grace')],
      { a1: '100.00', b2: '250.50' },
    );

    expect(result.items).toHaveLength(2);
    expect(result.items[0].amountBase).toBe(100_000_000n);
    expect(result.items[1].amountBase).toBe(250_500_000n);
    expect(result.totalBase).toBe(350_500_000n);
    expect(result.unpayable).toHaveLength(0);
  });

  it('carries the destination chain and asset from the employee', () => {
    // destChain is written per item, not per batch, so adding cross-chain
    // later is a route branch rather than a reshaping of the data.
    const result = composeBatch([arc('a1', 'Ada')], { a1: '10.00' });
    expect(result.items[0].destChain).toBe('arc-testnet');
    expect(result.items[0].destAsset).toBe('USDC');
  });

  it('refuses a non-Arc employee by name instead of skipping them', () => {
    const offChain = { ...arc('c3', 'Katherine'), prefChain: 'base-sepolia' };
    const result = composeBatch(
      [arc('a1', 'Ada'), offChain],
      { a1: '10.00', c3: '20.00' },
    );

    expect(result.items).toHaveLength(1);
    expect(result.unpayable).toHaveLength(1);
    expect(result.unpayable[0]).toMatchObject({
      employeeId: 'c3',
      name: 'Katherine',
      destChain: 'base-sepolia',
    });
    expect(result.unpayable[0].reason).toMatch(/Arc/);
  });

  it('leaves out an employee with no amount rather than paying them zero', () => {
    const result = composeBatch([arc('a1', 'Ada'), arc('b2', 'Grace')], { a1: '10.00' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].employeeId).toBe('a1');
    expect(result.unpayable).toHaveLength(0);
  });

  it('rejects an amount that is not a whole number of cents', () => {
    expect(() => composeBatch([arc('a1', 'Ada')], { a1: '10.0001' })).toThrow(
      PayrollCompositionError,
    );
  });

  it('rejects a zero amount', () => {
    expect(() => composeBatch([arc('a1', 'Ada')], { a1: '0' })).toThrow(
      PayrollCompositionError,
    );
  });

  it('rejects a negative amount', () => {
    expect(() => composeBatch([arc('a1', 'Ada')], { a1: '-5.00' })).toThrow(
      PayrollCompositionError,
    );
  });

  it('rejects an amount for an employee who is not on the roster', () => {
    // The id came from somewhere other than this business's team.
    expect(() => composeBatch([arc('a1', 'Ada')], { zz: '10.00' })).toThrow(
      /not on your team/i,
    );
  });

  it('refuses a batch with nothing payable in it', () => {
    expect(() => composeBatch([arc('a1', 'Ada')], {})).toThrow(/no one/i);
  });

  it('sums with BigInt, so large batches do not lose precision', () => {
    // 2^53 micro-USDC is past Number.MAX_SAFE_INTEGER; a float sum would drift.
    const many = Array.from({ length: 40 }, (_, i) => arc(`e${i}`, `Person ${i}`));
    const amounts = Object.fromEntries(many.map((e) => [e.id, '999999999.99']));
    const result = composeBatch(many, amounts);
    expect(result.totalBase).toBe(999_999_999_990_000n * 40n);
  });
});
