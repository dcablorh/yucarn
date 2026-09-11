'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { usePayrollApi, type PayrollBatch } from '@/lib/payroll';
import { formatUsdc, formatDateTime } from '@/lib/format';
import { Card } from '@/components/card';
import { ButtonLink } from '@/components/button';
import { Alert } from '@/components/alert';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Badge, TONE } from '@/components/badge';
import { cx } from '@/components/cx';

const STATUS_TONE: Record<string, string> = {
  DRAFT: TONE.neutral,
  EXECUTING: TONE.progress,
  COMPLETED: TONE.positive,
  PARTIAL: TONE.caution,
  FAILED: TONE.negative,
};

export default function PayrollPage() {
  const payroll = usePayrollApi();

  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBatches(await payroll.list());
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [payroll]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title="Payroll"
        subtitle="Pay your whole team in one run."
        action={<ButtonLink href="/dashboard/payroll/new">New run</ButtonLink>}
      />

      {error && batches.length > 0 && <Alert error={error} className="mt-6" />}

      <section className="mt-8">
        {!loaded ? (
          <p className="text-muted">Loading…</p>
        ) : batches.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              loading={false}
              loaded={loaded}
              error={error}
              subject="your payroll runs"
              empty="No payroll runs yet. Everyone on your team with an Arc address can be paid in one run."
            />
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {batches.map((batch) => (
                <li key={batch.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/payroll/${batch.id}`}
                      className="font-mono font-medium hover:text-accent"
                    >
                      {formatUsdc(BigInt(batch.totalBase))} USDC
                    </Link>
                    <p className="truncate text-muted">
                      {batch.items.length} {batch.items.length === 1 ? 'person' : 'people'} ·{' '}
                      {formatDateTime(batch.createdAt)}
                    </p>
                  </div>
                  <Badge className={cx('shrink-0', STATUS_TONE[batch.status] ?? TONE.neutral)}>
                    {batch.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </main>
  );
}
