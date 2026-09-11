import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * A surface on the canvas. The 1px line is the structure; a card gets no
 * shadow unless a caller has a reason, and shadow-float is limited to one
 * element per view.
 *
 * `padded={false}` is for cards whose child owns its own spacing — a
 * table, or a divided list.
 */
export function Card({
  padded = true,
  as: Tag = 'div',
  className,
  children,
}: {
  padded?: boolean;
  /**
   * `figure` is for a card that *is* an illustration — the landing page's
   * payment-request preview, whose merchant name is its caption. Two
   * literal tags rather than a generic, matching Figure's `as`: without
   * it a caller wanting a <figcaption> has to hand-roll the card, which
   * both loses the primitive and trips the design-system guard.
   */
  as?: 'div' | 'figure';
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={cx('rounded-card border border-line bg-surface', padded && 'p-5', className)}>
      {children}
    </Tag>
  );
}
