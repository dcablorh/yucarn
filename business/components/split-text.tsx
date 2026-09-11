'use client';

import { motion } from 'motion/react';
import { cx } from './cx';

/**
 * A headline that assembles itself a word at a time — React Bits' Split
 * Text, split on words rather than characters.
 *
 * Characters are the flashier choice and the wrong one here. A
 * per-character stagger on a fourteen-word headline runs for well over a
 * second before the sentence is readable, and this headline is the first
 * thing a visitor has to understand. Words let the line resolve in about
 * 500ms while still reading as composed rather than as a fade.
 *
 * The accessible name is on the wrapper, and every animated piece is
 * hidden from the accessibility tree. Without that, a screen reader
 * announces the heading as a stream of disconnected words.
 *
 * There is one tree here, not a reduced-motion variant beside an
 * animated one — see the note in reveal.tsx. Under
 * `<MotionConfig reducedMotion="user">` the words fade up in place
 * instead of rising, and the markup a reduced-motion visitor receives is
 * byte-identical to everyone else's.
 */
export function SplitText({
  text,
  className,
  delay = 0,
  stagger = 0.055,
  as: Tag = 'h1',
  /** Words to paint with the accent gradient, matched case-sensitively. */
  highlight,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  as?: 'h1' | 'h2' | 'p';
  highlight?: string;
}) {
  const words = text.split(' ');
  const highlighted = new Set(highlight ? highlight.split(' ') : []);

  const paint = (word: string) =>
    highlighted.has(word.replace(/[.,]$/, '')) ? 'text-gradient' : undefined;

  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`} aria-hidden="true" className="inline-block overflow-hidden">
          <motion.span
            className={cx('inline-block', paint(word))}
            initial={{ y: '108%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{
              duration: 0.72,
              delay: delay + index * stagger,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {word}
          </motion.span>
          {index < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}
