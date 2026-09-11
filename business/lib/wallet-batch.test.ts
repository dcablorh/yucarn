import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  supportsBatching,
  sendCalls,
  pairConfirmed,
  PartialSendError,
  type Eip1193Provider,
} from './wallet-batch';
import type { UnsignedCall } from './ens';
import { arcTestnet } from './chains';

/**
 * The one piece of real network in this module: sendCalls now waits for a
 * receipt before it hands a hash back, because eth_sendTransaction
 * resolves on broadcast and the endpoints these hashes are posted to read
 * a receipt immediately.
 *
 * vi.hoisted because vi.mock is hoisted above the imports, so the spy has
 * to exist before the factory runs. createPublicClientChains records the
 * `chain` each createPublicClient call was made with, so tests can assert
 * confirmation is happening against the right chain rather than always
 * Sepolia.
 */
const { waitForTransactionReceipt, createPublicClientChains } = vi.hoisted(() => ({
  waitForTransactionReceipt: vi.fn(),
  createPublicClientChains: [] as { id: number; name: string }[],
}));

vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>();
  return {
    ...actual,
    createPublicClient: (config: { chain: { id: number; name: string } }) => {
      createPublicClientChains.push(config.chain);
      return { chain: config.chain, waitForTransactionReceipt };
    },
  };
});

const SEPOLIA = 11155111;
const HEX = '0xaa36a7'; // 11155111

describe('supportsBatching', () => {
  it('accepts a wallet that declares atomic support for the chain', () => {
    expect(supportsBatching({ [HEX]: { atomic: { status: 'supported' } } }, SEPOLIA)).toBe(true);
  });

  it('accepts "ready", which is atomic for a single batch', () => {
    expect(supportsBatching({ [HEX]: { atomic: { status: 'ready' } } }, SEPOLIA)).toBe(true);
  });

  it('rejects an unsupported status', () => {
    expect(supportsBatching({ [HEX]: { atomic: { status: 'unsupported' } } }, SEPOLIA)).toBe(false);
  });

  it('rejects capabilities for a different chain', () => {
    expect(supportsBatching({ '0x1': { atomic: { status: 'supported' } } }, SEPOLIA)).toBe(false);
  });

  it('rejects an empty capability set', () => {
    expect(supportsBatching({}, SEPOLIA)).toBe(false);
  });

  it('rejects undefined, which is what a wallet without the method gives us', () => {
    expect(supportsBatching(undefined, SEPOLIA)).toBe(false);
  });

  it('rejects a malformed response rather than throwing', () => {
    // Wallets are third-party code; a shape we did not expect must
    // degrade to the sequential path, never crash the page.
    expect(supportsBatching('nonsense', SEPOLIA)).toBe(false);
    expect(supportsBatching({ [HEX]: null }, SEPOLIA)).toBe(false);
  });
});

