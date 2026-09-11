'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState } from 'react';
import { useApi } from '@/lib/api';
import { useBusiness, useSetBusiness } from '@/lib/business-context';
import { formatDateTime } from '@/lib/format';
import { ARC_EXPLORER_URL } from '@/lib/chains';
import { Card } from '@/components/card';
import { Field, inputClass } from '@/components/field';
import { Button, linkClass } from '@/components/button';
import { Alert } from '@/components/alert';
import { Notice } from '@/components/notice';
import { PageHeader } from '@/components/page-header';

export default function SettingsPage() {
  const business = useBusiness();
  const setBusiness = useSetBusiness();
  const { wallets } = useWallets();
  const { exportWallet } = usePrivy();
  const { registerBusiness } = useApi();

  const [name, setName] = useState(business.name ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const connected = wallets[0]?.address;
  const payoutMismatch =
    !!connected && connected.toLowerCase() !== business.walletAddress.toLowerCase();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    // registerBusiness() always sends the connected wallet address, and the
    // server upserts Business.walletAddress from it. Saving a display name
    // while signed in with a different wallet would therefore move the
    // payout address as a side effect — the exact failure the layout's
    // once-per-session registration guard exists to prevent, reached through
    // a gesture the merchant reads as renaming. Refuse, and point at the
    // explicit control instead. With no mismatch this call re-sends the
    // address already stored, which is a no-op.
    if (payoutMismatch) {
      setError(
        'You are signed in with a wallet that is not your payout address. Saving now would also change where invoices pay out. Switch to your payout wallet, or use “Use this wallet for payouts” below if that is what you intend.',
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Push the updated row into context so Overview and this page stop
      // rendering the stale name. Without this the save looks like it
      // failed: navigating away and back re-reads the old value.
      setBusiness(await registerBusiness(name.trim() || undefined));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function adoptConnectedWallet() {
    setSaving(true);
    setError(null);
    try {
      await registerBusiness(name.trim() || undefined);
      // The Business in context was captured by the dashboard layout at
      // registration and has no refresh path, so the payout address on this
      // page would otherwise stay stale and keep showing the mismatch panel
      // after a successful change. Reload so every view agrees.
      window.location.reload();
    } catch (cause) {
      setError((cause as Error).message);
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader title="Settings" />

      <Card className="mt-8">
        <h2 className="font-medium">Business</h2>
        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <Field
            label="Display name"
            htmlFor="business-name"
            hint="Shown to customers on the public payment page."
          >
            <input
              id="business-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Acme Corp"
              className={inputClass()}
            />
          </Field>
          <Alert error={error} />
          <Button type="submit" disabled={saving} className="self-start">
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </Button>
        </form>
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium">Payout wallet</h2>
        <p className="mt-1 text-muted">
          Invoices settle to this address as USDC on Arc. Yucarn never holds your funds.
        </p>

        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-label uppercase text-muted">Address</dt>
            <dd className="mt-1 break-all font-mono text-caption">
              <a
                href={`${ARC_EXPLORER_URL}/address/${business.walletAddress}`}
                target="_blank"
                rel="noreferrer"
                className={linkClass()}
              >
                {business.walletAddress}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-label uppercase text-muted">Settlement network</dt>
            {/*
              Read-only. Invoice.destChain is fixed to arc-testnet server-side
              and there is no endpoint to change it, so offering a control
              here would imply a choice the merchant does not have.
            */}
            <dd className="mt-1">Arc testnet · USDC</dd>
          </div>
          <div>
            <dt className="text-label uppercase text-muted">Registered</dt>
            <dd className="mt-1 text-muted">{formatDateTime(business.createdAt)}</dd>
          </div>
        </dl>

        {payoutMismatch && (
          <Notice className="mt-4">
            <p>
              The wallet you are signed in with ({connected}) is not your payout address.
              Using it will change where future invoices pay out, and will also save any
              change you have made to the display name above. Existing invoices keep the
              address they were created with.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void adoptConnectedWallet()}
              disabled={saving}
              className="mt-3"
            >
              {saving ? 'Updating…' : 'Use this wallet for payouts'}
            </Button>
          </Notice>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="font-medium">Wallet</h2>
        <p className="mt-1 text-muted">
          Your keys are held by Privy, never by Yucarn. Exporting is available for embedded
          wallets only.
        </p>
        <Button variant="secondary" onClick={() => void exportWallet()} className="mt-4">
          Export wallet
        </Button>
      </Card>
    </main>
  );
}
