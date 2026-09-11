import { notFound } from 'next/navigation';
import { Providers } from '../../providers';
import { InvoiceView, type PublicInvoice } from './invoice-view';
import { apiUrl } from '@/lib/api-url';

export default async function InvoicePage(props: PageProps<'/i/[id]'>) {
  const { id } = await props.params;

  // Resolved per request, not at module load: this runs on the server, where
  // the API is reached over the container network rather than at the public
  // browser-facing URL.
  const response = await fetch(`${apiUrl()}/public/invoices/${id}`, { cache: 'no-store' });
  if (!response.ok) notFound();

  const invoice = (await response.json()) as PublicInvoice;

  // The customer paying this invoice needs a wallet just as much as the
  // merchant does, so Privy has to reach this route too — it is deliberately
  // not mounted app-wide (commit 1325af2), only on the routes that use it.
  return (
    <Providers>
      <InvoiceView initial={invoice} />
    </Providers>
  );
}
