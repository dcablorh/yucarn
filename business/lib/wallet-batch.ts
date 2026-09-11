import { createPublicClient, http, type Chain, type Hex, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import type { UnsignedCall } from './ens';
import { arcTestnet } from './chains';

/** The slice of EIP-1193 this module needs. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface SendResult {
  txHashes: string[];
}

/**
 * A call that reached the chain, and WHICH call it was.
 *
 * `index` is the position in the `calls` array handed to `sendCalls`. It is
 * carried explicitly because the confirmed calls are not a prefix and not a
 * contiguous run: a middle call that reverts, or one whose receipt cannot be
 * read, leaves a hole. Anything that pairs a hash with a call by counting
 * ranks instead of reading this index will pair employee 2 with employee
 * 3's transaction — the hash is real and the transaction succeeded, so
 * nothing downstream can tell it is the wrong one.
 */
export interface SentCall {
  /** Position in the `calls` array passed to `sendCalls`. */
  readonly index: number;
  readonly txHash: string;
}

/**
 * Pairs each confirmed call with whatever the caller is tracking that call
 * by — a payroll item id, a registration step, anything positional.
 *
 * This exists so the pairing is done in ONE place, by index, rather than
 * re-derived by every caller from the shape of `confirmed`. Zipping those
 * two lists by rank is correct only when nothing in the middle failed, and
 * silently wrong the moment something does.
 */
export function pairConfirmed<T>(
  calls: readonly T[],
  confirmed: readonly SentCall[],
): { call: T; txHash: string }[] {
  const paired: { call: T; txHash: string }[] = [];
  for (const sent of confirmed) {
    if (sent.index < 0 || sent.index >= calls.length) continue;
    paired.push({ call: calls[sent.index], txHash: sent.txHash });
  }
  return paired;
}

/**
 * Thrown by the sequential path when some calls broadcast and confirmed
 * before a later one failed. `confirmed` holds exactly the ones that are
 * mined and successful — never merely broadcast — each carrying the index
 * of the call it belongs to.
 *
 * Discarding those hashes would be worse than the failure itself: the
 * caller has no record that money already moved, and a caller that
 * responds to a failure by resending the same calls would pay twice.
 *
 * There is deliberately no bare `txHashes: string[]` here. A compacted list
 * of hashes invites being zipped against the caller's own list by rank,
 * which is right until one call in the middle reverts and then quietly pays
 * the wrong person's hash to the wrong person's row. Use `pairConfirmed`.
 *
 * Existing callers that only read `.message` (ENS registration) keep
 * working unchanged.
 */
export class PartialSendError extends Error {
  constructor(
    readonly confirmed: SentCall[],
    readonly cause: unknown,
    /**
     * Broadcast, but did NOT confirm: reverted, or its receipt could not be
     * read. Kept apart from `confirmed` because these must never be posted
     * anywhere as payments — but the merchant still has to be told a
     * transaction of theirs is out there in an unknown state.
     */
    readonly unconfirmed: SentCall[] = [],
  ) {
    super(
      `${confirmed.length} of the requested calls were sent before the wallet stopped signing.` +
        (unconfirmed.length > 0
          ? ` ${unconfirmed.length} more ${unconfirmed.length === 1 ? 'was' : 'were'} sent but did not confirm.`
          : ''),
    );
    this.name = 'PartialSendError';
  }
}

/**
 * Confirmation must happen on the chain the calls were actually sent to.
 * This module is shared between ENS registration on Sepolia and payroll on
 * Arc, so it can never assume one chain — a client built for the wrong one
 * will wait forever for a receipt that will never appear there.
 *
 * Cached per chain: building a transport is cheap but pointless work to
 * repeat on every call, and one client per chain keeps viem's request
 * de-duplication and block cache working across calls to that chain.
 */
const KNOWN_CHAINS: Record<number, Chain> = {
  [sepolia.id]: sepolia,
  [arcTestnet.id]: arcTestnet,
};

const clients = new Map<number, PublicClient>();

function clientFor(chainId: number): PublicClient {
  const cached = clients.get(chainId);
  if (cached) return cached;

  const chain = KNOWN_CHAINS[chainId];
  if (!chain) {
    throw new Error(
      `wallet-batch: no confirmation client configured for chain ${chainId}`,
    );
  }

  const client = createPublicClient({ chain, transport: http() });
  clients.set(chainId, client);
  return client;
}

/**
 * Whether this wallet will batch for this chain.
 *
 * Chain support for EIP-7702 is necessary but not sufficient: wallet_sendCalls
 * is a wallet capability, and Sepolia supporting 7702 says nothing about
 * whether the connected wallet implements EIP-5792. Both Arc and Sepolia
 * support 7702 (verified 2026-09-09), so this check is entirely about the
 * wallet.
 *
 * Anything unrecognised returns false. Wallets are third-party code and a
 * surprising shape must degrade to sequential signing, never throw.
 */
export function supportsBatching(capabilities: unknown, chainId: number): boolean {
  if (typeof capabilities !== 'object' || capabilities === null) return false;

  const key = `0x${chainId.toString(16)}`;
  const forChain = (capabilities as Record<string, unknown>)[key];
  if (typeof forChain !== 'object' || forChain === null) return false;

  const atomic = (forChain as Record<string, unknown>).atomic;
  if (typeof atomic !== 'object' || atomic === null) return false;

  const status = (atomic as Record<string, unknown>).status;
  return status === 'supported' || status === 'ready';
}

/**
 * Sends a group of prepared calls, batched into one signature where the
 * wallet allows it and signed one at a time where it does not.
 *
 * Used by ENS registration on Sepolia and by payroll on Arc — the module
 * takes a chainId and has no opinion about which chain it is on.
 *
 * The sequential path is a live code path, not a contingency: most wallets
 * still do not implement EIP-5792, and a merchant on one of them must
 * still be able to register a name. Order is preserved either way, because
 * approve must precede commit and register must precede setting records.
 */
export async function sendCalls(
  provider: Eip1193Provider,
  from: string,
  chainId: number,
  calls: UnsignedCall[],
): Promise<SendResult> {
  if (calls.length === 0) return { txHashes: [] };

  let capabilities: unknown;
  try {
    capabilities = await provider.request({
      method: 'wallet_getCapabilities',
      params: [from],
    });
  } catch {
    // An unimplemented method rejects. That is a "no", not a failure.
    capabilities = undefined;
  }

  if (calls.length > 1 && supportsBatching(capabilities, chainId)) {
    const response = await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          version: '2.0.0',
          chainId: `0x${chainId.toString(16)}`,
          from,
          atomicRequired: true,
          calls: calls.map((call) => ({ to: call.to, data: call.data, value: '0x0' })),
        },
      ],
    });

    const txHashes = await waitForCallsStatus(provider, callsId(response));
    return { txHashes: await confirmMined(txHashes, chainId) };
  }

  const txHashes: string[] = [];
  for (const call of calls) {
    try {
      const hash = (await provider.request({
        method: 'eth_sendTransaction',
        params: [{ from, to: call.to, data: call.data, value: '0x0' }],
      })) as string;
      txHashes.push(hash);
    } catch (cause) {
      // The batched path is atomic — nothing above ever collects a partial
      // set of hashes for it, so it needs no equivalent handling. Here,
      // each iteration is its own on-chain transaction: if an earlier one
      // already broadcast, real funds already moved, and discarding that
      // hash on a later failure would leave the caller believing nothing
      // happened when in fact it must not resend those calls.
      if (txHashes.length > 0) {
        // Every hash is checked on its own. Confirming them all-or-nothing
        // meant one reverted transaction threw away every hash beside it,
        // and the caller — told only that something failed — reported none
        // of them and re-paid the people they had just paid.
        const { confirmed, unconfirmed } = await settle(txHashes, chainId);
        throw new PartialSendError(confirmed, cause, unconfirmed);
      }
      throw cause;
    }
  }
  // The same rule as the catch above, for the case where every call was
  // signed but a later one reverted on chain: hashes that DID confirm are
  // never discarded, because discarding them is what makes a caller resend
  // calls that already moved money. A run where nothing confirmed keeps
  // throwing the plain revert — there is no partial result to carry.
  const settled = await settle(txHashes, chainId);
  if (settled.unconfirmed.length === 0) {
    // Nothing failed, so nothing was compacted: this is still one hash per
    // call, in call order, which is what SendResult promises.
    return { txHashes: settled.confirmed.map((sent) => sent.txHash) };
  }
  if (settled.confirmed.length === 0) throw settled.failure;
  throw new PartialSendError(settled.confirmed, settled.failure, settled.unconfirmed);
}

