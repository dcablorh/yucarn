'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Employee } from '@/lib/employees';
import { payoutChainLabel } from '@/lib/payout-chains';
import { Table, Td, Th, Tr } from '@/components/table';

/** 0x1234…abcd — enough to recognise a wallet in a dense row. */
function shortenAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function EmployeeTable({
  employees,
  hasEnsName,
  busy,
  onEdit,
  onRemove,
}: {
  employees: Employee[];
  hasEnsName: boolean;
  busy: boolean;
  onEdit: (employee: Employee) => void;
  onRemove: (employee: Employee) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <Table
      head={
        <>
          <Th>Name</Th>
          <Th>Wallet</Th>
          <Th>Subname</Th>
          <Th>Pays on</Th>
          <Th>Asset</Th>
          <Th></Th>
        </>
      }
    >
      {employees.map((employee) => (
        <Tr key={employee.id}>
          <Td className="font-medium text-ink">{employee.name}</Td>
          <Td className="font-mono text-caption text-muted" title={employee.walletAddress}>
            {shortenAddress(employee.walletAddress)}
          </Td>
          <Td>
            {employee.subname ? (
              <span className="font-mono">{employee.subname}</span>
            ) : (
              // Issuing subnames is a later plan — there is no endpoint
              // yet, so this button stays genuinely disabled rather
              // than risk a 404. It is shown rather than hidden so the
              // roster reads as finished, and the note beneath it says
              // plainly why it cannot be used yet.
              <div>
                <button type="button" disabled className="text-muted disabled:opacity-60">
                  Issue subname
                </button>
                <p className="mt-0.5 text-caption text-muted">
                  {hasEnsName ? (
                    'Coming soon'
                  ) : (
                    <>
                      <Link href="/dashboard/identity" className="underline hover:text-ink">
                        Register an ENS name
                      </Link>{' '}
                      first
                    </>
                  )}
                </p>
              </div>
            )}
          </Td>
          <Td className="whitespace-nowrap">{payoutChainLabel(employee.prefChain)}</Td>
          <Td>{employee.prefAsset}</Td>
          <Td className="whitespace-nowrap text-right">
            <button
              onClick={() => onEdit(employee)}
              disabled={busy}
              className="text-muted hover:text-ink disabled:opacity-40"
            >
              Edit
            </button>
            {confirming === employee.id ? (
              <>
                <button
                  onClick={() => {
                    setConfirming(null);
                    onRemove(employee);
                  }}
                  className="ml-3 font-medium text-negative-ink hover:underline"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="ml-3 text-muted hover:text-ink"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirming(employee.id)}
                disabled={busy}
                className="ml-3 text-muted hover:text-ink disabled:opacity-40"
              >
                Remove
              </button>
            )}
          </Td>
        </Tr>
      ))}
    </Table>
  );
}
