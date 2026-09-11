'use client';

import { useState } from 'react';
import { cx } from './cx';
import { humanizeError } from './humanize-error';

/**
 * The one way this app shows a failure.
 *
 * The human sentence leads. The original text is kept behind a
 * disclosure so a merchant can hand support something exact without
 * having to read it first — sixteen screens used to print it raw as the
 * only thing on offer.
 */
export function Alert({ error, className }: { error: unknown; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!error) return null;

  const { message, detail } = humanizeError(error);

  return (
    <div
      role="alert"
      className={cx(
        'rounded-card border border-negative-line bg-negative-wash px-4 py-3 text-negative-ink',
        className,
      )}
    >
      <p>{message}</p>
      {detail && detail !== message && (
        <>
          <button
            type="button"
            onClick={() => setOpen((was) => !was)}
            className="mt-1.5 text-caption underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-expanded={open}
          >
            {open ? 'Hide details' : 'Show details'}
          </button>
          {open && (
            <p className="mt-1.5 break-words font-mono text-caption text-muted">{detail}</p>
          )}
        </>
      )}
    </div>
  );
}
