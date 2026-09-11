'use client';

import type { CSSProperties } from 'react';
import { cx } from './cx';

/**
 * An endlessly scrolling row — React Bits' Logo Loop, carrying names
 * rather than logos.
 *
 * The track is rendered twice and translated by exactly -50% of its own
 * width, which is what makes the seam invisible without measuring
 * anything: at the moment the animation resets, copy two is sitting
 * precisely where copy one started. Every other approach to this needs a
 * ResizeObserver and still stutters on the wrap.
 *
 * Only the first copy is in the accessibility tree. The second is a
 * visual duplicate, and a screen reader that reads this list twice is
 * reporting a bug that does not exist.
 *
 * The animation, the hover-pause and the reduced-motion behaviour are in
 * globals.css under `.marquee-track`.
 */
export function Marquee({
  items,
  className,
  duration = 42,
}: {
  items: readonly string[];
  className?: string;
  /** Seconds for one full pass. Longer is calmer. */
  duration?: number;
}) {
  const copy = (hidden: boolean) => (
    <ul
      aria-hidden={hidden || undefined}
      className="flex shrink-0 items-center gap-3 pr-3 sm:gap-4 sm:pr-4"
    >
      {items.map((item) => (
        <li
          key={item}
          className="flex shrink-0 items-center gap-2.5 rounded-pill border border-glass-line bg-glass px-4 py-2 whitespace-nowrap text-body text-muted-inverse"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-pill bg-accent-inverse" />
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cx(
        'marquee overflow-hidden',
        '[mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]',
        className,
      )}
    >
      <div
        className="marquee-track"
        style={{ '--marquee-duration': `${duration}s` } as CSSProperties}
      >
        {copy(false)}
        {copy(true)}
      </div>
    </div>
  );
}
