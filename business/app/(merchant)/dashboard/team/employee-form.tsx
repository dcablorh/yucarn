'use client';

import { useState } from 'react';
import type { Employee, EmployeeInput } from '@/lib/employees';
import { PAYOUT_CHAINS } from '@/lib/payout-chains';
import { Card } from '@/components/card';
import { Field, inputClass } from '@/components/field';
import { Button } from '@/components/button';
import { Alert } from '@/components/alert';

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

/**
 * Mirrors validateEmployeeInput on the server. Duplicated deliberately:
 * a merchant pasting a truncated address should be told before a round
 * trip, and the server still refuses the same input if this is bypassed.
 *
 * Split by field — rather than one combined message — so each error can
 * render through that field's own Field, verbatim, instead of through
 * Alert: a validation message is not a failure report.
 */
function nameError(input: EmployeeInput): string | null {
  if (input.name.trim().length === 0) return 'Enter a name';
  if (input.name.trim().length > 120) return 'That name is too long';
  return null;
}

function walletError(input: EmployeeInput): string | null {
  if (!ADDRESS.test(input.walletAddress)) {
    return 'A wallet address is 0x followed by 40 hex characters';
  }
  if (input.walletAddress.toLowerCase() === ZERO) {
    return 'That address cannot receive a payment';
  }
  return null;
}

function localError(input: EmployeeInput): string | null {
  return nameError(input) ?? walletError(input);
}

export function EmployeeForm({
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Employee;
  busy: boolean;
  error: string | null;
  onSubmit: (input: EmployeeInput) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<EmployeeInput>({
    name: initial?.name ?? '',
    walletAddress: initial?.walletAddress ?? '',
    prefChain: initial?.prefChain ?? 'arc-testnet',
    prefAsset: initial?.prefAsset ?? 'USDC',
  });
  const [touched, setTouched] = useState(false);

  const invalid = localError(input);

  return (
    <Card>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setTouched(true);
          if (!invalid) onSubmit(input);
        }}
      >
        <h2 className="font-medium">{initial ? 'Edit employee' : 'Add someone to the team'}</h2>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor="employee-name"
            error={touched ? nameError(input) : null}
          >
            <input
              id="employee-name"
              value={input.name}
              onChange={(event) => setInput({ ...input, name: event.target.value })}
              maxLength={120}
              placeholder="John Abiodun"
              className={inputClass()}
            />
          </Field>

          <Field
            label="Wallet address"
            htmlFor="employee-wallet-address"
            error={touched ? walletError(input) : null}
          >
            <input
              id="employee-wallet-address"
              value={input.walletAddress}
              onChange={(event) =>
                setInput({ ...input, walletAddress: event.target.value.trim() })
              }
              placeholder="0x…"
              autoComplete="off"
              className={inputClass('font-mono text-caption')}
            />
          </Field>

          <Field
            label="Pays on"
            htmlFor="employee-pref-chain"
            hint="Where this person receives USDC. It does not affect how you are paid."
          >
            <select
              id="employee-pref-chain"
              value={input.prefChain}
              onChange={(event) => setInput({ ...input, prefChain: event.target.value })}
              className={inputClass()}
            >
              {PAYOUT_CHAINS.map((chain) => (
                <option key={chain.key} value={chain.key}>
                  {chain.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Asset" htmlFor="employee-pref-asset">
            <input
              id="employee-pref-asset"
              value={input.prefAsset}
              readOnly
              className={inputClass('text-muted')}
            />
          </Field>
        </div>

        <Alert error={error} className="mt-4" />

        <div className="mt-6 flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : initial ? 'Save changes' : 'Add to team'}
          </Button>
          <Button type="button" variant="quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
