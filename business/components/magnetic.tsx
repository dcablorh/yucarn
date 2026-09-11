'use client';

import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';

/**
 * A control that leans toward the pointer as it approaches — React Bits'
 * Magnet.
 *
 * The pull is capped by `range` rather than being proportional without
 * limit, because an unbounded magnet moves the button out from under the
 * cursor that is chasing it. Six pixels is enough to register as
 * responsive and small enough that the click target never leaves the
 * place the visitor aimed at.
 *
 * `display: inline-flex` on the wrapper matters: wrapping a button in a
 * block-level div silently makes it full-width, which is how a magnetic
 * CTA ends up stretched across a hero.
 */
export function Magnetic({
  children,
  className,
  range = 6,
}: {
  children: ReactNode;
  className?: string;
  /** Maximum travel in pixels. */
  range?: number;
}) {
  const still = useReducedMotion();

  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18, mass: 0.3 });
  const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18, mass: 0.3 });

  // Checked in the handler rather than at render, so the server and the
  // browser always agree on the tree — see the note in reveal.tsx.
  const track = (event: PointerEvent<HTMLSpanElement>) => {
    if (still) return;
    const box = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - box.left) / box.width - 0.5) * range * 2);
    y.set(((event.clientY - box.top) / box.height - 0.5) * range * 2);
  };

  const release = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.span
      className={className}
      style={{ x, y, display: 'inline-flex' }}
      onPointerMove={track}
      onPointerLeave={release}
    >
      {children}
    </motion.span>
  );
}
