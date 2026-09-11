'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { ApiError, useApi, type Invoice } from '@/lib/api';
import { deriveTimeline, type TimelineState } from '@/lib/timeline';
import { presentStatus, isTerminal } from '@/lib/status';
import { formatUsdc, formatDateTime } from '@/lib/format';
import { ARC_EXPLORER_URL } from '@/lib/chains';
import { Card } from '@/components/card';
import { Badge } from '@/components/badge';
import { Figure } from '@/components/figure';
import { EmptyState } from '@/components/empty-state';
import { Alert } from '@/components/alert';
import { linkClass } from '@/components/button';
import { cx } from '@/components/cx';
import { ShareCard } from './share-card';

/**
 * Same tone vocabulary as Badge's TONE (components/badge.tsx), keyed by
 * timeline state instead of invoice status. A step marker is a 2px dot,
 * not a padded pill, so it takes the solid "-ink" shade each tone uses
 * for its text, rather than the wash+ring pair Badge composes around it.
 */
const MARKER: Record<TimelineState, string> = {
  done: 'bg-positive-ink',
  current: 'bg-progress-ink',
  pending: 'bg-pending-ink',
  skipped: 'bg-neutral-ink',
  failed: 'bg-negative-ink',
};

export default function InvoiceDetailPage(props: PageProps<'/dashboard/invoices/[id]'>) {
  const { id } = use(props.params);
  const { getInvoice } = useApi();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  // loading: a request is in flight. loaded: a request has actually
  // succeeded (or definitively come back 404) — never set in a finally,
  // so a genuine failure is never read as "found nothing".
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setInvoice(await getInvoice(id));
      setLoaded(true);
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404) {
        // The fetch completed and definitively found nothing, which is
        // not the same as a retryable failure.
        setInvoice(null);
        setLoaded(true);
        setError(null);
      } else {
        setError((cause as Error).message);
      }
    } finally {
      setLoading(false);
    }
  }, [getInvoice, id]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Poll only while the invoice can still change. The Arc watcher flips it
  // to PAID out of band, so a terminal invoice has nothing left to poll for.
  useEffect(() => {
    if (!invoice || isTerminal(invoice.status)) return;
    const timer = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(timer);
  }, [invoice, refresh]);

  // Only blank the page when there is nothing to show yet. Once an invoice
  // has loaded, a failed poll renders as a banner above the still-current
  // data — the merchant keeps the amount, timeline and recipient in front
  // of them while a transient blip resolves itself on the next tick. This
  // matches how the invoices table handles the same failure.
  if (!invoice) {
    return (
      <main className="mx-auto w-full max-w-3xl px-8 py-10">
        <EmptyState
          loading={loading}
          loaded={loaded}
          error={error}
          subject="this invoice"
          empty="Invoice not found."
        />
      </main>
    );
  }

  const status = presentStatus(invoice.status);
  const steps = deriveTimeline(invoice);

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-10">
      <Link href="/dashboard/invoices" className="text-muted hover:text-ink">
        ← Invoices
      </Link>

      {error && <Alert error={error} className="mt-4" />}

      <header className="mt-4 flex items-start justify-between">
        <div>
          <Figure amount={formatUsdc(BigInt(invoice.payableBase))} size="lg" as="h1" />
          <p className="mt-1 text-muted">{invoice.description ?? 'No description'}</p>
        </div>
        <Badge className={status.className}>{status.label}</Badge>
      </header>

      <Card className="mt-8">
        <h2 className="text-label uppercase text-muted">Progress</h2>
        <ol className="mt-4 space-y-4">
          {steps.map((step) => (
            <li key={step.key} className="flex gap-3">
              <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-pill', MARKER[step.state])} />
              <div className="min-w-0">
                <p className={step.state === 'skipped' ? 'text-muted' : 'font-medium'}>
                  {step.label}
                  {step.state === 'skipped' && ' — skipped'}
                </p>
                {step.key === 'created' && step.detail && (
                  <p className="text-muted">{formatDateTime(step.detail)}</p>
                )}
                {step.key !== 'created' && step.detail && (
                  step.detail.startsWith('0x') ? (
                    <a
                      href={`${ARC_EXPLORER_URL}/tx/${step.detail}`}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClass('block truncate font-mono text-caption')}
                    >
                      {step.detail}
                    </a>
                  ) : (
                    <p className="text-muted">{step.detail}</p>
                  )
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="mt-6">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <dt className="text-label uppercase text-muted">Requested</dt>
            <dd className="mt-1 font-mono">{formatUsdc(BigInt(invoice.amountBase))} USDC</dd>
          </div>
          <div>
            <dt className="text-label uppercase text-muted">Amount due</dt>
            <dd className="mt-1 font-mono">{formatUsdc(BigInt(invoice.payableBase))} USDC</dd>
          </div>
          <div>
            <dt className="text-label uppercase text-muted">Settlement</dt>
            <dd className="mt-1">Arc · {invoice.asset}</dd>
          </div>
          <div>
            <dt className="text-label uppercase text-muted">Expires</dt>
            <dd className="mt-1">{formatDateTime(invoice.expiresAt)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-label uppercase text-muted">Recipient</dt>
            <dd className="mt-1 truncate font-mono text-caption">{invoice.recipient}</dd>
          </div>
        </dl>
      </Card>

      <ShareCard invoiceId={invoice.id} />
    </main>
  );
}
