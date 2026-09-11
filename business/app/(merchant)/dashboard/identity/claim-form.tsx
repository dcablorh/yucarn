'use client';

import { useState } from 'react';
import { useEnsApi, type Availability, type Registration, type UnsignedCall } from '@/lib/ens';
import { formatUsdc } from '@/lib/format';
import { Card } from '@/components/card';
import { Field } from '@/components/field';
import { Button } from '@/components/button';
import { Alert } from '@/components/alert';

/**
 * Searches for a name and starts a registration.
 *
 * The label is validated here as well as on the server, because
 * ETHRegistrar.isAvailable is not a validity check: it returns true for
 * labels the registrar then refuses to price. Checking locally means a
 * merchant never sees a green tick followed by a revert.
 */
function localLabelError(label: string): string | null {
  if (label.length < 3) return 'A name needs at least 3 characters';
  if (label.length > 63) return 'A name can be at most 63 characters';
  if (label !== label.toLowerCase()) return 'Use lowercase letters only';
  if (!/^[a-z0-9-]+$/.test(label)) return 'Use letters, digits and hyphens only';
  if (label.startsWith('-') || label.endsWith('-')) {
    return 'A name cannot start or end with a hyphen';
  }
  return null;
}

export function ClaimForm({
  onClaimed,
}: {
  onClaimed: (registration: Registration & { calls: UnsignedCall[] }) => void;
}) {
  const { checkAvailability, createRegistration } = useEnsApi();

  const [label, setLabel] = useState('');
  const [result, setResult] = useState<Availability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const localError = label ? localLabelError(label) : null;

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (localError) return;

    setBusy(true);
    try {
      setResult(await checkAvailability(label));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setError(null);
    setBusy(true);
    try {
      onClaimed(await createRegistration(label));
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={search} className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Name" htmlFor="claim-label" error={localError}>
            {/*
              This wrapper mirrors inputClass()'s visual values by hand
              rather than calling it: a <div> with no tabindex can never
              match :focus, so inputClass()'s focus/focus-visible classes
              would be permanently dead here. Its own state is limited to
              focus-within, which lights up whenever the input inside it
              is focused. The actual keyboard focus ring belongs on the
              input below, the one element here that can really take it.
            */}
            <div className="flex w-full items-center gap-2 rounded-control border border-line-strong bg-surface-sunken px-3 py-2 transition-colors duration-150 focus-within:border-accent focus-within:bg-surface">
              <input
                id="claim-label"
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value.trim());
                  setResult(null);
                }}
                placeholder="yourbusiness"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent font-mono text-ink placeholder:text-faint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <span className="shrink-0 font-mono text-muted">.eth</span>
            </div>
          </Field>
        </div>
        <Button
          type="submit"
          variant="secondary"
          disabled={busy || !label || !!localError}
          className="mt-5 shrink-0"
        >
          {busy ? 'Checking…' : 'Check'}
        </Button>
      </form>

      {result && (
        <Card className="mt-4">
          {result.available ? (
            <>
              <p>
                <span className="font-mono font-medium">{result.label}.eth</span> is available.
              </p>
              {result.priceBase && (
                <p className="mt-1 text-muted">
                  <span className="font-mono">{formatUsdc(BigInt(result.priceBase))}</span> test
                  USDC for one year, minted for you from the ENS faucet.
                </p>
              )}
              <Button onClick={claim} disabled={busy} className="mt-4">
                {busy ? 'Starting…' : `Claim ${result.label}.eth`}
              </Button>
            </>
          ) : (
            <p className="text-muted">
              <span className="font-mono text-ink">{result.label}.eth</span> is taken. Try another
              name.
            </p>
          )}
        </Card>
      )}

      <Alert error={error} className="mt-4" />
    </div>
  );
}
