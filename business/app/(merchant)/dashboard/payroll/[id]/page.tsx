'use client';

import Link from 'next/link';
import { useWallets, type ConnectedWallet } from '@privy-io/react-auth';
import { use, useCallback, useEffect, useState } from 'react';
import {
  usePayrollApi,
  type PayrollBatch,
  type PayrollItem,
  type UnpayableEmployee,
} from '@/lib/payroll';
import { ApiError } from '@/lib/api';
import {
  sendCalls,
  supportsBatching,
  pairConfirmed,
  PartialSendError,
} from '@/lib/wallet-batch';
import { arcTestnet, ARC_EXPLORER_URL } from '@/lib/chains';
import { formatUsdc } from '@/lib/format';
import { Card } from '@/components/card';
import { Badge, TONE } from '@/components/badge';
import { Button, linkClass } from '@/components/button';
import { Alert } from '@/components/alert';
import { EmptyState } from '@/components/empty-state';
import { Notice } from '@/components/notice';
import { Figure } from '@/components/figure';

/**
 * The statuses a run can be sent from. PARTIAL and FAILED are re-entrant
 * because the server hands back calls for the PENDING items only — that is
 * the way back for a payment it could not verify the first time.
 */
const RETRYABLE: string[] = ['DRAFT', 'PARTIAL', 'FAILED'];

/**
 * Same tone vocabulary as Badge's TONE (components/badge.tsx), keyed by
 * batch status. Precedent set on invoices/[id]/page.tsx.
 */
const STATUS_TONE: Record<string, string> = {
  DRAFT: TONE.neutral,
  EXECUTING: TONE.progress,
  COMPLETED: TONE.positive,
  PARTIAL: TONE.caution,
  FAILED: TONE.negative,
};

/**
 * A step marker is a 2px dot, not a padded pill, so it takes the solid
 * "-ink" shade each tone uses for its text, rather than the wash+ring pair
 * Badge composes around it. Precedent set on invoices/[id]/page.tsx.
 */
const MARKER: Record<string, string> = {
  PENDING: 'bg-neutral-ink',
  PAID: 'bg-positive-ink',
  FAILED: 'bg-negative-ink',
};

