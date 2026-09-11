import type { ReactNode } from 'react';
import { cx } from './cx';
import { resolveListState } from './list-state';

/**
 * The one place a list says nothing-to-show.
 *
 * `subject` keeps the error specific ("your invoices") while the sentence
 * stays consistent across screens — the failure states were the app's
 * least consistent surface, which is exactly the wrong place to improvise,
 * because a merchant reads them when they are anxious about their money.
 *
 * The error copy never implies data loss: an unreachable API has not lost
 * anything.
 */
export function EmptyState({
  loading,
  loaded,
  error,
  subject,
  empty,
  action,
  className,
}: {
  loading: boolean;
  loaded: boolean;
  error?: string | null;
  /** Plural noun for the error sentence, e.g. "your invoices". */
  subject: string;
  /** What to say when the load succeeded and there is genuinely nothing. */
  empty: string;
  action?: ReactNode;
  className?: string;
}) {
  const state = resolveListState({ loading, loaded, error });

  const message =
    state === 'loading'
      ? 'Loading…'
      : state === 'error'
        ? `We couldn't load ${subject}. Nothing has been lost — try again in a moment.`
        : empty;

  return (
    <div className={cx('px-5 py-10 text-center text-muted', className)} aria-live="polite">
      <p className="mx-auto max-w-[46ch]">{message}</p>
      {state === 'empty' && action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
