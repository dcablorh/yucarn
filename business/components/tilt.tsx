'use client';

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import type { PointerEvent, ReactNode } from 'react';

/**
 * Perspective tilt toward the pointer — React Bits' Tilted Card.
 *
 * Held to eight degrees. The demos run to twenty, which looks
 * spectacular on a photograph and illegible on what this wraps: an
 * invoice showing a number a merchant is being asked to trust. Past
 * about ten degrees the mono figures start to keystone and the card
 * stops reading as a document.
 *
 * Springs rather than a transition, because the pointer is a continuous
 * input — a duration-based ease restarts on every move and produces a
 * card that stutters instead of tracking.
 */
export function Tilt({
  children,
  className,
  strength = 8,
}: {
  children: ReactNode;
  className?: string;
  /** Maximum rotation in degrees on either axis. */
  strength?: number;
}) {
  const still = useReducedMotion();

  // Normalised pointer position within the element, -0.5 to 0.5.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const config = { stiffness: 180, damping: 20, mass: 0.4 };
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [strength, -strength]), config);
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-strength, strength]), config);

  /*
   * The preference is checked in the handler, not at render. Returning a
   * different element for a reduced-motion visitor would mean the server
   * and the browser disagree about the tree — see the note in
   * reveal.tsx. Here the tree is constant and the springs simply never
   * receive a value, so the card sits flat and nothing moves.
   */
  const track = (event: PointerEvent<HTMLDivElement>) => {
    if (still) return;
    const box = event.currentTarget.getBoundingClientRect();
    px.set((event.clientX - box.left) / box.width - 0.5);
    py.set((event.clientY - box.top) / box.height - 0.5);
  };

  const release = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <motion.div
      className={className}
      onPointerMove={track}
      onPointerLeave={release}
      style={{ rotateX, rotateY, transformPerspective: 1100 }}
    >
      {children}
    </motion.div>
  );
}