/**
 * Waits for each transaction independently and sorts the hashes into the
 * ones that are mined and successful and the ones that are not.
 *
 * eth_sendTransaction resolves on BROADCAST, not on inclusion — the hash
 * is real, the transaction is still ~12s from a block. Every endpoint
 * these hashes are posted to reads a receipt immediately (the deploy step
 * needs its ProxyDeployed log, the commit step its block timestamp), and
 * viem's getTransactionReceipt THROWS TransactionReceiptNotFoundError for
 * a pending transaction rather than returning null. Posting early is
 * therefore a 500, and for the deploy step an unrecoverable one.
 *
 * Independently, and not all-or-nothing, because the hashes are the only
 * record that money moved. Arc's gas asset is USDC, so a run that drains
 * the wallet REVERTS rather than being refused — and an all-or-nothing
 * wait threw on that revert and took every already-confirmed hash with
 * it. The caller then reported nothing, the run reloaded with every item
 * still pending, and one click re-paid the people who had already been
 * paid.
 *
 * This is not a fallback-wallet edge case. sendCalls routes a single call
 * down the sequential path deliberately, and the deploy step is always a
 * single call, so every wallet arrives here.
 *
 * The batched path is waited on too. wallet_getCallsStatus reporting a
 * batch settled is the wallet's claim, not a receipt we have read, and
 * waiting on an already-mined transaction returns its receipt
 * immediately — so the second wait costs a round trip and buys the same
 * guarantee on both paths.
 */
