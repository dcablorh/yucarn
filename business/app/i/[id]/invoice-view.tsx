'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { createPublicClient, createWalletClient, custom, http, type Address, type Hex } from 'viem';
import { arcTestnet, ARC_EXPLORER_URL } from '@/lib/chains';
import { formatDateTime, formatUsdc } from '@/lib/format';
import { buildPaymentTransaction, isPayable } from '@/lib/pay';
import type { InvoiceStatus } from '@/lib/api';
import { apiUrl } from '@/lib/api-url';
import { presentStatus } from '@/lib/status';
import { Alert } from '@/components/alert';
import { Badge, TONE } from '@/components/badge';
import { Button, linkClass } from '@/components/button';
import { Card } from '@/components/card';
import { CopyRow } from '@/components/copy-row';
import { Figure } from '@/components/figure';
import { Notice } from '@/components/notice';

export interface PublicInvoice {
  id: string;
  businessName: string | null;
  amountBase: string;
  payableBase: string;
  recipient: string;
  destChain: string;
  asset: string;
  status: string;
  description: string | null;
  expiresAt: string;
}

const API_URL = apiUrl();

/** No further status change is possible once here, so polling stops. */
const TERMINAL_STATUSES = new Set(['PAID', 'EXPIRED', 'FAILED']);

/**
 * What the payment is doing right now. `idle` is the only state with a live
 * Pay button: every state after `signing` means a transfer may already be on
 * Arc, and re-arming the button there would invite a customer to pay twice.
 */
type Phase = 'idle' | 'signing' | 'confirming' | 'settling';

const PHASE_LABEL: Record<Exclude<Phase, 'idle'>, string> = {
  signing: 'Confirm in your wallet…',
  confirming: 'Waiting for Arc to confirm…',
  settling: 'Payment sent — settling',
};

