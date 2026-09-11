import type { ComponentProps, ReactNode } from 'react';
import { cx } from './cx';
import { Card } from './card';

/**
 * The ledger table. 44px rows, hairline rules, a sunken head, and its own
 * horizontal scroll box so a wide table never pushes the shell sideways.
 */
export function Table({
  head,
  children,
  className,
}: {
  head: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card padded={false} className={cx('overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="bg-surface-sunken">
            <tr className="border-b border-line">{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </Card>
  );
}

export function Th({ className, ...rest }: ComponentProps<'th'>) {
  // ink-soft, not muted: muted on surface-sunken measures 4.40:1, under
  // AA's 4.5:1 for 11px uppercase text. ink-soft measures 6.99:1 on the
  // same surface, and is already the token meant for table content.
  return (
    <th className={cx('px-4 py-2.5 text-label uppercase text-ink-soft', className)} {...rest} />
  );
}

export function Tr({ className, ...rest }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cx('h-11 border-b border-line last:border-0 hover:bg-canvas', className)}
      {...rest}
    />
  );
}

export function Td({ className, ...rest }: ComponentProps<'td'>) {
  return <td className={cx('px-4 text-ink-soft', className)} {...rest} />;
}