interface Settlement {
  confirmed: SentCall[];
  unconfirmed: SentCall[];
  /** Why the first unconfirmed hash is unconfirmed. */
  failure: unknown;
}

/**
 * `txHashes[i]` is the hash of `calls[i]`: the sequential loop broadcasts in
 * order and stops at the first failure, so it is always a prefix of the
 * calls. That index is what makes it into `SentCall`, and it is the ONLY
 * thing that still identifies a call once the successes and failures have
 * been sorted into two lists.
 */
async function settle(txHashes: string[], chainId: number): Promise<Settlement> {
  const client = clientFor(chainId);
  const confirmed: SentCall[] = [];
  const unconfirmed: SentCall[] = [];
  let failure: unknown;

  for (const [index, txHash] of txHashes.entries()) {
    try {
      const receipt = await client.waitForTransactionReceipt({ hash: txHash as Hex });
      if (receipt.status === 'success') {
        confirmed.push({ index, txHash });
        continue;
      }
      unconfirmed.push({ index, txHash });
      failure ??= new Error(
        `That transaction reverted on ${client.chain?.name ?? `chain ${chainId}`} (${txHash}). Nothing was recorded.`,
      );
    } catch (cause) {
      // Could not read the receipt at all. Not a success, so it is never
      // handed back as one; not proof of a revert either.
      unconfirmed.push({ index, txHash });
      failure ??= cause;
    }
  }

  return { confirmed, unconfirmed, failure };
}

/**
 * All-or-nothing confirmation, for the atomic batched path where a partial
 * result is not a thing that can happen.
 */
async function confirmMined(txHashes: string[], chainId: number): Promise<string[]> {
  const { confirmed, unconfirmed, failure } = await settle(txHashes, chainId);
  if (unconfirmed.length > 0) throw failure;
  return confirmed.map((sent) => sent.txHash);
}

/**
 * Extracts a string batch id from a wallet_sendCalls response.
 *
 * The EIP-5792 v2.0.0 wire format returns { id, capabilities? }, but older
 * and other wallets still return a bare string id (viem's sendCalls has the
 * same special case). Passing the un-normalised response straight into
 * wallet_getCallsStatus is exactly the kind of wallet inconsistency this
 * module exists to absorb, so it is normalised once, here, rather than left
 * for every caller to get right.
 */
function callsId(response: unknown): string {
  if (typeof response === 'string') return response;
  if (
    typeof response === 'object' &&
    response !== null &&
    typeof (response as Record<string, unknown>).id === 'string'
  ) {
    return (response as { id: string }).id;
  }
  throw new Error('wallet_sendCalls returned an unrecognised response shape');
}

/**
 * Polls wallet_getCallsStatus until the batch settles.
 *
 * This polls a wallet, not our own state machine — the constraint that
 * registration never runs on a timer is about our transitions, each of
 * which stays merchant-initiated.
 */
async function waitForCallsStatus(provider: Eip1193Provider, id: string): Promise<string[]> {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const result = (await provider.request({
      method: 'wallet_getCallsStatus',
      params: [id],
    })) as { status?: number | string; receipts?: { transactionHash: string }[] } | null;

    const status = result?.status;
    const settled = status === 200 || status === 'success' || status === 'CONFIRMED';
    if (settled && result?.receipts?.length) {
      return result.receipts.map((receipt) => receipt.transactionHash);
    }
    if (status === 500 || status === 'failure' || status === 'FAILED') {
      throw new Error('The wallet reported the batch failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error('Timed out waiting for the wallet to confirm the batch');
}
