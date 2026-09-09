import {
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  parseAbiItem,
  type Log,
} from 'viem';
import {
  ArcRpcClient,
  RECEIPT_READ_TIMEOUT_MS,
  containsMatchingTransfer,
  receiptOutcome,
  withTimeout,
} from './arc-rpc.client';
import { ARC_USDC_ADDRESS } from '../config/chains';

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

const FROM = '0x1111111111111111111111111111111111111111';
// Deliberately full of hex LETTERS. An all-digit address makes the
// case-insensitivity test below vacuous -- `.toUpperCase()` on it is a
// no-op, so the test cannot fail even a case-sensitive implementation.
const TO = '0xabcdef0123456789abcdef0123456789abcdef01';
const AMOUNT_BASE = 100_000_000n;

type FakeLog = Pick<Log, 'address' | 'topics' | 'data'>;

/** A well-formed USDC-shaped Transfer log, overridable per test. */
function transferLog(
  overrides: { address?: string; to?: string; value?: bigint } = {},
): FakeLog {
  const to = overrides.to ?? TO;
  const value = overrides.value ?? AMOUNT_BASE;
  return {
    address: overrides.address ?? ARC_USDC_ADDRESS,
    topics: encodeEventTopics({
      abi: [TRANSFER_EVENT],
      eventName: 'Transfer',
      args: { from: FROM, to: to as `0x${string}` },
    }),
    data: encodeAbiParameters([{ type: 'uint256' }], [value]),
  } as FakeLog;
}

/**
 * These exercise the decode-and-match logic `ArcRpcClient.verifyUsdcTransfer`
 * relies on. `ArcRpcClient` itself talks to a live viem `PublicClient` and is
 * always exercised through a mock elsewhere (e.g. `payroll.service.spec.ts`),
 * so this is the one place that actually proves a receipt with a successful
 * status but the wrong recipient or the wrong amount is correctly rejected.
 */
describe('containsMatchingTransfer', () => {
  it('matches a USDC Transfer to the right address for the right amount', () => {
    expect(containsMatchingTransfer([transferLog()], TO, AMOUNT_BASE)).toBe(
      true,
    );
  });

  it('is case-insensitive on the recipient address', () => {
    // EIP-55 checksum casing, which is what an RPC actually hands back.
    const mixedCase = getAddress(TO);
    expect(mixedCase).not.toBe(TO); // otherwise this test proves nothing
    expect(
      containsMatchingTransfer(
        [transferLog({ to: mixedCase })],
        TO,
        AMOUNT_BASE,
      ),
    ).toBe(true);
  });

  it('does not match a Transfer to the right address for the wrong amount', () => {
    expect(
      containsMatchingTransfer([transferLog({ value: 1n })], TO, AMOUNT_BASE),
    ).toBe(false);
  });

  it('does not match a Transfer for the right amount to the wrong address', () => {
    const wrongAddress = '0x3333333333333333333333333333333333333333';
    expect(
      containsMatchingTransfer(
        [transferLog({ to: wrongAddress })],
        TO,
        AMOUNT_BASE,
      ),
    ).toBe(false);
  });

  it('ignores a matching Transfer emitted by a contract other than USDC', () => {
    // A successful transaction can emit any log from any contract. Only a
    // log from the USDC contract itself counts as a USDC transfer.
    const otherContract = '0x9999999999999999999999999999999999999999';
    expect(
      containsMatchingTransfer(
        [transferLog({ address: otherContract })],
        TO,
        AMOUNT_BASE,
      ),
    ).toBe(false);
  });

  it('returns false, without throwing, when there are no logs at all', () => {
    expect(containsMatchingTransfer([], TO, AMOUNT_BASE)).toBe(false);
  });

  it('skips a USDC log that does not decode as Transfer, without throwing', () => {
    const bogusLog: FakeLog = {
      address: ARC_USDC_ADDRESS,
      topics: ['0x' + 'de'.repeat(32)] as unknown as FakeLog['topics'],
      data: '0x',
    };
    expect(() =>
      containsMatchingTransfer([bogusLog], TO, AMOUNT_BASE),
    ).not.toThrow();
    expect(containsMatchingTransfer([bogusLog], TO, AMOUNT_BASE)).toBe(false);
  });
});