describe('sendCalls', () => {
  const from = '0xf000000000000000000000000000000000000f';
  const twoCalls: UnsignedCall[] = [
    { to: '0x1111111111111111111111111111111111111a', data: '0xaa', value: '0', chainId: SEPOLIA },
    { to: '0x2222222222222222222222222222222222222b', data: '0xbb', value: '0', chainId: SEPOLIA },
  ];
  const capable = { [HEX]: { atomic: { status: 'supported' } } };

  beforeEach(() => {
    waitForTransactionReceipt.mockReset();
    waitForTransactionReceipt.mockResolvedValue({ status: 'success' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Builds a stub provider whose `request` dispatches on `args.method`. */
  function stubProvider(handlers: Record<string, (params: unknown[]) => unknown>): {
    provider: Eip1193Provider;
    invocations: { method: string; params?: unknown[] }[];
  } {
    const invocations: { method: string; params?: unknown[] }[] = [];
    const provider: Eip1193Provider = {
      request: vi.fn(async (args: { method: string; params?: unknown[] }) => {
        invocations.push(args);
        const handler = handlers[args.method];
        if (!handler) throw new Error(`stubProvider: unhandled method ${args.method}`);
        return handler(args.params ?? []);
      }),
    };
    return { provider, invocations };
  }

  it('completes a batch when wallet_sendCalls returns a bare string id', async () => {
    const { provider } = stubProvider({
      wallet_getCapabilities: () => capable,
      wallet_sendCalls: () => '0xbatch-bare',
      wallet_getCallsStatus: (params) => {
        // A real wallet expects the id it handed back, unwrapped to a
        // string, in wallet_getCallsStatus's params. Assert on the shape
        // actually received so a regression here fails loudly.
        expect(params[0]).toBe('0xbatch-bare');
        return { status: 200, receipts: [{ transactionHash: '0x111' }, { transactionHash: '0x222' }] };
      },
    });

    const result = await sendCalls(provider, from, SEPOLIA, twoCalls);

    expect(result).toEqual({ txHashes: ['0x111', '0x222'] });
  });

  it('completes a batch when wallet_sendCalls returns { id } (the shape that would have caught the unwrap bug)', async () => {
    const { provider } = stubProvider({
      wallet_getCapabilities: () => capable,
      wallet_sendCalls: () => ({ id: '0xbatch-object' }),
      wallet_getCallsStatus: (params) => {
        // The bug this guards against: passing the raw { id } object
        // through to wallet_getCallsStatus instead of unwrapping it first.
        expect(params[0]).toBe('0xbatch-object');
        return { status: 'CONFIRMED', receipts: [{ transactionHash: '0x333' }] };
      },
    });

    const result = await sendCalls(provider, from, SEPOLIA, twoCalls);

    expect(result).toEqual({ txHashes: ['0x333'] });
  });

  it('falls back to sequential eth_sendTransaction, once per call in order, when the capabilities check rejects', async () => {
    const seenTo: string[] = [];
    const { provider, invocations } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: (params) => {
        const to = (params[0] as { to: string }).to;
        seenTo.push(to);
        return `0xhash-${to}`;
      },
    });

    const result = await sendCalls(provider, from, SEPOLIA, twoCalls);

    expect(seenTo).toEqual(twoCalls.map((call) => call.to));
    expect(result).toEqual({
      txHashes: twoCalls.map((call) => `0xhash-${call.to}`),
    });
    expect(invocations.some((i) => i.method === 'wallet_sendCalls')).toBe(false);
  });

  it('uses the sequential path for a single call even when the wallet can batch', async () => {
    const { provider, invocations } = stubProvider({
      wallet_getCapabilities: () => capable,
      eth_sendTransaction: () => '0xsingle',
    });

    const result = await sendCalls(provider, from, SEPOLIA, [twoCalls[0]]);

    expect(result).toEqual({ txHashes: ['0xsingle'] });
    expect(invocations.some((i) => i.method === 'wallet_sendCalls')).toBe(false);
  });

  it.each([200, 'success', 'CONFIRMED'])('treats status %s from wallet_getCallsStatus as settled', async (status) => {
    const { provider } = stubProvider({
      wallet_getCapabilities: () => capable,
      wallet_sendCalls: () => '0xbatch',
      wallet_getCallsStatus: () => ({ status, receipts: [{ transactionHash: '0xok' }] }),
    });

    const result = await sendCalls(provider, from, SEPOLIA, twoCalls);

    expect(result).toEqual({ txHashes: ['0xok'] });
  });

  it.each([500, 'failure', 'FAILED'])('rejects when wallet_getCallsStatus reports status %s', async (status) => {
    const { provider } = stubProvider({
      wallet_getCapabilities: () => capable,
      wallet_sendCalls: () => '0xbatch',
      wallet_getCallsStatus: () => ({ status }),
    });

    await expect(sendCalls(provider, from, SEPOLIA, twoCalls)).rejects.toThrow(
      'The wallet reported the batch failed',
    );
  });

  it('polls again when the wallet has not settled yet, then resolves once it has', async () => {
    vi.useFakeTimers();

    let pollCount = 0;
    const { provider } = stubProvider({
      wallet_getCapabilities: () => capable,
      wallet_sendCalls: () => '0xbatch',
      wallet_getCallsStatus: () => {
        pollCount += 1;
        if (pollCount === 1) return { status: 'PENDING' };
        return { status: 'CONFIRMED', receipts: [{ transactionHash: '0xdone' }] };
      },
    });

    const resultPromise = sendCalls(provider, from, SEPOLIA, twoCalls);
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await resultPromise;

    expect(pollCount).toBe(2);
    expect(result).toEqual({ txHashes: ['0xdone'] });
  });

  it('does not resolve until every sequential transaction has a receipt', async () => {
    // The bug this pins: eth_sendTransaction resolves on BROADCAST. The
    // hash is real but the transaction is a block away, and the server
    // reads its receipt the moment it is posted -- viem throws
    // TransactionReceiptNotFoundError for a pending one, which surfaces
    // as a 500 and, on the deploy step, strands the row in DRAFT with a
    // deployment in flight. Fake timers stand in for ~12s per block.
    vi.useFakeTimers();

    const events: string[] = [];
    const { provider } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: (params) => {
        const to = (params[0] as { to: string }).to;
        events.push(`broadcast ${to}`);
        return `0xhash-${to}`;
      },
    });
    waitForTransactionReceipt.mockImplementation(async ({ hash }: { hash: string }) => {
      events.push(`awaiting ${hash}`);
      await new Promise((resolve) => setTimeout(resolve, 12_000));
      events.push(`mined ${hash}`);
      return { status: 'success' };
    });

    let settled = false;
    const resultPromise = sendCalls(provider, from, SEPOLIA, twoCalls).then((result) => {
      settled = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    expect(events).toEqual([
      `broadcast ${twoCalls[0].to}`,
      `broadcast ${twoCalls[1].to}`,
      `awaiting 0xhash-${twoCalls[0].to}`,
    ]);

    // First block: one receipt in, the other still pending. Still no hash
    // for the caller to post anywhere.
    await vi.advanceTimersByTimeAsync(12_000);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(12_000);
    await expect(resultPromise).resolves.toEqual({
      txHashes: twoCalls.map((call) => `0xhash-${call.to}`),
    });
    expect(events).toEqual([
      `broadcast ${twoCalls[0].to}`,
      `broadcast ${twoCalls[1].to}`,
      `awaiting 0xhash-${twoCalls[0].to}`,
      `mined 0xhash-${twoCalls[0].to}`,
      `awaiting 0xhash-${twoCalls[1].to}`,
      `mined 0xhash-${twoCalls[1].to}`,
    ]);
  });

  it('rejects instead of returning the hash when a receipt says the transaction reverted', async () => {
    // A hash posted for a reverted transaction is worse than an error:
    // recordRegistered would mark a name REGISTERED that nobody owns.
    const { provider } = stubProvider({
      wallet_getCapabilities: () => capable,
      eth_sendTransaction: () => '0xreverted',
    });
    waitForTransactionReceipt.mockResolvedValue({ status: 'reverted' });

    await expect(sendCalls(provider, from, SEPOLIA, [twoCalls[0]])).rejects.toThrow(
      /reverted on Sepolia/i,
    );
  });

  it('waits on the batched path too, where the wallet only claims the batch settled', async () => {
    const { provider } = stubProvider({
      wallet_getCapabilities: () => capable,
      wallet_sendCalls: () => '0xbatch',
      wallet_getCallsStatus: () => ({
        status: 200,
        receipts: [{ transactionHash: '0x111' }, { transactionHash: '0x222' }],
      }),
    });

    const result = await sendCalls(provider, from, SEPOLIA, twoCalls);

    expect(result).toEqual({ txHashes: ['0x111', '0x222'] });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0x111' });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: '0x222' });
  });

  it('never asks for a receipt when there was nothing to send', async () => {
    const { provider } = stubProvider({});
    await expect(sendCalls(provider, from, SEPOLIA, [])).resolves.toEqual({ txHashes: [] });
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it('rejects with a clear error when wallet_sendCalls returns neither a string nor { id }', async () => {
    const { provider } = stubProvider({
      wallet_getCapabilities: () => capable,
      wallet_sendCalls: () => ({ unexpected: true }),
    });

    await expect(sendCalls(provider, from, SEPOLIA, twoCalls)).rejects.toThrow();
  });

  it('confirms against the chain the calls were sent on, not always Sepolia', async () => {
    // This module is shared between ENS registration (Sepolia) and payroll
    // (Arc). A confirmation client built for the wrong chain waits forever
    // for a receipt that will never appear there.
    const { provider } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: () => '0xarc-hash',
    });

    await sendCalls(provider, from, arcTestnet.id, [
      { to: twoCalls[0].to, data: twoCalls[0].data, value: '0', chainId: arcTestnet.id },
    ]);

    const arcClientChain = createPublicClientChains.find((chain) => chain.id === arcTestnet.id);
    expect(arcClientChain).toBeDefined();
    expect(arcClientChain?.id).not.toBe(SEPOLIA);
  });

  it('throws PartialSendError carrying only the confirmed hash when a later signature is rejected', async () => {
    const threeCalls: UnsignedCall[] = [
      ...twoCalls,
      { to: '0x3333333333333333333333333333333333333c', data: '0xcc', value: '0', chainId: SEPOLIA },
    ];
    let calls = 0;
    const { provider } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: (params) => {
        calls += 1;
        if (calls === 2) throw new Error('user rejected the request');
        const to = (params[0] as { to: string }).to;
        return `0xhash-${to}`;
      },
    });

    const error = await sendCalls(provider, from, SEPOLIA, threeCalls).catch((cause) => cause);

    expect(error).toBeInstanceOf(PartialSendError);
    expect((error as PartialSendError).confirmed).toEqual([
      { index: 0, txHash: `0xhash-${twoCalls[0].to}` },
    ]);
  });

  it('keeps the confirmed hash when an earlier transaction reverted and a later one was rejected', async () => {
    // Arc's gas asset is USDC, so a run that drains the wallet REVERTS
    // rather than being refused. Confirming all-or-nothing threw on that
    // revert and took the already-confirmed hash with it -- the caller
    // reported nothing, the run reloaded with every item still pending,
    // and one click re-paid the person who had already been paid.
    const threeCalls: UnsignedCall[] = [
      ...twoCalls,
      { to: '0x3333333333333333333333333333333333333c', data: '0xcc', value: '0', chainId: SEPOLIA },
    ];
    let sent = 0;
    const { provider } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: (params) => {
        sent += 1;
        if (sent === 3) throw new Error('user rejected the request');
        return `0xhash-${(params[0] as { to: string }).to}`;
      },
    });
    const first = `0xhash-${twoCalls[0].to}`;
    const second = `0xhash-${twoCalls[1].to}`;
    waitForTransactionReceipt.mockImplementation(({ hash }: { hash: string }) =>
      Promise.resolve({ status: hash === second ? 'reverted' : 'success' }),
    );

    const error = await sendCalls(provider, from, SEPOLIA, threeCalls).catch((cause) => cause);

    expect(error).toBeInstanceOf(PartialSendError);
    expect((error as PartialSendError).confirmed).toEqual([{ index: 0, txHash: first }]);
    expect((error as PartialSendError).unconfirmed).toEqual([{ index: 1, txHash: second }]);
  });

  it('keeps the confirmed hashes when every call was signed but a later one reverted', async () => {
    // Same loss, reached without any rejection at all: two transfers land,
    // the third reverts, and an all-or-nothing wait discarded the first two.
    const { provider } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: (params) => `0xhash-${(params[0] as { to: string }).to}`,
    });
    const second = `0xhash-${twoCalls[1].to}`;
    waitForTransactionReceipt.mockImplementation(({ hash }: { hash: string }) =>
      Promise.resolve({ status: hash === second ? 'reverted' : 'success' }),
    );

    const error = await sendCalls(provider, from, SEPOLIA, twoCalls).catch((cause) => cause);

    expect(error).toBeInstanceOf(PartialSendError);
    expect((error as PartialSendError).confirmed).toEqual([
      { index: 0, txHash: `0xhash-${twoCalls[0].to}` },
    ]);
  });

  it('keeps a confirmed hash when a later receipt could not be read at all', async () => {
    // A receipt read that throws is not evidence of a revert, and it is
    // certainly not a reason to forget the transfer that did confirm.
    const { provider } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: (params) => `0xhash-${(params[0] as { to: string }).to}`,
    });
    const second = `0xhash-${twoCalls[1].to}`;
    waitForTransactionReceipt.mockImplementation(({ hash }: { hash: string }) =>
      hash === second
        ? Promise.reject(new Error('rpc unavailable'))
        : Promise.resolve({ status: 'success' }),
    );

    const error = await sendCalls(provider, from, SEPOLIA, twoCalls).catch((cause) => cause);

    expect(error).toBeInstanceOf(PartialSendError);
    expect((error as PartialSendError).confirmed).toEqual([
      { index: 0, txHash: `0xhash-${twoCalls[0].to}` },
    ]);
  });

  it('pairs each confirmed hash with ITS OWN call when a middle call reverts', async () => {
    // The one that matters. A confirmed list of length 1 is trivially a
    // prefix and proves nothing; this one has a HOLE in the middle.
    //
    // Employee 2's transfer reverts -- a frozen or blocked recipient is an
    // ordinary thing on a regulated stablecoin -- while 1 and 3 confirm.
    // Zipping the confirmed hashes against the items by rank reports
    // employee 3's hash against employee 2: a real, successful transaction,
    // whose Transfer log pays a stranger, so the server writes it to
    // employee 2's row as FAILED with a working explorer link to someone
    // else's money. Employee 3 is never reported at all, stays pending, and
    // the next press pays them a SECOND time.
    const threeCalls: UnsignedCall[] = [
      ...twoCalls,
      { to: '0x3333333333333333333333333333333333333c', data: '0xcc', value: '0', chainId: SEPOLIA },
    ];
    const hashes = threeCalls.map((call) => `0xhash-${call.to}`);
    const { provider } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: (params) => `0xhash-${(params[0] as { to: string }).to}`,
    });
    waitForTransactionReceipt.mockImplementation(({ hash }: { hash: string }) =>
      Promise.resolve({ status: hash === hashes[1] ? 'reverted' : 'success' }),
    );

    const error = await sendCalls(provider, from, SEPOLIA, threeCalls).catch((cause) => cause);

    expect(error).toBeInstanceOf(PartialSendError);
    const partial = error as PartialSendError;
    expect(partial.confirmed).toEqual([
      { index: 0, txHash: hashes[0] },
      { index: 2, txHash: hashes[2] },
    ]);

    // The page-facing mapping: exactly what the run page builds from this
    // error before posting it to the server.
    const itemIds = ['item1', 'item2', 'item3'];
    const paired = pairConfirmed(itemIds, partial.confirmed);

    expect(paired).toEqual([
      { call: 'item1', txHash: hashes[0] },
      { call: 'item3', txHash: hashes[2] },
    ]);
    expect(paired.some((entry) => entry.call === 'item2')).toBe(false);
  });

  it('never pairs a call the caller did not track', async () => {
    // An index past the end of the caller's own list is dropped rather
    // than paired with undefined.
    expect(pairConfirmed(['item1'], [{ index: 3, txHash: '0xstray' }])).toEqual([]);
  });

  it('rethrows the original error, not PartialSendError, when the first signature is rejected', async () => {
    const original = new Error('user rejected the request');
    const { provider } = stubProvider({
      wallet_getCapabilities: () => {
        throw new Error('wallet does not implement wallet_getCapabilities');
      },
      eth_sendTransaction: () => {
        throw original;
      },
    });

    const error = await sendCalls(provider, from, SEPOLIA, twoCalls).catch((cause) => cause);

    expect(error).toBe(original);
    expect(error).not.toBeInstanceOf(PartialSendError);
  });
});
