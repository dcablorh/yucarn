'use client';

import { useWallets } from '@privy-io/react-auth';
import { useCallback, useEffect, useState } from 'react';
import { sepolia } from 'viem/chains';
import { useEnsApi, type Registration, type UnsignedCall } from '@/lib/ens';
import { sendCalls, PartialSendError } from '@/lib/wallet-batch';
import { sepoliaClient } from '@/lib/sepolia';
import { Card } from '@/components/card';
import { Button } from '@/components/button';
import { Alert } from '@/components/alert';
import { Notice } from '@/components/notice';
import { cx } from '@/components/cx';

type StepKey = 'deploy' | 'commit' | 'register';

const STEPS: { key: StepKey; title: string; detail: string }[] = [
  { key: 'deploy', title: 'Create your registry', detail: 'One transaction on Sepolia.' },
  {
    key: 'commit',
    title: 'Reserve the name',
    detail: 'Mints the test fee, approves it, and commits. Then a sixty-second wait ENS requires.',
  },
  {
    key: 'register',
    title: 'Register and set records',
    detail: 'Claims the name and writes your payout records.',
  },
];

function currentStep(registration: Registration): StepKey {
  if (registration.status === 'DRAFT') return 'deploy';
  if (registration.status === 'REGISTRY_DEPLOYED') return 'commit';
  return 'register';
}