export default function PayrollRunPage(props: PageProps<'/dashboard/payroll/[id]'>) {
  const { id } = use(props.params);
  const payroll = usePayrollApi();
  const { wallets } = useWallets();

  const [batch, setBatch] = useState<PayrollBatch | null>(null);
  const [error, setError] = useState<unknown>(null);
  // loading: a request is in flight. loaded: a request has actually
  // succeeded (or definitively come back "not found") — set only inside
  // the try/404 branch, never in a finally, so a failed fetch cannot be
  // read as "there's nothing here".
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [signatureCount, setSignatureCount] = useState<number | null>(null);
  const [unpayable, setUnpayable] = useState<UnpayableEmployee[]>([]);

  const load = useCallback(async () => {
    try {
      setBatch(await payroll.get(id));
      setLoaded(true);
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        // The fetch completed and definitively found nothing — a
        // mistyped or deleted batch id — which is not the same as a
        // retryable failure.
        setBatch(null);
        setLoaded(true);
        setError(null);
      } else {
        setError(cause);
      }
    } finally {
      setLoading(false);
    }
  }, [payroll, id]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // The same suppression every sibling page carries. (An earlier comment
    // here claimed the rule did not fire on this component; it does — that
    // depended on whether the React Compiler bailed out of this file, which
    // an unrelated edit changed.)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // The server can exclude an employee from a run for a reason the /new
  // page's chain filter does not model (§ silent-skip is forbidden). There
  // is no PayrollItem row for them, so nothing on this page would otherwise
  // say why they are missing. /new stashes the server's exclusion list in
  // sessionStorage, keyed by this batch's id, for exactly this one read —
  // a one-time pickup on arrival, not a poll, and cleared immediately so a
  // later revisit of this page does not show stale data.
  useEffect(() => {
    try {
      const key = `payroll-unpayable:${id}`;
      const raw = sessionStorage.getItem(key);
      if (raw) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUnpayable(JSON.parse(raw) as UnpayableEmployee[]);
        sessionStorage.removeItem(key);
      }
    } catch {
      // Best-effort only — an unreadable or absent entry just means there
      // is nothing to show, not that the batch failed to load.
    }
  }, [id]);

  const wallet = wallets[0];
  const pending = batch?.items.filter((item) => item.status === 'PENDING') ?? [];
  // Pending, but already carrying a hash: the server re-checks these rather
  // than paying them a second time.
  const unverified = pending.filter((item) => item.payTxHash);

  // §5.2 requires the signature count be stated before the merchant
  // commits. It depends on the WALLET, not the chain: one signature if it
  // implements EIP-5792, otherwise one per person. Read once, on demand.
  useEffect(() => {
    if (!wallet || pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const provider = await wallet.getEthereumProvider();
        const capabilities = await provider.request({
          method: 'wallet_getCapabilities',
          params: [wallet.address],
        });
        if (!cancelled) {
          setSignatureCount(
            supportsBatching(capabilities, arcTestnet.id) ? 1 : pending.length,
          );
        }
      } catch {
        // A wallet without the method rejects. That is a "no", so it is
        // one signature per payment.
        if (!cancelled) setSignatureCount(pending.length);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.address, pending.length]);

  async function execute() {
    if (!wallet || !batch) return;
    setError(null);
    setBusy('execute');
    let prepared: Awaited<ReturnType<typeof payroll.getCalls>> | null = null;
    try {
      prepared = await payroll.getCalls(batch.id);
      await wallet.switchChain(arcTestnet.id);
      const provider = await wallet.getEthereumProvider();
      const { txHashes } = await sendCalls(
        provider,
        wallet.address,
        arcTestnet.id,
        prepared.calls,
      );

      // A sequential wallet returns one hash per call, in the order the
      // server listed the items. An atomic batch returns a single hash
      // that paid everyone — hence the fallback, which is the correct
      // answer there rather than a guess.
      //
      // Those are the only two shapes that can be read. Anything in
      // between (a wallet handing back 2 receipts for 5 calls) would
      // report items 3–5 against receipt 1, which verifies false and
      // marks people FAILED who were in fact paid. Better to report
      // nothing and say so: the run stays locked, and a person reads it.
      if (txHashes.length !== 1 && txHashes.length !== prepared.itemIds.length) {
        throw new Error(
          `Your wallet returned ${txHashes.length} receipt${txHashes.length === 1 ? '' : 's'} for ${prepared.itemIds.length} payments, so we cannot tell which payment each one belongs to. Nothing was recorded — check this run's receipts on Arc before trying again.`,
        );
      }

      const results = prepared.itemIds.map((itemId, index) => ({
        itemId,
        txHash: txHashes[index] ?? txHashes[0],
      }));
      setBatch(await payroll.reportExecuted(batch.id, results));
    } catch (cause) {
      if (cause instanceof PartialSendError && prepared) {
        // Paired by the index of the CALL each hash belongs to, never by
        // rank. The confirmed hashes are not a prefix: employee 2's
        // transfer can revert (a frozen or blocked recipient is an ordinary
        // thing on a regulated stablecoin) while 1 and 3 confirm, and
        // counting ranks would then report employee 3's hash against
        // employee 2 — a real, successful transaction, paying the wrong
        // person's row, and leaving employee 3 unreported and due to be
        // paid a second time.
        //
        // Reporting exactly the confirmed calls — and nothing further —
        // records the payments that actually happened without guessing at
        // the rest, and keeps a merchant who already moved real USDC from
        // being told the run was simply cancelled.
        const results = pairConfirmed(prepared.itemIds, cause.confirmed).map(
          ({ call, txHash }) => ({ itemId: call, txHash }),
        );
        try {
          // Nothing confirmed means there is nothing to report; the run
          // stays locked and the merchant is told why below.
          if (results.length > 0) await payroll.reportExecuted(batch.id, results);
        } catch {
          // The payments already happened regardless of whether the
          // server accepted this report; the message below still says so.
        } finally {
          await load();
        }
        const total = prepared.itemIds.length;
        const paid = results.length;
        const stranded = cause.unconfirmed.length;
        setError(
          `${paid} of ${total} payment${total === 1 ? '' : 's'} went through before the run stopped.` +
            (stranded > 0
              ? ` ${stranded} more ${stranded === 1 ? 'was' : 'were'} sent but ${stranded === 1 ? 'has' : 'have'} not confirmed — check ${stranded === 1 ? 'the receipt' : 'the receipts'} on Arc before trying again.`
              : ' The rest were not sent — check the list below before trying again.'),
        );
      } else {
        setError(cause);
        void load();
      }
    } finally {
      setBusy(null);
    }
  }

  async function unlock() {
    if (!batch) return;
    setError(null);
    setBusy('unlock');
    try {
      setBatch(await payroll.abandon(batch.id));
    } catch (cause) {
      setError(cause);
      void load();
    } finally {
      setBusy(null);
    }
  }

  if (!batch) {
    return (
      <main className="mx-auto w-full max-w-3xl px-8 py-10">
        <EmptyState
          loading={loading}
          loaded={loaded}
          error={error != null ? String(error) : null}
          subject="this payroll run"
          empty="Payroll run not found."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-10">
      <Link href="/dashboard/payroll" className="text-muted hover:text-ink">
        ← Payroll
      </Link>

      <Alert error={error} className="mt-4" />

      <BatchSummary batch={batch} />

      {unpayable.length > 0 && <UnpayableNotice unpayable={unpayable} />}

      {RETRYABLE.includes(batch.status) && pending.length > 0 && (
        <ReadyToPay
          batch={batch}
          pending={pending}
          unverified={unverified}
          signatureCount={signatureCount}
          busy={busy}
          wallet={wallet}
          onExecute={execute}
        />
      )}

      {batch.status === 'EXECUTING' && (
        <ExecutingLockNotice busy={busy} onUnlock={unlock} />
      )}

      <Card className="mt-6" padded={false}>
        <ol className="divide-y divide-line">
          {batch.items.map((item) => (
            <PayrollItemRow key={item.id} item={item} />
          ))}
        </ol>
      </Card>
    </main>
  );
}

/** The amount, headcount and status for the run as a whole. */
function BatchSummary({ batch }: { batch: PayrollBatch }) {
  return (
    <header className="mt-4 flex items-start justify-between">
      <div>
        <Figure amount={formatUsdc(BigInt(batch.totalBase))} size="lg" as="h1" />
        <p className="mt-1 text-muted">
          {batch.items.length} {batch.items.length === 1 ? 'person' : 'people'}
        </p>
      </div>
      <Badge className={STATUS_TONE[batch.status] ?? TONE.neutral}>{batch.status}</Badge>
    </header>
  );
}

/** Everyone the server excluded from this run, and why. */
function UnpayableNotice({ unpayable }: { unpayable: UnpayableEmployee[] }) {
  return (
    <Notice className="mt-4">
      <p className="font-medium">
        {unpayable.length === 1
          ? `${unpayable[0].name} was left out of this run`
          : `${unpayable.length} people were left out of this run`}
      </p>
      <ul className="mt-1 list-disc pl-4">
        {unpayable.map((employee) => (
          <li key={employee.employeeId}>
            {employee.name} — {employee.reason}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

/** The card that arms the send: what it costs in signatures, and the button. */
function ReadyToPay({
  batch,
  pending,
  unverified,
  signatureCount,
  busy,
  wallet,
  onExecute,
}: {
  batch: PayrollBatch;
  pending: PayrollItem[];
  unverified: PayrollItem[];
  signatureCount: number | null;
  busy: string | null;
  wallet: ConnectedWallet | undefined;
  onExecute: () => void;
}) {
  return (
    <Card className="mt-8">
      <p className="font-medium">
        {batch.status === 'DRAFT' ? 'Ready to pay' : 'Ready to pay the rest'}
      </p>
      <p className="mt-1 text-muted">
        {signatureCount === null
          ? 'Checking what your wallet supports…'
          : signatureCount === 1
            ? 'Your wallet can do this in one signature.'
            : `Your wallet will ask you to sign ${signatureCount} times — once per payment.`}
      </p>
      {unverified.length > 0 && (
        <p className="mt-2 text-caution-ink">
          {unverified.length === 1
            ? `${unverified[0].name}'s payment could not be checked with Arc.`
            : `${unverified.length} payments could not be checked with Arc.`}{' '}
          They will be re-checked first, and paid again only if Arc says
          they never happened.
        </p>
      )}
      <Button onClick={onExecute} disabled={busy !== null || !wallet} className="mt-4">
        {busy === 'execute'
          ? 'Confirm in your wallet…'
          : batch.status === 'DRAFT'
            ? 'Pay everyone'
            : `Pay the remaining ${pending.length}`}
      </Button>
    </Card>
  );
}

/** The card shown while a run is locked with your wallet, mid-send. */
function ExecutingLockNotice({
  busy,
  onUnlock,
}: {
  busy: string | null;
  onUnlock: () => void;
}) {
  return (
    <Notice className="mt-8">
      <p className="font-medium">This run is with your wallet</p>
      <p className="mt-1">
        It stays locked until the payments are reported, so nobody here can be
        paid twice. If your wallet never signed anything — you dismissed the
        prompt, or closed the tab before approving — you can unlock it and
        start again. Check your wallet first: anything it already sent has
        left your balance whether or not this page saw it.
      </p>
      {/*
        Button's own `secondary` classes (border-line, text-ink,
        hover:bg-surface-sunken) live on the same <button> element as any
        override passed through className, and Tailwind resolves
        same-property conflicts by stylesheet order — not by where a
        class sits in the string — so border-line always beat
        border-caution-line here regardless of order. The border and
        hover tone move to this wrapper, a fresh element with nothing to
        compete against; the label's colour moves to an inner span, the
        way invoice-view.tsx's "Pay anyway" link already does it.
      */}
      <span className="mt-4 inline-flex rounded-control border border-caution-line hover:bg-caution-wash">
        <Button variant="quiet" disabled={busy !== null} onClick={onUnlock}>
          <span className="text-caution-ink">
            {busy === 'unlock' ? 'Unlocking…' : 'Nothing was signed — unlock this run'}
          </span>
        </Button>
      </span>
    </Notice>
  );
}

/** One person's row: their status dot, name, address, amount and receipt. */
function PayrollItemRow({ item }: { item: PayrollItem }) {
  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`h-2 w-2 shrink-0 rounded-pill ${MARKER[item.status] ?? 'bg-neutral-ink'}`}
        />
        <div className="min-w-0">
          <p className="font-medium">{item.name}</p>
          <p className="truncate font-mono text-caption text-muted">
            {item.walletAddress}
          </p>
          {item.failureReason && (
            // A PENDING item with a reason has not failed — it is one
            // Arc could not be asked about. Red would tell the
            // merchant it did not happen, which is the thing nobody
            // here is entitled to claim.
            <p
              className={
                item.status === 'PENDING' ? 'text-caution-ink' : 'text-negative-ink'
              }
            >
              {item.failureReason}
            </p>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono font-medium">
          {formatUsdc(BigInt(item.amountBase))}
        </p>
        {item.payTxHash && <ReceiptLink txHash={item.payTxHash} />}
      </div>
    </li>
  );
}

/** The link to this payment's transaction on the explorer. */
function ReceiptLink({ txHash }: { txHash: string }) {
  return (
    <a
      href={`${ARC_EXPLORER_URL}/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className={linkClass('font-mono text-caption')}
    >
      receipt
    </a>
  );
}