/**
 * The three-way answer, tested on the part that can be tested without a
 * live RPC client: given a receipt we managed to read, which answer is it?
 */
describe('receiptOutcome', () => {
  const okReceipt = { status: 'success' as const, logs: [transferLog()] };

  it('confirms a successful receipt carrying a matching Transfer', () => {
    expect(receiptOutcome(okReceipt, TO, AMOUNT_BASE)).toBe('confirmed');
  });

  it('rejects a reverted receipt', () => {
    expect(
      receiptOutcome({ status: 'reverted', logs: [] }, TO, AMOUNT_BASE),
    ).toBe('rejected');
  });

  it('rejects a successful receipt that paid nobody matching', () => {
    // The chain answered, and the answer is that this transaction did not
    // pay this item. That is a real negative, not a gap in our knowledge.
    expect(
      receiptOutcome({ status: 'success', logs: [] }, TO, AMOUNT_BASE),
    ).toBe('rejected');
  });

  it('answers unknown for a receipt shape it does not understand', () => {
    // Not "this payment failed" -- "we do not know what this says".
    expect(
      receiptOutcome({ status: 'pending', logs: [] }, TO, AMOUNT_BASE),
    ).toBe('unknown');
    expect(receiptOutcome(null, TO, AMOUNT_BASE)).toBe('unknown');
  });
});

describe('withTimeout', () => {
  it('hands back the value when the work lands in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('rejects when the work outlives the budget', async () => {
    const never = new Promise(() => {});
    await expect(withTimeout(never, 5)).rejects.toThrow(/did not answer/i);
  });
});

describe('ArcRpcClient.verifyUsdcTransfer', () => {
  /** Swaps the viem client for a stub; no network is touched. */
  function clientWith(getTransactionReceipt: jest.Mock) {
    const arc = new ArcRpcClient();
    (arc as unknown as { client: unknown }).client = { getTransactionReceipt };
    return arc;
  }

  it('confirms a hash whose receipt succeeded and paid this item', async () => {
    const arc = clientWith(
      jest.fn().mockResolvedValue({ status: 'success', logs: [transferLog()] }),
    );
    await expect(
      arc.verifyUsdcTransfer('0xdead', TO, AMOUNT_BASE),
    ).resolves.toEqual({ outcome: 'confirmed' });
  });

  it('rejects a hash whose receipt reverted', async () => {
    const arc = clientWith(
      jest.fn().mockResolvedValue({ status: 'reverted', logs: [] }),
    );
    await expect(
      arc.verifyUsdcTransfer('0xdead', TO, AMOUNT_BASE),
    ).resolves.toEqual({ outcome: 'rejected' });
  });

  it('answers unknown when the RPC throws, rather than calling the payment failed', async () => {
    // 429, 5xx, a dropped socket, or a hash that simply is not mined yet.
    // Collapsing these into "failed" is how an employee who WAS paid shows
    // up as unpaid and gets paid again.
    const arc = clientWith(jest.fn().mockRejectedValue(new Error('429')));
    await expect(
      arc.verifyUsdcTransfer('0xdead', TO, AMOUNT_BASE),
    ).resolves.toEqual({ outcome: 'unknown' });
  });

  it('answers unknown when the receipt read hangs past its budget', async () => {
    // A hung read would otherwise hold the whole payroll report open, one
    // person at a time, and be recorded as a payment that did not happen.
    jest.useFakeTimers();
    try {
      const arc = clientWith(jest.fn().mockReturnValue(new Promise(() => {})));
      const result = arc.verifyUsdcTransfer('0xdead', TO, AMOUNT_BASE);

      jest.advanceTimersByTime(RECEIPT_READ_TIMEOUT_MS + 1);

      await expect(result).resolves.toEqual({ outcome: 'unknown' });
    } finally {
      jest.useRealTimers();
    }
  });
});
