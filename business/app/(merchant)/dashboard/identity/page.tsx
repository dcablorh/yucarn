'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEnsApi, type Registration, type UnsignedCall } from '@/lib/ens';
import { Alert } from '@/components/alert';
import { PageHeader } from '@/components/page-header';
import { ClaimForm } from './claim-form';
import { RegistrationFlow } from './registration-flow';
import { IdentityCard } from './identity-card';

export default function IdentityPage() {
  const { getRegistration } = useEnsApi();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [calls, setCalls] = useState<UnsignedCall[]>([]);
  // True only once the fetch has actually succeeded — set inside the try,
  // same convention as useInvoices. Setting it in a finally would make it
  // mean only "an attempt finished", and then a failed fetch would read
  // as "no registration", offering a claim form for a name the merchant
  // may already own.
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRegistration(await getRegistration());
      setLoaded(true);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [getRegistration]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title="Identity"
        subtitle="An ENS name your customers can use instead of an address. Registered on Sepolia; invoices and settlement stay on Arc."
      />

      {/* Reported whenever there is a failure, regardless of what else is
          on screen — never gated on `registration`, which a failed fetch
          never sets. */}
      {error && <Alert error={error} className="mt-6" />}

      <section className="mt-8">
        {!loaded ? (
          // `loaded` only ever becomes true on success (see `load` above),
          // so a failed fetch stays here rather than falling through to
          // ClaimForm — the Alert above already says why. Showing
          // "Loading…" once a failure is reported would be misleading, so
          // it renders only while genuinely still waiting.
          error ? null : <p className="text-muted">Loading…</p>
        ) : registration ? (
          registration.status === 'REGISTERED' ? (
            <IdentityCard registration={registration} />
          ) : (
            <RegistrationFlow
              registration={registration}
              initialCalls={calls}
              onChange={setRegistration}
            />
          )
        ) : (
          <ClaimForm
            onClaimed={(created) => {
              setCalls(created.calls);
              setRegistration(created);
            }}
          />
        )}
      </section>
    </main>
  );
}