export function InvoiceView({ initial }: { initial: PublicInvoice }) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const [invoice, setInvoice] = useState(initial);
  const [phase, setPhase] = useState<Phase>('idle');
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [payAnyway, setPayAnyway] = useState(false);

  useEffect(() => {
    if (TERMINAL_STATUSES.has(invoice.status)) return;
    const timer = setInterval(async () => {
      const response = await fetch(`${API_URL}/public/invoices/${invoice.id}`);
      if (response.ok) setInvoice(await response.json());
    }, 10_000);
    return () => clearInterval(timer);
  }, [invoice.id, invoice.status]);

  const wallet = wallets[0];
  const payable = isPayable(invoice.status);
  const amount = formatUsdc(BigInt(invoice.payableBase));

  // PENDING is the only status where sending the full amount is
  // unambiguously right. PROCESSING means a transfer was already reported —
  // most often this same customer's, one reload ago — and UNDERPAID means
  // part of the money is already in, but the public projection does not say
  // how much, so the button would overpay. Both get a warning and an
  // explicit opt-in rather than an armed button.
  const armed = invoice.status === 'PENDING' || payAnyway || phase !== 'idle' || !!txHash;

  async function pay() {
    if (!wallet) {
      setError('Connect a wallet before paying.');
      return;
    }
    setError(null);

    let hash: Hex;
    try {
      // Arc is where the merchant is paid, so the wallet has to be on Arc
      // before it signs anything. Privy prompts the user if it is not.
      await wallet.switchChain(arcTestnet.id);

      const walletClient = createWalletClient({
        account: wallet.address as Address,
        chain: arcTestnet,
        transport: custom(await wallet.getEthereumProvider()),
      });

      setPhase('signing');
      hash = await walletClient.sendTransaction(
        // payableBase, not amountBase: the sub-cent tail is this invoice's
        // amount nonce, and it is the only thing that tells the Arc watcher
        // which invoice the transfer belongs to.
        buildPaymentTransaction(invoice.recipient as Address, BigInt(invoice.payableBase)),
      );
    } catch (cause) {
      // Nothing was broadcast, so it is safe to hand the button back.
      setError(cause);
      setPhase('idle');
      return;
    }

    // Past this line a transfer exists on Arc. Every failure below is a
    // reporting or waiting failure, never a reason to offer paying again.
    setTxHash(hash);
    setPhase('confirming');

    try {
      const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        setError('Arc rejected the transfer. Nothing was sent.');
        setPhase('idle');
        setTxHash(null);
        return;
      }
    } catch {
      // We lost track of the receipt, not the payment. The Arc watcher
      // credits the invoice from the chain either way.
      setPhase('settling');
      return;
    }

    setPhase('settling');

    try {
      // Advisory only — it moves the invoice to PROCESSING so the merchant
      // sees movement sooner. The watcher is what actually marks it paid,
      // so a failure here costs nothing but a few seconds of latency.
      await fetch(`${API_URL}/public/invoices/${invoice.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceTxHash: hash }),
      });
    } catch {
      // Deliberately silent: see above.
    }
  }

  if (invoice.status === 'PAID') {
    return (
      <Shell>
        <Card padded={false} className="px-8 py-12 text-center">
          <Figure amount={amount} size="lg" />
          <p className="mt-3 font-medium text-positive-ink">Paid</p>
          <p className="mt-1 text-muted">
            Received by {invoice.businessName ?? 'the merchant'} on Arc.
          </p>
          {txHash && <ExplorerLink hash={txHash} />}
        </Card>
      </Shell>
    );
  }

  if (!payable) {
    return (
      <Shell>
        <Card padded={false} className="px-8 py-12 text-center">
          <Figure amount={amount} size="lg" tone="muted" />
          <p className="mt-3 font-medium">
            {invoice.status === 'EXPIRED' ? 'This invoice has expired' : 'This invoice is closed'}
          </p>
          <p className="mt-1 text-muted">
            Ask {invoice.businessName ?? 'the merchant'} for a new payment link.
          </p>
        </Card>
      </Shell>
    );
  }

  const status = presentStatus(invoice.status as InvoiceStatus) ?? {
    label: invoice.status,
    className: TONE.neutral,
    terminal: false,
  };

  return (
    <Shell>
      <header>
        <p className="text-muted">{invoice.businessName ?? 'A Yucarn merchant'} is requesting</p>
        <Figure amount={amount} size="lg" as="h1" className="mt-1" />
        {invoice.description && <p className="mt-2 text-muted">{invoice.description}</p>}
      </header>

      <Card padded={false} className="mt-8 p-6">
        {!ready ? (
          <p className="text-center text-muted">Loading…</p>
        ) : !authenticated || !wallet ? (
          <>
            <Button onClick={login} size="lg" className="w-full">
              Connect wallet
            </Button>
            <p className="mt-3 text-center text-muted">
              Pay from any wallet, or with an email address.
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <p className="text-label uppercase text-muted">Paying from</p>
              <p className="min-w-0 truncate font-mono text-caption">{wallet.address}</p>
            </div>
            {armed ? (
              // aria-live announces each signing → confirming → settling
              // transition to a screen reader; nothing about the phase
              // logic or its labels changes.
              <Button
                onClick={pay}
                disabled={phase !== 'idle'}
                size="lg"
                className="mt-4 w-full"
                aria-live="polite"
              >
                {phase === 'idle' ? `Pay ${amount} USDC` : PHASE_LABEL[phase]}
              </Button>
            ) : (
              <Notice className="mt-4">
                <p className="font-medium">
                  {invoice.status === 'PROCESSING'
                    ? 'A payment for this invoice is already settling'
                    : 'Part of this invoice has already been paid'}
                </p>
                <p className="mt-1">
                  {invoice.status === 'PROCESSING'
                    ? 'If you just sent it, wait here — this page updates when Arc confirms.'
                    : `Sending the full amount again would overpay. Check the outstanding balance with ${invoice.businessName ?? 'the merchant'} first.`}
                </p>
                <Button
                  variant="quiet"
                  onClick={() => setPayAnyway(true)}
                  className="mt-3 underline underline-offset-2"
                >
                  <span className="text-caution-ink">Pay {amount} USDC anyway</span>
                </Button>
              </Notice>
            )}
            {txHash && <ExplorerLink hash={txHash} />}
            {phase === 'settling' && (
              <p className="mt-3 text-center text-muted">
                {invoice.businessName ?? 'The merchant'} is credited once Arc settles the
                transfer. You can close this page.
              </p>
            )}
          </>
        )}

        <Alert error={error} className="mt-3" />
      </Card>

      <Card padded={false} className="mt-6 p-6">
        <dl className="space-y-3">
          <Detail label="Network" value="Arc testnet" />
          <Detail label="Asset" value={invoice.asset} />
          <div className="flex justify-between gap-4">
            <dt className="shrink-0 text-muted">Status</dt>
            <dd className="min-w-0">
              <Badge className={status.className}>{status.label}</Badge>
            </dd>
          </div>
          <Detail label="Expires" value={formatDateTime(invoice.expiresAt)} />
        </dl>
      </Card>

      <div className="mt-6">
        <Button
          variant="quiet"
          onClick={() => setManualOpen((open) => !open)}
          aria-expanded={manualOpen}
        >
          {manualOpen ? '- ' : '+ '}Pay from another wallet
        </Button>
        {manualOpen && (
          <Card padded={false} className="mt-4 space-y-4 p-6">
            <p className="text-muted">
              Send USDC on Arc to the address below. The amount must match exactly — the
              trailing digits are what identify this invoice.
            </p>
            <CopyRow label="Amount (USDC)" value={amount} />
            <CopyRow label="Recipient" value={invoice.recipient} />
          </Card>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">{children}</main>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate">{value}</dd>
    </div>
  );
}

function ExplorerLink({ hash }: { hash: Hex }) {
  return (
    <a
      href={`${ARC_EXPLORER_URL}/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
      className={linkClass('mt-3 block truncate text-center font-mono text-caption')}
    >
      {hash}
    </a>
  );
}
