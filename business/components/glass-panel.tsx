'use client';

import { useRef, type PointerEvent, type ReactNode } from 'react';
import { cx } from './cx';

/**
 * A panel on the dark stage. `Card` is the paper equivalent and stays
 * exactly what it is — this is the other material, and the two are not
 * interchangeable: a Card's white fill over a moving shader would hide
 * the shader, which is the only reason the shader is there.
 *
 * The blur is what makes it glass rather than a grey rectangle. It is
 * also the expensive part, so it is applied once per panel and never
 * nested.
 */
export function GlassPanel({
  children,
  className,
  as: Tag = 'div',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'figure' | 'li' | 'article';
  padded?: boolean;
}) {
  return (
    <Tag
      className={cx(
        'rounded-card border border-glass-line bg-glass backdrop-blur-xl',
        padded && 'p-6',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/**
 * A glass panel whose border and interior light up under the pointer —
 * React Bits' Spotlight Card, and the behaviour that makes their Magic
 * Bento grid read as one surface instead of six tiles.
 *
 * The pointer position is written straight to the node as CSS custom
 * properties. Routing it through React state instead would re-render a
 * panel on every pointermove, which at 120Hz across a six-cell grid is
 * the kind of thing that makes a page feel worse the more it animates.
 * The gradient, the fade and the reduced-motion behaviour all live in
 * globals.css; this component's whole job is two numbers.
 */
export function SpotlightPanel({
  children,
  className,
  as = 'div',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'figure' | 'li' | 'article';
  padded?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const node = ref.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    node.style.setProperty('--spot-x', `${event.clientX - box.left}px`);
    node.style.setProperty('--spot-y', `${event.clientY - box.top}px`);
    node.dataset.lit = 'true';
  };

  const release = () => {
    const node = ref.current;
    if (node) node.dataset.lit = 'false';
  };

  return (
    <div
      ref={ref}
      onPointerMove={track}
      onPointerLeave={release}
      className={cx('spotlight rounded-card', className)}
    >
      <span aria-hidden="true" className="spotlight-glow" />
      <span aria-hidden="true" className="spotlight-edge" />
      <GlassPanel as={as} padded={padded} className="h-full">
        {children}
      </GlassPanel>
    </div>
  );
}
