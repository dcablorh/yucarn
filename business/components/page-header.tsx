import type { ReactNode } from 'react';

/**
 * The same three-part header on all ten dashboard pages: what this screen
 * is, one line on what it does, and at most one action.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-title text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[62ch] text-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
