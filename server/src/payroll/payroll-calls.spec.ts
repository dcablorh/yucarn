import { buildPayrollCalls, UnsupportedRouteError } from './payroll-calls';
import { ARC_CHAIN_ID, ARC_USDC_ADDRESS } from '../config/chains';

const item = (walletAddress: string, amountBase: bigint, destChain = 'arc-testnet') => ({
  walletAddress,
  amountBase,
  destChain,
});

const ALICE = '0x1111111111111111111111111111111111111111';
const BOB = '0x2222222222222222222222222222222222222222';

describe('buildPayrollCalls', () => {
  it('builds one USDC transfer per item, in order', () => {
    const calls = buildPayrollCalls([
      item(ALICE, 100_000_000n),
      item(BOB, 250_500_000n),
    ]);

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.to).toBe(ARC_USDC_ADDRESS);
      expect(call.chainId).toBe(ARC_CHAIN_ID);
      expect(call.value).toBe('0');
      expect(call.data.startsWith('0xa9059cbb')).toBe(true); // transfer(address,uint256)
    }
  });

  it('encodes the recipient and amount into the calldata', () => {
    const [call] = buildPayrollCalls([item(ALICE, 100_000_000n)]);
    expect(call.data).toBe(
      '0xa9059cbb' +
        '0000000000000000000000001111111111111111111111111111111111111111' +
        '0000000000000000000000000000000000000000000000000000000005f5e100',
    );
  });

  it('sends to the USDC contract, never to the employee directly', () => {
    // A transfer is a call to the token, not a transfer of native funds.
    // Getting this wrong would send Arc's gas asset instead of USDC.
    const [call] = buildPayrollCalls([item(ALICE, 100_000_000n)]);
    expect(call.to).not.toBe(ALICE);
    expect(call.to).toBe(ARC_USDC_ADDRESS);
  });

  it('refuses an item destined for another chain', () => {
    expect(() => buildPayrollCalls([item(ALICE, 100n, 'base-sepolia')])).toThrow(
      UnsupportedRouteError,
    );
  });

  it('names the chain it cannot route to', () => {
    expect(() => buildPayrollCalls([item(ALICE, 100n, 'base-sepolia')])).toThrow(
      /base-sepolia/,
    );
  });

  it('rejects a non-positive amount', () => {
    expect(() => buildPayrollCalls([item(ALICE, 0n)])).toThrow(/greater than zero/);
  });

  it('returns nothing for an empty batch', () => {
    expect(buildPayrollCalls([])).toEqual([]);
  });
});
