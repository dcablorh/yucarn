'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useInvoices } from '@/lib/use-invoices';
import { deriveOverview } from '@/lib/overview';
import { deriveActivity } from '@/lib/activity';
import { usePayrollApi, type PayrollBatch } from '@/lib/payroll';
import { formatUsdc, formatDateTime } from '@/lib/format';
import { useBusiness } from '@/lib/business-context';
import { ARC_EXPLORER_URL } from '@/lib/chains';
import { Card } from '@/components/card';
import { ButtonLink, linkClass } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Alert } from '@/components/alert';
import { TONE } from '@/components/badge';
import { cx } from '@/components/cx';
import { WalletCard } from './wallet-card';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-label uppercase text-muted">{label}</p>
      <p className="mt-2 font-mono text-section text-ink">{value}</p>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </Card>
  );
}

export default function OverviewPage() {
  const business = useBusiness();
  const { invoices, error, loading, loaded } = useInvoices();
  const payroll = usePayrollApi();
  const stats = deriveOverview(invoices);

  // Payroll rounds out the ledger with the money going OUT. A failure here
  // must not cost the merchant their invoice history, so it degrades to an
  // empty list rather than an error — the invoices half still renders.
  const [batches, setBatches] = useState<PayrollBatch[]>([]);

  const loadBatches = useCallback(async () => {
    try {
      setBatches(await payroll.list());
    } catch {
      setBatches([]);
    }
  }, [payroll]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadBatches();
  }, [loadBatches]);

  const activity = deriveActivity(invoices, batches);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title={business.name ?? 'Overview'}
        subtitle="Settling to USDC on Arc."
        action={<ButtonLink href="/dashboard/invoices/new">New invoice</ButtonLink>}
      />

      {error && loaded && <Alert error={error} className="mt-6" />}

      {loaded ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Received"
            value={`${formatUsdc(stats.receivedBase)} USDC`}
            sub={`across ${stats.paidCount} paid ${stats.paidCount === 1 ? 'invoice' : 'invoices'}`}
          />
          <Stat label="Awaiting payment" value={`${formatUsdc(stats.awaitingBase)} USDC`} />
          <Stat label="Open invoices" value={String(stats.openCount)} />
        </div>
      ) : (
        <Card className="mt-8" padded={false}>
          <EmptyState
            loading={loading}
            loaded={loaded}
            error={error}
            subject="your figures"
            empty="No figures yet. They will fill in once your first invoice is paid."
          />
        </Card>
      )}

      <WalletCard address={business.walletAddress} />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-subhead text-ink">Recent activity</h2>
          <Link href="/dashboard/invoices" className="text-muted hover:text-ink">
            All invoices →
          </Link>
        </div>

        <Card className="mt-4" padded={false}>
          <ul className="divide-y divide-line">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-caption font-medium ring-1',
                      entry.direction === 'in' ? TONE.positive : TONE.neutral,
                    )}
                    aria-hidden
                  >
                    {entry.direction === 'in' ? '↓' : '↑'}
                  </span>
                  <div className="min-w-0">
                    <Link href={entry.href} className="font-medium text-ink hover:text-accent">
                      {entry.title}
                    </Link>
                    <p className="truncate text-muted">
                      {entry.detail} · {formatDateTime(entry.at)}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={cx(
                      'font-mono font-medium',
                      entry.direction === 'in' ? 'text-positive-ink' : 'text-ink',
                    )}
                  >
                    {entry.direction === 'in' ? '+' : '−'}
                    {formatUsdc(entry.amountBase)}
                  </p>
                  {entry.txHash ? (
                    <a
                      href={`${ARC_EXPLORER_URL}/tx/${entry.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClass('text-caption')}
                    >
                      receipt
                    </a>
                  ) : (
                    <span className="text-caption text-muted">no receipt</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Only rendered once the shared fetch has actually succeeded:
              the stats block above already reports both "loading" and
              "couldn't load" for this same fetch, and activity has no
              fetch of its own — showing either state here too would
              report the one failure (or the one loading spinner) twice. */}
          {loaded && activity.length === 0 && (
            <EmptyState
              loading={false}
              loaded
              error={null}
              subject="your activity"
              empty="Nothing has moved yet. A paid invoice or a payroll run shows up here."
            />
          )}
        </Card>
      </section>
    </main>
  );
}
