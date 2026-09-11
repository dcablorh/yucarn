'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi } from '@/lib/api';
import { parseUsdcInput } from '@/lib/format';
import { Card } from '@/components/card';
import { Field, inputClass } from '@/components/field';
import { Button } from '@/components/button';
import { Alert } from '@/components/alert';
import { PageHeader } from '@/components/page-header';

export default function NewInvoice() {
  const router = useRouter();
  const { createInvoice } = useApi();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  // Two different kinds of failure: amountError is a validation message
  // (nothing was asked of the server), error is a request failure. They
  // render through different primitives — Field and Alert — so one is
  // never shown as the other.
  const [amountError, setAmountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setAmountError(null);

    try {
      parseUsdcInput(amount); // validate before hitting the network
    } catch (cause) {
      setAmountError((cause as Error).message);
      return;
    }

    setSubmitting(true);
    try {
      const invoice = await createInvoice(amount, description || undefined);
      router.push(`/dashboard/invoices/${invoice.id}`);
    } catch (cause) {
      setError((cause as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-8 py-10">
      <PageHeader
        title="New invoice"
        subtitle="You receive USDC on Arc, whatever the customer pays with."
      />

      <Card className="mt-8">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <Field
            label="Amount (USDC)"
            htmlFor="amount"
            hint="Whole cents only. Yucarn adds a few sub-cent digits so an incoming transfer matches this invoice and no other."
            error={amountError}
          >
            <input
              id="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              inputMode="decimal"
              placeholder="100.00"
              required
              className={inputClass('font-mono text-lg')}
            />
          </Field>

          <Field label="Description (optional)" htmlFor="description">
            <input
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={280}
              placeholder="Order #1234"
              className={inputClass()}
            />
          </Field>

          <Alert error={error} />

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create invoice'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
