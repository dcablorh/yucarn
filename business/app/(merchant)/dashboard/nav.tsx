'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cx } from '@/components/cx';

interface NavItem {
  href: string;
  label: string;
  /** Match only this exact path, not its descendants. */
  exact?: boolean;
  /** Route does not exist yet; render as a disabled row. */
  soon?: boolean;
}

const PRIMARY: NavItem[] = [
  { href: '/dashboard', label: 'Overview', exact: true },
  { href: '/dashboard/invoices', label: 'Invoices' },
  { href: '/dashboard/identity', label: 'Identity' },
  { href: '/dashboard/team', label: 'Team' },
  { href: '/dashboard/payroll', label: 'Payroll' },
];

const SECONDARY: NavItem[] = [{ href: '/dashboard/settings', label: 'Settings' }];

function isActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function Row({ item, pathname }: { item: NavItem; pathname: string }) {
  // Identity, Team and Payroll are built by later plans. Showing them
  // disabled gives the shell its real shape without routing merchants to
  // a 404.
  if (item.soon) {
    return (
      <span className="flex shrink-0 items-center justify-between gap-2 whitespace-nowrap rounded-control px-3 py-2 text-faint">
        {item.label}
        <span className="rounded-pill bg-surface-sunken px-1.5 py-0.5 text-caption uppercase text-faint">
          Soon
        </span>
      </span>
    );
  }

  const active = isActive(pathname, item);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cx(
        `shrink-0 whitespace-nowrap rounded-control px-3 py-2
         transition-colors duration-150
         focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
         focus-visible:outline-accent`,
        active
          ? // The active row is the one place accent-wash appears in the
            // shell, so the current screen is legible at a glance without
            // a second chromatic fill competing with the page's action.
            'bg-accent-wash font-medium text-accent'
          : 'text-muted hover:bg-surface-sunken hover:text-ink',
      )}
    >
      {item.label}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    // Below md the sidebar is a top bar, so the nav lies on its side and
    // scrolls horizontally rather than stacking down the page.
    <nav className="flex flex-1 gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-x-visible md:px-0 md:pb-0">
      {PRIMARY.map((item) => (
        <Row key={item.href} item={item} pathname={pathname} />
      ))}
      <div className="hidden border-t border-line md:my-3 md:block" />
      {SECONDARY.map((item) => (
        <Row key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
