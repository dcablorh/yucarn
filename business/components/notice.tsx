import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * A caution-toned callout: something a merchant should read before acting,
 * but not a failure. `Alert` is for failures and takes an error; this takes
 * prose. Payroll uses it to warn about partial sends and unconfirmed items.
 */
export function Notice({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-live="polite"
      className={cx(
        'rounded-card border border-caution-line bg-caution-wash px-4 py-3 text-caution-ink',
        className,
      )}
    >
      {children}
    </div>
  );
}
