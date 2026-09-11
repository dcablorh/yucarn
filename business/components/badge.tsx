import type { ReactNode } from 'react';
import { cx } from './cx';

export type Tone = 'positive' | 'pending' | 'progress' | 'caution' | 'negative' | 'neutral';

/**
 * A wash, an ink and a ring per tone — never a fill. Filled badges would
 * compete with the primary action, and there is one chromatic fill per
 * viewport.
 *
 * Exported for callers that have no InvoiceStatus to hand (payroll), so
 * they stop re-guessing "paid green" from raw Tailwind palettes.
 */
export const TONE: Record<Tone, string> = {
  positive: 'bg-positive-wash text-positive-ink ring-positive-line',
  pending: 'bg-pending-wash text-pending-ink ring-pending-line',
  progress: 'bg-progress-wash text-progress-ink ring-progress-line',
  caution: 'bg-caution-wash text-caution-ink ring-caution-line',
  negative: 'bg-negative-wash text-negative-ink ring-negative-line',
  neutral: 'bg-neutral-wash text-neutral-ink ring-neutral-line',
};

/**
 * Badge owns the shape; the tone arrives as a class string. That split
 * keeps lib/status.ts as the single authority on what each invoice state
 * looks like, and keeps its suite passing unchanged.
 */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-label ring-1',
        className,
      )}
    >
      {children}
    </span>
  );
}
