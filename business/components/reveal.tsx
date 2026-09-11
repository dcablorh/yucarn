'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Content that arrives as it comes into view — React Bits' Animated
 * Content, in the one form this page actually uses.
 *
 * None of these components branch on `useReducedMotion`, and that is the
 * point rather than an oversight. That hook reads a media query, so it
 * returns null during server rendering and the real preference on the
 * client — branching on it renders one tree on the server and a
 * different one in the browser, which is a hydration mismatch: React
 * discards the server HTML and rebuilds the whole page, and the visitor
 * who asked for less motion is the only one who pays for it.
 *
 * The preference is honoured by `<MotionConfig reducedMotion="user">` at
 * the top of the page instead. It suppresses transform animations at
 * play time rather than at render time, so the markup is identical in
 * both cases and the y-travel below simply never happens. The opacity
 * fade survives, which is the intent: a fade is not what a vestibular
 * disorder objects to — movement is.
 *
 * `once: true` is the other prop that matters. A section that
 * re-animates every time it re-enters the viewport turns a scroll back
 * up the page into a flicker, and on a page this tall the visitor
 * scrolls back up a lot.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  /** Distance travelled on entry. 0 fades in place. */
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/**
 * The same entry, staggered across a list's children. Used for the step
 * list and the feature grid, where the items should feel dealt out
 * rather than dropped as a block.
 */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ shown: { transition: { staggerChildren: stagger } } }}
    >
      {children}
    </motion.div>
  );
}

/** One child of a RevealGroup. Inherits the parent's stagger timing. */
export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 20 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  );
}
