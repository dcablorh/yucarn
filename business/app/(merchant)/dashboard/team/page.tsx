'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEmployeesApi, type Employee, type EmployeeInput } from '@/lib/employees';
import { useEnsApi } from '@/lib/ens';
import { Card } from '@/components/card';
import { Button } from '@/components/button';
import { Alert } from '@/components/alert';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { EmployeeTable } from './employee-table';
import { EmployeeForm } from './employee-form';

export default function TeamPage() {
  const api = useEmployeesApi();
  const ens = useEnsApi();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // null = closed; 'new' = adding; an Employee = editing that person.
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hasEnsName, setHasEnsName] = useState(false);

  const load = useCallback(async () => {
    try {
      setEmployees(await api.list());
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [api]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    // The Subname column's note depends on whether this business has
    // registered an ENS name. Read once on mount, alongside the roster —
    // never on a timer, and deliberately with an empty dependency array so
    // it never re-fires. A failed lookup must not block the roster: it is
    // treated as "no ENS name" and the page still renders normally, which
    // also covers a business that has never registered one at all.
    ens
      .getRegistration()
      .then((registration) => setHasEnsName(registration?.status === 'REGISTERED'))
      .catch(() => setHasEnsName(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(employee: Employee) {
    setError(null);
    try {
      await api.remove(employee.id);
      setEmployees((current) => current.filter((row) => row.id !== employee.id));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function submit(input: EmployeeInput) {
    setFormError(null);
    setBusy(true);
    try {
      if (editing === 'new') {
        const created = await api.create(input);
        setEmployees((current) => [...current, created]);
      } else if (editing) {
        const updated = await api.update(editing.id, input);
        setEmployees((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        );
      }
      setEditing(null);
    } catch (cause) {
      setFormError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title="Team"
        subtitle="Everyone payroll can pay, and where they want to be paid."
        action={
          !editing && (
            <Button
              onClick={() => {
                setFormError(null);
                setEditing('new');
              }}
            >
              Add employee
            </Button>
          )
        }
      />

      {error && employees.length > 0 && <Alert error={error} className="mt-6" />}

      <section className="mt-8">
        {editing && (
          <div className="mb-6">
            <EmployeeForm
              // Remounts when the target changes, so the fields reset to
              // the person being edited rather than keeping the last one's.
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? undefined : editing}
              busy={busy}
              error={formError}
              onSubmit={submit}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        {!loaded ? (
          <p className="text-muted">Loading your team…</p>
        ) : employees.length === 0 ? (
          // With the add form open and the roster genuinely empty, the
          // empty-state copy would just repeat the form directly above it
          // — so that case renders nothing here. A roster *failure* is
          // different: opening the add form must never hide the one place
          // that says the roster is unknown, or a merchant can add one
          // person and read the list as their whole team.
          (error || !editing) && (
            <Card padded={false}>
              <EmptyState
                loading={false}
                loaded={loaded}
                error={error}
                subject="your team"
                empty="No one on the team yet. Add someone with a name and a wallet address — an ENS subname is optional."
              />
            </Card>
          )
        ) : (
          <EmployeeTable
            employees={employees}
            hasEnsName={hasEnsName}
            busy={busy}
            onEdit={(employee) => {
              setFormError(null);
              setEditing(employee);
            }}
            onRemove={remove}
          />
        )}
      </section>
    </main>
  );
}
