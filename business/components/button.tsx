import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'quiet' | 'glass';
type Size = 'sm' | 'md' | 'lg';

/**
 * The focus ring's geometry lives here on purpose. Before this component,
 * one of seventeen hand-typed accent buttons had focus-visible styles;
 * putting it in the base fixes the other sixteen at once.
 *
 * Its COLOUR does not live here, and that is a deliberate correction. It
 * used to, and a dark-ground caller had to append
 * `focus-visible:outline-accent-inverse` through className to undo it —
 * which is not an override at all. Tailwind emits both utilities and the
 * cascade picks the one that happens to sit later in the stylesheet, not
 * the one written last in the class list. Every variant now names its own
 * ring colour, so there is only ever one outline-color utility on the
 * element and nothing to lose a cascade to.
 */
const BASE = `
  inline-flex shrink-0 items-center justify-center gap-2
  rounded-control font-medium whitespace-nowrap
  transition-colors duration-150
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
  disabled:cursor-not-allowed disabled:opacity-40
`;

/**
 * primary is the only chromatic fill, and there is one per viewport.
 *
 * `glass` is the dark stage's secondary. It is a variant rather than a
 * className because it changes three properties at once — fill, border
 * and ring — and every one of them collides with the light secondary it
 * would otherwise have to override.
 */
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-sunken',
  quiet: 'text-muted hover:text-ink',
  glass: `border border-glass-line bg-glass text-ink-inverse backdrop-blur-xl
          hover:bg-glass-strong hover:border-glass-line-strong`,
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
  // The payment page earns a larger control: a full-width primary action
  // needs to clear the 44px touch-target minimum at the 13px base.
  lg: 'px-5 py-3',
};

export function buttonClass({
  variant = 'primary',
  size = 'md',
  onDark = false,
  className,
}: { variant?: Variant; size?: Size; onDark?: boolean; className?: string } = {}): string {
  // `glass` exists only for the dark stage, so it never has to be asked.
  const dark = onDark || variant === 'glass';
  return cx(
    BASE,
    VARIANT[variant],
    SIZE[size],
    dark ? 'focus-visible:outline-accent-inverse' : 'focus-visible:outline-accent',
    className,
  );
}

export function Button({
  variant,
  size,
  onDark,
  className,
  type = 'button',
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; onDark?: boolean }) {
  return (
    <button type={type} className={buttonClass({ variant, size, onDark, className })} {...rest} />
  );
}

export function ButtonLink({
  variant,
  size,
  onDark,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; onDark?: boolean }) {
  return <Link className={buttonClass({ variant, size, onDark, className })} {...rest} />;
}

/**
 * An accent text link inside prose — an explorer receipt, a "Try again", a
 * cross-reference. Nine of these existed with no focus ring at all; a
 * keyboard user could not see where they were. It is a class helper rather
 * than a component because the call sites are a mix of <a>, next/link and
 * <button>, and none of them should have to change element to gain a ring.
 */
export function linkClass(className?: string): string {
  return cx(
    `rounded-control text-accent underline-offset-2 hover:underline
     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
     focus-visible:outline-accent`,
    className,
  );
}
