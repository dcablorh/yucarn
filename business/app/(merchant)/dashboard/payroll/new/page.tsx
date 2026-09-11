'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useEmployeesApi, type Employee } from '@/lib/employees';
import { usePayrollApi } from '@/lib/payroll';
import { payoutChainLabel } from '@/lib/payout-chains';
import { formatUsdc, parseUsdcInput } from '@/lib/format';
import { Card } from '@/components/card';
import { Table, Td, Th, Tr } from '@/components/table';
import { inputClass } from '@/components/field';
import { Button, linkClass } from '@/components/button';
import { Alert } from '@/components/alert';
import { EmptyState } from '@/components/empty-state';
import { Notice } from '@/components/notice';
import { Figure } from '@/components/figure';
import { PageHeader } from '@/components/page-header';

const ARC = 'arc-testnet';

export default function NewPayrollRun() {
  const router = useRouter();
  const employeesApi = useEmployeesApi();
  const payroll = usePayrollApi();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEmployees(await employeesApi.list());
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [employeesApi]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // (No eslint-disable here: the compiler-based rule does not flag this
    // component's effect — verified empirically; a suppression comment
    // would itself be flagged as an unused directive.)
    void load();
  }, [load]);

  // Total is computed with BigInt from the same parser the server uses, so
  // what the merchant sees before signing is what the server composes.
  let totalBase = 0n;
  let firstBadAmount: string | null = null;
  for (const [id, raw] of Object.entries(amounts)) {
    if (!raw.trim()) continue;
    try {
      totalBase += parseUsdcInput(raw);
    } catch (cause) {
      const who = employees.find((employee) => employee.id === id)?.name ?? id;
      firstBadAmount ??= `${who}: ${(cause as Error).message}`;
    }
  }

  const included = Object.entries(amounts).filter(([, raw]) => raw.trim().length > 0);
  // Everyone we cannot reach, whether or not an amount was typed — their
  // input is disabled, so filtering on an amount would make this list
  // permanently empty and the warning below unreachable.
  const offArc = employees.filter((employee) => employee.prefChain !== ARC);
  const canSubmit = included.length > 0 && !firstBadAmount && !busy;

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const batch = await payroll.create(Object.fromEntries(included));
      // The run page has no other way to learn who the server excluded —
      // there is no PayrollItem row for them, so they are simply absent
      // from that page's list. sessionStorage, keyed on the batch id,
      // carries the list across the navigation without a server round
      // trip; the run page reads and clears it on mount.
      if (batch.unpayable.length > 0) {
        try {
          sessionStorage.setItem(
            `payroll-unpayable:${batch.id}`,
            JSON.stringify(batch.unpayable),
          );
        } catch {
          // Best-effort only — private browsing or a full quota must not
          // block routing to a batch that was already created server-side.
        }
      }
      router.push(`/dashboard/payroll/${batch.id}`);
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-10">
      <Link href="/dashboard/payroll" className="text-muted hover:text-ink">
        ← Payroll
      </Link>

      <div className="mt-4">
        <PageHeader
          title="New payroll run"
          subtitle="Set an amount for everyone you want to pay. Leave someone blank to skip them."
        />
      </div>

      {!loaded ? (
        <p className="mt-8 text-muted">Loading your team…</p>
      ) : employees.length === 0 ? (
        <Card className="mt-8" padded={false}>
          <EmptyState
            loading={false}
            loaded={loaded}
            error={error}
            subject="your team"
            empty="No one on the team yet. Add someone before running payroll."
            action={
              <Link href="/dashboard/team" className={linkClass()}>
                Add people on the Team page
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <Table
            className="mt-8"
            head={
              <>
                <Th>Name</Th>
                <Th>Pays on</Th>
                <Th>Amount (USDC)</Th>
              </>
            }
          >
            {employees.map((employee) => {
              const offChain = employee.prefChain !== ARC;
              return (
                <Tr key={employee.id}>
                  <Td className="font-medium text-ink">{employee.name}</Td>
                  <Td className="whitespace-nowrap">{payoutChainLabel(employee.prefChain)}</Td>
                  <Td>
                    <input
                      value={amounts[employee.id] ?? ''}
                      onChange={(event) =>
                        setAmounts({ ...amounts, [employee.id]: event.target.value })
                      }
                      inputMode="decimal"
                      placeholder="0.00"
                      disabled={offChain}
                      aria-label={`Amount for ${employee.name}`}
                      className={inputClass('w-32 font-mono')}
                    />
                  </Td>
                </Tr>
              );
            })}
          </Table>

          {offArc.length > 0 && (
            <Notice className="mt-4">
              <p className="font-medium">
                {offArc.length === 1
                  ? `${offArc[0].name} cannot be paid in this run`
                  : `${offArc.length} people cannot be paid in this run`}
              </p>
              <p className="mt-1">
                Yucarn pays on Arc for now. Change their chain to Arc on the Team page to
                include them.
              </p>
            </Notice>
          )}

          <Card className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-label uppercase text-muted">Total</p>
              <Figure amount={formatUsdc(totalBase)} size="lg" className="mt-1" />
              <p className="mt-1 text-muted">
                {included.length} {included.length === 1 ? 'person' : 'people'}
              </p>
            </div>
            <Button onClick={submit} disabled={!canSubmit}>
              {busy ? 'Preparing…' : 'Review and pay'}
            </Button>
          </Card>

          {/*
            firstBadAmount is a validation message, not a failure report —
            it names the person whose amount was rejected before anything
            was sent to the server. Alert humanizes and would collapse
            that into "Something went wrong", losing the name and the
            instruction, so it renders verbatim here instead.
          */}
          {firstBadAmount && <p className="mt-4 text-negative-ink">{firstBadAmount}</p>}
        </>
      )}

      {error && employees.length > 0 && <Alert error={error} className="mt-4" />}
    </main>
  );
}
