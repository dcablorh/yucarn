import type { ReactNode } from 'react';
import { cx } from './cx';

type Tone = 'ink' | 'muted' | 'inverse' | 'accent-inverse';

/**
 * Amount and unit are toned as a pair, because the unit is always the
 * quieter of the two and "quieter" means something different on a dark
 * ground: `muted` measures 3.65:1 on `surface-inverse` and fails AA
 * there, so an inverse figure needs `muted-inverse` for its unit rather
 * than the same class the light figures use.
 */
const TONE: Record<Tone, { amount: string; unit: string }> = {
  ink: { amount: 'text-ink', unit: 'text-muted' },
  muted: { amount: 'text-muted', unit: 'text-muted' },
  inverse: { amount: 'text-ink-inverse', unit: 'text-muted-inverse' },
  'accent-inverse': { amount: 'text-accent-inverse', unit: 'text-muted-inverse' },
};

/**
 * A monetary amount at display size. Mono with tabular figures, because
 * these line up column-wise elsewhere in the app and a merchant should
 * read the same glyphs in both places. The unit rides at 0.42em so the
 * number stays the thing you see.
 */
export function Figure({
  amount,
  unit = 'USDC',
  size = 'md',
  tone = 'ink',
  as: Tag = 'p',
  className,
}: {
  /**
   * A ReactNode rather than a string so a caller can mark up part of the
   * number — the landing page underlines an invoice's identifying tail
   * inside the amount, and used to hand-copy this component's internals
   * to do it.
   */
  amount: ReactNode;
  unit?: string;
  size?: 'md' | 'lg';
  tone?: Tone;
  /**
   * On a page whose subject *is* the amount — an invoice, a payment
   * request — the figure is the page title, so it needs to be a heading.
   * A plain union of three tags rather than a generic: three is all any
   * caller needs, and it stays readable under strict TypeScript.
   */
  as?: 'p' | 'h1' | 'h2';
  className?: string;
}) {
  return (
    <Tag className={cx('font-mono', size === 'lg' ? 'text-display' : 'text-title', TONE[tone].amount, className)}>
      {amount}
      {unit && (
        <span
          className={cx(
            'align-baseline text-[0.42em] font-normal tracking-normal',
            TONE[tone].unit,
          )}
        >
          {' '}{unit}
        </span>
      )}
    </Tag>
  );
}
