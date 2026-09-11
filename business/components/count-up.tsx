'use client';

import { useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * A figure that counts up the first time it is seen.
 *
 * Hand-rolled on requestAnimationFrame rather than driven by motion's
 * `animate`, because what has to be interpolated is the *number*, and
 * then formatted to a fixed number of decimals every frame. Handing that
 * to a spring gives 100.00 USDC a bounce that overshoots to 103.71 and
 * settles back, which on a page whose entire claim is "you receive the
 * exact figure you asked for" is the one thing the animation must not do.
 *
 * So: a fixed duration, an ease-out curve, and a guaranteed landing on
 * the exact target on the final frame.
 */
export function CountUp({
  to,
  decimals = 2,
  duration = 1400,
  className,
}: {
  to: number;
  decimals?: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const still = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;

    /*
     * The reduced-motion jump happens here rather than in render. It has
     * to: `useReducedMotion` reads a media query, which is null on the
     * server, so a render that returned `to` for a reduced-motion
     * visitor and 0 for the server would be a hydration mismatch. Both
     * sides render 0, and this lands the real figure a frame later.
     */
    if (still) {
      const jump = requestAnimationFrame(() => setValue(to));
      return () => cancelAnimationFrame(jump);
    }

    let frame = 0;
    let start: number | undefined;

    const step = (now: number) => {
      start ??= now;
      const progress = Math.min((now - start) / duration, 1);
      // Ease-out quint: fast enough to feel responsive, slow enough at
      // the tail that the final digits are readable as they settle.
      setValue(to * (1 - Math.pow(1 - progress, 5)));
      if (progress < 1) frame = requestAnimationFrame(step);
      else setValue(to);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [inView, still, to, duration]);

  return (
    <span ref={ref} className={className}>
      {value.toFixed(decimals)}
    </span>
  );
}
