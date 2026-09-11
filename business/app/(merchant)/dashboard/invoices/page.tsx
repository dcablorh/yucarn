'use client';

import { Alert } from '@/components/alert';
import { ButtonLink } from '@/components/button';
import { Badge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Table, Td, Th, Tr } from '@/components/table';
import Link from 'next/link';
import { useInvoices } from '@/lib/use-invoices';
import { presentStatus } from '@/lib/status';
import { formatUsdc, formatDateTime } from '@/lib/format';

export default function InvoicesPage() {
  const { invoices, error, loading, loaded } = useInvoices();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title="Invoices"
        subtitle="You receive USDC on Arc, whatever the customer pays with."
        action={<ButtonLink href="/dashboard/invoices/new">New invoice</ButtonLink>}
      />

      {error && invoices.length > 0 && <Alert error={error} className="mt-6" />}

      <div className="mt-8">
        <Table
          head={
            <>
              <Th>Amount</Th>
              <Th>Description</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Expires</Th>
            </>
          }
        >
          {invoices.map((invoice) => {
            const status = presentStatus(invoice.status);
            return (
              <Tr key={invoice.id}>
                <Td>
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="font-mono font-medium text-ink hover:text-accent"
                  >
                    {formatUsdc(BigInt(invoice.payableBase))}
                  </Link>
                </Td>
                <Td>{invoice.description ?? '—'}</Td>
                <Td>
                  <Badge className={status.className}>{status.label}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(invoice.createdAt)}</Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(invoice.expiresAt)}</Td>
              </Tr>
            );
          })}
        </Table>

        {invoices.length === 0 && (
          <EmptyState
            loading={loading}
            loaded={loaded}
            error={error}
            subject="your invoices"
            empty="No invoices yet. Create one to start getting paid."
          />
        )}
      </div>
    </main>
  );
}