/** Seconds remaining until `target`, floored at zero. */
function useCountdown(targetSecs: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    targetSecs === null ? 0 : Math.max(0, targetSecs - Math.floor(Date.now() / 1000)),
  );

  useEffect(() => {
    if (targetSecs === null) return;
    const tick = () =>
      setRemaining(Math.max(0, targetSecs - Math.floor(Date.now() / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetSecs]);

  return remaining;
}

export function RegistrationFlow({
  registration,
  initialCalls,
  onChange,
}: {
  registration: Registration;
  initialCalls: UnsignedCall[];
  onChange: (registration: Registration) => void;
}) {
  const { wallets } = useWallets();
  const api = useEnsApi();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pendingCalls, setPendingCalls] = useState<UnsignedCall[]>(initialCalls);

  const step = currentStep(registration);
  // The countdown runs off readyAtSecs, which the server derived from the
  // Sepolia BLOCK the commit landed in. It is a real deadline, not a
  // spinner — and the server re-checks it before it will hand over the
  // register call, so a fast local clock buys nothing.
  const remaining = useCountdown(step === 'register' ? registration.readyAtSecs : null);
  const wallet = wallets[0];
  const walletAddress = wallet?.address;

  // Every step here is a Sepolia transaction, and gas is Sepolia ETH the
  // merchant has to already hold — the registration fee is not the
  // problem, ENS mints that test USDC for free. Spec §3.4 asks for a
  // merchant with an empty account to be told so plainly rather than
  // finding out when the wallet refuses to sign.
  const [gas, setGas] = useState<'checking' | 'funded' | 'empty'>('checking');

  /**
   * Reads the balance once. This is not a poll and must not become one:
   * every transition in this flow is a button press, and a balance that
   * refreshes itself on a timer would be the one thing on this page
   * talking to the network unprompted.
   *
   * A read that fails is treated as funded. The check exists to give a
   * better message, so a flaky public RPC must never be what stops
   * someone registering a name — the wallet is still the real gate.
   */
  const checkGas = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const balance = await sepoliaClient().getBalance({
        address: walletAddress as `0x${string}`,
      });
      setGas(balance === 0n ? 'empty' : 'funded');
    } catch {
      setGas('funded');
    }
  }, [walletAddress]);

  useEffect(() => {
    // Async: every setGas lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void checkGas();
  }, [checkGas]);

  const recheckGas = () => {
    setGas('checking');
    void checkGas();
  };

  const noGas = gas === 'empty';

  async function run(
    label: string,
    calls: UnsignedCall[],
    then: (txHashes: string[]) => Promise<Registration>,
  ) {
    if (!wallet) {
      setError('Connect a wallet first.');
      return;
    }
    setError(null);
    setBusy(label);
    try {
      // ENS is on Sepolia. Arc remains the settlement chain and the
      // default; this switch is scoped to the registration.
      await wallet.switchChain(sepolia.id);
      const provider = await wallet.getEthereumProvider();
      const { txHashes } = await sendCalls(provider, wallet.address, sepolia.id, calls);
      onChange(await then(txHashes));
    } catch (cause) {
      setError(cause instanceof PartialSendError ? describePartialSend(cause) : cause);
    } finally {
      setBusy(null);
    }
  }

  /**
   * Rebuilds the calls for the current step.
   *
   * The unsigned calls live in page memory, not the database, so a reload
   * mid-registration arrives with none. Re-deriving them is cheap and
   * keeps the flow resumable, which is the whole point of persisting a
   * row. Which endpoint that means depends on how far the row got:
   *
   *  - Once the registry is deployed, `deployTxHash` is stored, and
   *    re-posting it to `recordDeployed` re-derives the mint/approve/
   *    commit batch from the on-chain deployment.
   *  - Before that — the row is still DRAFT — there is no tx hash yet to
   *    re-post, so the deploy call itself is re-derived instead. It is
   *    deterministic from the registration id (same id, same salt, same
   *    calldata), so asking for it again is safe even if step 1 was
   *    never actually signed.
   *
   * Merchant-initiated, like every other transition here — nothing polls.
   */
  async function recoverCalls() {
    setError(null);
    setBusy('recover');
    try {
      const next = registration.deployTxHash
        ? await api.recordDeployed(registration.deployTxHash)
        : await api.getDeployCalls();
      setPendingCalls(next.calls);
      onChange(next);
    } catch (cause) {
      setError(cause instanceof PartialSendError ? describePartialSend(cause) : cause);
    } finally {
      setBusy(null);
    }
  }

  const deploy = () =>
    run('deploy', pendingCalls, async (txHashes) => {
      const next = await api.recordDeployed(txHashes[0]);
      setPendingCalls(next.calls);
      return next;
    });

  const commit = () =>
    run('commit', pendingCalls, async (txHashes) =>
      // The commit is the last call in the batch, so its hash is the one
      // the server needs to read a block timestamp from.
      api.recordCommitted(txHashes[txHashes.length - 1]),
    );

  const register = async () => {
    if (!wallet) {
      setError('Connect a wallet first.');
      return;
    }
    setError(null);
    setBusy('register');
    try {
      const prepared = await api.getRegisterCalls();
      await wallet.switchChain(sepolia.id);
      const provider = await wallet.getEthereumProvider();
      const { txHashes } = await sendCalls(
        provider,
        wallet.address,
        sepolia.id,
        prepared.calls,
      );
      onChange(await api.recordRegistered(txHashes[0], txHashes[1]));
    } catch (cause) {
      setError(cause instanceof PartialSendError ? describePartialSend(cause) : cause);
      // A commitment older than 24 hours is reset to REGISTRY_DEPLOYED by
      // the server before getRegisterCalls refuses it, so the row this
      // page is holding is now stale. Re-read it on the same button press
      // and the flow drops back to the commit step, where the merchant can
      // commit again — otherwise the only live button is a register that
      // can now do nothing but fail. Merchant-initiated, not a poll.
      try {
        const fresh = await api.getRegistration();
        if (fresh) onChange(fresh);
      } catch {
        // The error the merchant actually pressed for is the one to show.
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <Card>
        <p className="text-label uppercase text-muted">Claiming</p>
        <p className="mt-2 font-mono text-title">{registration.name}</p>
      </Card>

      {noGas && (
        <Notice className="mt-6">
          <p className="font-medium">This wallet has no Sepolia ETH.</p>
          <p className="mt-1">
            Each step below is a transaction on Sepolia, and transactions cost gas. The name
            itself is free — ENS mints the test USDC that pays for it. Send some Sepolia ETH to{' '}
            <span className="font-mono">{walletAddress}</span> from a faucet, then check again.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={recheckGas}
            disabled={busy !== null}
            className="mt-3"
          >
            Check again
          </Button>
        </Notice>
      )}

      <ol className="mt-6 space-y-3">
        {STEPS.map((entry, index) => {
          const done = STEPS.findIndex((s) => s.key === step) > index;
          const active = entry.key === step;

          return (
            <li key={entry.key}>
              <Card className={active ? 'ring-2 ring-accent' : undefined}>
                <div className="flex items-start gap-3">
                  {/*
                    "Done" gets its own filled glyph rather than a recoloured
                    dot: a colour-blind merchant, or a monochrome display,
                    still needs to tell a completed step from one that is
                    merely active or pending. Active and pending stay dots —
                    filled vs. hollow is its own non-colour cue between them.
                  */}
                  {done ? (
                    <span
                      className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-pill bg-positive-ink text-white"
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 16 16"
                        className="h-2.5 w-2.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3.5 8.5l3 3 6-7" />
                      </svg>
                    </span>
                  ) : (
                    <span
                      aria-hidden="true"
                      className={cx(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-pill',
                        active ? 'bg-accent' : 'border border-line-strong',
                      )}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={done || active ? 'font-medium' : 'text-muted'}>
                      <span className="sr-only">
                        {done ? 'Completed: ' : active ? 'In progress: ' : 'Not started: '}
                      </span>
                      {entry.title}
                    </p>
                    <p className="mt-1 text-muted">{entry.detail}</p>

                    {active && entry.key === 'deploy' && (
                      pendingCalls.length > 0 ? (
                        <Button onClick={deploy} disabled={busy !== null || noGas} className="mt-4">
                          {busy === 'deploy' ? 'Confirm in your wallet…' : 'Create registry'}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={recoverCalls}
                          disabled={busy !== null}
                          className="mt-4"
                        >
                          {busy === 'recover' ? 'Picking up where you left off…' : 'Continue'}
                        </Button>
                      )
                    )}

                    {active && entry.key === 'commit' && (
                      pendingCalls.length > 0 ? (
                        <Button onClick={commit} disabled={busy !== null || noGas} className="mt-4">
                          {busy === 'commit' ? 'Confirm in your wallet…' : 'Reserve the name'}
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={recoverCalls}
                          disabled={busy !== null}
                          className="mt-4"
                        >
                          {busy === 'recover' ? 'Picking up where you left off…' : 'Continue'}
                        </Button>
                      )
                    )}

                    {active && entry.key === 'register' && (
                      <>
                        {remaining > 0 ? (
                          <p className="mt-4 font-mono text-subhead">
                            {remaining}s
                            <span className="ml-2 font-sans text-muted">
                              until ENS will accept the registration
                            </span>
                          </p>
                        ) : (
                          <Button
                            onClick={register}
                            disabled={busy !== null || noGas}
                            className="mt-4"
                          >
                            {busy === 'register'
                              ? 'Confirm in your wallet…'
                              : `Register ${registration.name}`}
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <Alert error={error} className="mt-4" />

      <p className="mt-6 text-muted">
        Each step is one wallet signature if your wallet supports batching, and a few if it does
        not. You need Sepolia ETH for gas — the name itself is paid for with test USDC that ENS
        mints for you.
      </p>
    </div>
  );
}

/**
 * A partial send needs its own sentence: transactions really were sent, so
 * "You cancelled that step" would be false, and PartialSendError's own
 * message ("2 of the requested calls were sent before the wallet stopped
 * signing") is the module's internal wording, not anything about
 * registering a name. "So you do not repeat them" is the point — the same
 * class of protection as the payment page's rule that no state after
 * signing re-arms the pay button, here stopping a merchant from resending
 * calls that already went through.
 */
function describePartialSend(cause: PartialSendError): string {
  const sent = cause.confirmed.length;
  if (sent === 0) {
    return 'That step stopped partway. A transaction was sent but has not confirmed — check your wallet before trying this step again.';
  }
  return `That step stopped partway: ${sent} transaction${sent === 1 ? '' : 's'} already went through, and the rest were not signed. Reload this page before trying again so you do not repeat them.`;
}
