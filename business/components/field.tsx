import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Inputs sit on the sunken surface so they read as recessed on a white
 * card — they used to borrow the canvas colour, which made them
 * invisible there.
 */
export function inputClass(className?: string): string {
  return cx(
    // Never add `focus:outline-none` back here: it sets
    // `--tw-outline-style` to `none`, the exact variable the
    // `focus-visible:outline*` rule below dereferences, so the ring
    // resolves to `none` no matter which class or stylesheet order wins
    // and every input in the app loses its keyboard focus indicator.
    `w-full rounded-control border border-line-strong bg-surface-sunken px-3 py-2
     text-ink placeholder:text-faint
     transition-colors duration-150
     focus:border-accent focus:bg-surface
     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
     focus-visible:outline-accent
     disabled:cursor-not-allowed disabled:opacity-40`,
    className,
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-label uppercase text-muted">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 text-negative-ink">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-muted">{hint}</p>
      )}
    </div>
  );
}
