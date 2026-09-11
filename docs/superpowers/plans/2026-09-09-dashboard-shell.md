# UniPay Dashboard Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the three unstyled merchant screens into a navigable dashboard with a distinct merchant visual identity, an invoice table, an invoice detail page with an honest status timeline, an overview, and settings.

**Architecture:** Purely frontend. A client-side `dashboard/layout.tsx` owns authentication redirect, one-time business registration, and the sidebar chrome; pages below it render content only. All display logic that can be tested without a DOM — status presentation, overview aggregation, timeline derivation — lives in pure modules under `business/lib/` with colocated Vitest tests, matching the existing `lib/format.ts` + `lib/format.test.ts` pattern.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19.2.8, Tailwind v4, `@privy-io/react-auth` 3.40, Vitest 3.2.7, `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-09-09-unipay-merchant-dashboard-design.md` §2

## Global Constraints

- **No file under `client/` is created, edited, or deleted.** Another developer owns it.
- **No file under `server/` is changed by this plan.** Every endpoint this plan needs already exists: `POST /auth/register`, `GET /auth/me`, `GET /invoices`, `GET /invoices/:id`, `POST /invoices`.
- **No new npm dependencies** beyond what `business/package.json` already declares. Fonts come from `next/font/google`, which ships with Next.
- Amounts are integer base units (6-decimal micro-USDC). They arrive from the API as **strings** (`server/src/common/bigint-json.ts` gives `BigInt.prototype.toJSON`), are converted with `BigInt(...)`, and are never parsed as `number` or `float`.
- Money and addresses render in the mono face with `tabular-nums`. Never in the proportional face.
- Design tokens, verbatim: ground `#FAFAF9`, card `#FFFFFF`, line `#E7E5E4`, ink `#1C1917`, muted `#78716C`, accent `#0D9488`, accent-hover `#0F766E`. Base text 13px, table rows 44px.
- `business/app/i/[id]/` — the public customer-facing invoice page — is **not** part of the dashboard shell and keeps its own standalone layout. Only Task 1's global token change touches how it looks.
- **Terminal invoice statuses are `PAID`, `EXPIRED`, `FAILED`.** `UNDERPAID` is *open* — `server/src/invoices/invoice-state.ts` allows `UNDERPAID → PAID`. Do not treat it as final.
- **Registration must never run on a polling interval.** `POST /auth/register` upserts `Business.walletAddress`, and `useWallets()` ordering is not stable between a connected and an embedded wallet, so repeat calls could silently change where invoices pay out. This was a blocking review fix (commit `b4c67f5`); the layout preserves it.
- Run all commands from `business/`. `npm test` runs `vitest run && npm run lint` — both must pass before any commit.

---

## File Structure

**Create**

| Path | Responsibility |
|---|---|
| `business/lib/status.ts` | Invoice status → label, pill classes, terminality |
| `business/lib/status.test.ts` | Tests for the above |
| `business/lib/overview.ts` | Aggregate an invoice list into overview figures |
| `business/lib/overview.test.ts` | Tests for the above |
| `business/lib/timeline.ts` | Invoice → ordered timeline steps, including the skipped-`PROCESSING` case |
| `business/lib/timeline.test.ts` | Tests for the above |
| `business/lib/business-context.tsx` | React context carrying the registered `Business` |
| `business/lib/use-invoices.ts` | Polling invoice-list hook shared by Overview and Invoices |
| `business/app/(merchant)/dashboard/layout.tsx` | Auth redirect, one-time registration, sidebar chrome |
| `business/app/(merchant)/dashboard/nav.tsx` | Sidebar links with active state |
| `business/app/(merchant)/dashboard/invoices/page.tsx` | Invoice table |
| `business/app/(merchant)/dashboard/invoices/[id]/page.tsx` | Invoice detail with timeline |
| `business/app/(merchant)/dashboard/settings/page.tsx` | Payout wallet, business name, wallet management |

**Modify**

| Path | Change |
|---|---|
| `business/app/globals.css` | Replace the `create-next-app` scaffold with the merchant token set |
| `business/app/layout.tsx` | Swap Geist for IBM Plex Sans / IBM Plex Mono |
| `business/lib/format.ts` | Add `formatDateTime` |
| `business/lib/format.test.ts` | Tests for `formatDateTime` |
| `business/lib/api.ts` | Add `getInvoice`, `getMe`; widen `Invoice`; correct `registerBusiness` return type |
| `business/app/(merchant)/dashboard/page.tsx` | Becomes Overview; sheds registration and list logic |
| `business/app/(merchant)/dashboard/invoices/new/page.tsx` | Restyle onto tokens |
| `business/app/(merchant)/page.tsx` | Restyle login onto tokens |

---

## Task 1: Design tokens and typography

**Files:**
- Modify: `business/app/globals.css`
- Modify: `business/app/layout.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: Tailwind utility classes `bg-ground`, `bg-card`, `border-line`, `text-ink`, `text-muted`, `bg-accent`, `text-accent`, `hover:bg-accent-hover`; font variables `--font-plex-sans`, `--font-plex-mono` bound to Tailwind's `font-sans` / `font-mono`. Every later task uses these names.

This task has no unit test — it is CSS and font configuration, with nothing pure to assert. It is verified by a passing build, a passing lint, and the described visual check.

- [ ] **Step 1: Replace the stylesheet**

Overwrite `business/app/globals.css` completely:

```css
@import "tailwindcss";

@theme {
  --color-ground: #FAFAF9;
  --color-card: #FFFFFF;
  --color-line: #E7E5E4;
  --color-ink: #1C1917;
  --color-muted: #78716C;
  --color-accent: #0D9488;
  --color-accent-hover: #0F766E;

  --font-sans: var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, SFMono-Regular, monospace;
}

body {
  background: var(--color-ground);
  color: var(--color-ink);
  font-family: var(--font-sans);
  /* 13px base. The dashboard is a ledger; density is the point. */
  font-size: 0.8125rem;
  line-height: 1.5;
}

/*
 * Amounts and addresses render in the mono face, and in a table they must
 * line up column-wise. Tabular figures are what make that true; without
 * this, every mono number in the app is proportionally spaced.
 */
.font-mono {
  font-variant-numeric: tabular-nums;
}
```

Note what is deliberately gone: the `prefers-color-scheme: dark` block from the scaffold. The spec commits to a single light-first merchant identity (§2.2), and a half-built dark mode reads worse than none.

- [ ] **Step 2: Swap the fonts**

In `business/app/layout.tsx`, replace the `Geist` / `Geist_Mono` imports and constants with IBM Plex, and update the `className` on `<html>`:

```tsx
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});
```

```tsx
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ground text-ink">
        {children}
      </body>
    </html>
```

IBM Plex is not a variable font on Google Fonts, so the explicit `weight` arrays are required — omitting them is a build error, not a silent fallback.

- [ ] **Step 3: Verify the build and lint pass**

Run: `cd business && npm run build && npm run lint`
Expected: build succeeds, lint reports no errors. If the build fails on the font import, confirm the weight arrays are present.

- [ ] **Step 4: Visual check**

Run: `cd business && npm run dev`, open `http://localhost:3000/i/anything` (a 404 is fine — the point is the body chrome).
Expected: warm off-white background rather than pure white, IBM Plex rather than Arial.

- [ ] **Step 5: Commit**

```bash
git add business/app/globals.css business/app/layout.tsx
git commit -m "feat(business): add merchant design tokens and IBM Plex typography"
```

---

## Task 2: Shared types, status presentation, and date formatting

**Files:**
- Modify: `business/lib/api.ts`
- Create: `business/lib/status.ts`
- Create: `business/lib/status.test.ts`
- Modify: `business/lib/format.ts`
- Modify: `business/lib/format.test.ts`

**Interfaces:**
- Consumes: `InvoiceStatus` from `business/lib/api.ts` (already exported there)
- Produces:
  - `Business` interface: `{ id: string; privyUserId: string; walletAddress: string; name: string | null; createdAt: string; updatedAt: string }`
  - `Invoice` widened with `sourceTxHash: string | null` and `paidAt: string | null`
  - `presentStatus(status: InvoiceStatus): StatusPresentation` where `StatusPresentation = { label: string; className: string; terminal: boolean }`
  - `isTerminal(status: InvoiceStatus): boolean`
  - `formatDateTime(iso: string): string`

The type widening lands here rather than in Task 5 because Tasks 3 and 4 build `Invoice` literals in their tests. Widening later would leave those two tasks failing `tsc` when built in order.

- [ ] **Step 1: Widen the Invoice type and add the Business type**

In `business/lib/api.ts`, replace the `Invoice` interface and add `Business` above it:

```ts
export interface Business {
  id: string;
  privyUserId: string;
  walletAddress: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  amountBase: string;   // BigInt serialized as a string
  payableBase: string;
  recipient: string;
  destChain: string;
  asset: string;
  status: InvoiceStatus;
  description: string | null;
  sourceTxHash: string | null;
  destTxHash: string | null;
  paidAt: string | null;
  expiresAt: string;
  createdAt: string;
}
```

`GET /invoices` and `GET /invoices/:id` both return whole Prisma rows, so these fields are already on the wire — the interface was simply narrower than the payload.

- [ ] **Step 2: Write the failing status test**

Create `business/lib/status.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { presentStatus, isTerminal } from './status';
import type { InvoiceStatus } from './api';

const ALL: InvoiceStatus[] = [
  'PENDING', 'PROCESSING', 'PAID', 'EXPIRED', 'UNDERPAID', 'FAILED',
];

describe('presentStatus', () => {
  it('gives every status a label and pill classes', () => {
    for (const status of ALL) {
      const presentation = presentStatus(status);
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.className).toContain('bg-');
    }
  });

  it('titles the label rather than shouting the enum', () => {
    expect(presentStatus('PENDING').label).toBe('Pending');
    expect(presentStatus('UNDERPAID').label).toBe('Underpaid');
  });
});

describe('isTerminal', () => {
  it('treats paid, expired and failed as final', () => {
    expect(isTerminal('PAID')).toBe(true);
    expect(isTerminal('EXPIRED')).toBe(true);
    expect(isTerminal('FAILED')).toBe(true);
  });

  it('treats pending and processing as open', () => {
    expect(isTerminal('PENDING')).toBe(false);
    expect(isTerminal('PROCESSING')).toBe(false);
  });

  it('treats underpaid as open, because it can still become paid', () => {
    // server/src/invoices/invoice-state.ts allows UNDERPAID -> PAID.
    // Rendering it as final would tell the merchant a recoverable
    // invoice is dead.
    expect(isTerminal('UNDERPAID')).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd business && npx vitest run lib/status.test.ts`
Expected: FAIL — cannot resolve `./status`.

- [ ] **Step 4: Write the status module**

Create `business/lib/status.ts`:

```ts
import type { InvoiceStatus } from './api';

export interface StatusPresentation {
  label: string;
  /** Tailwind classes for the status pill. */
  className: string;
  /** True when no further status change is possible. */
  terminal: boolean;
}

/**
 * Terminality mirrors server/src/invoices/invoice-state.ts, where UNDERPAID
 * is an OPEN status with a legal UNDERPAID -> PAID transition. Only PAID,
 * EXPIRED and FAILED have no outgoing transitions.
 */
const PRESENTATION: Record<InvoiceStatus, StatusPresentation> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    terminal: false,
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
    terminal: false,
  },
  PAID: {
    label: 'Paid',
    className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    terminal: true,
  },
  EXPIRED: {
    label: 'Expired',
    className: 'bg-stone-100 text-stone-600 ring-1 ring-stone-200',
    terminal: true,
  },
  UNDERPAID: {
    label: 'Underpaid',
    className: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
    terminal: false,
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-red-50 text-red-700 ring-1 ring-red-200',
    terminal: true,
  },
};

export function presentStatus(status: InvoiceStatus): StatusPresentation {
  return PRESENTATION[status];
}

export function isTerminal(status: InvoiceStatus): boolean {
  return PRESENTATION[status].terminal;
}
```

- [ ] **Step 5: Run it to confirm it passes**

Run: `cd business && npx vitest run lib/status.test.ts`
Expected: PASS

- [ ] **Step 6: Write the failing date test**

Append to `business/lib/format.test.ts`:

```ts
describe('formatDateTime', () => {
  it('renders an ISO timestamp in UTC', () => {
    expect(formatDateTime('2026-09-09T14:05:00.000Z')).toBe('9 Sep 2026, 14:05 UTC');
  });

  it('renders a timestamp without milliseconds', () => {
    expect(formatDateTime('2026-01-02T03:04:00Z')).toBe('2 Jan 2026, 03:04 UTC');
  });

  it('returns a dash for an unparseable value', () => {
    expect(formatDateTime('not a date')).toBe('—');
  });
});
```

And widen the import at the top of that file:

```ts
import { formatUsdc, parseUsdcInput, formatDateTime } from './format';
```

- [ ] **Step 7: Run it to confirm it fails**

Run: `cd business && npx vitest run lib/format.test.ts`
Expected: FAIL — `formatDateTime is not a function`.

- [ ] **Step 8: Add formatDateTime**

Append to `business/lib/format.ts`:

```ts
/**
 * Timestamps render in UTC, not the viewer's zone. A merchant reconciling
 * against an Arc block explorer is reading UTC there, and a dashboard that
 * silently localises makes those two views disagree by hours.
 *
 * The fixed timeZone also makes this deterministic under test.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} UTC`;
}
```

`formatToParts` rather than `format` because `Intl` output punctuation varies between Node versions, and asserting on a hand-assembled string keeps the test stable.

- [ ] **Step 9: Run the full suite**

Run: `cd business && npm test`
Expected: PASS, lint clean.

- [ ] **Step 10: Commit**

```bash
git add business/lib/api.ts business/lib/status.ts business/lib/status.test.ts business/lib/format.ts business/lib/format.test.ts
git commit -m "feat(business): add shared types, status presentation, and UTC date formatting"
```

---

## Task 3: Overview aggregation

**Files:**
- Create: `business/lib/overview.ts`
- Create: `business/lib/overview.test.ts`

**Interfaces:**
- Consumes: `Invoice` from `business/lib/api.ts`, `isTerminal` from `business/lib/status.ts`
- Produces: `deriveOverview(invoices: Invoice[]): OverviewStats` where `OverviewStats = { receivedBase: bigint; awaitingBase: bigint; openCount: number; paidCount: number }`

- [ ] **Step 1: Write the failing test**

Create `business/lib/overview.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveOverview } from './overview';
import type { Invoice, InvoiceStatus } from './api';

function invoice(status: InvoiceStatus, payableBase: string): Invoice {
  return {
    id: `id-${status}-${payableBase}`,
    amountBase: payableBase,
    payableBase,
    recipient: '0x0000000000000000000000000000000000000001',
    destChain: 'arc-testnet',
    asset: 'USDC',
    status,
    description: null,
    sourceTxHash: null,
    destTxHash: null,
    paidAt: null,
    expiresAt: '2026-09-10T00:00:00.000Z',
    createdAt: '2026-09-09T00:00:00.000Z',
  };
}

describe('deriveOverview', () => {
  it('returns zeroes for an empty list', () => {
    expect(deriveOverview([])).toEqual({
      receivedBase: 0n,
      awaitingBase: 0n,
      openCount: 0,
      paidCount: 0,
    });
  });

  it('sums only paid invoices into received', () => {
    const stats = deriveOverview([
      invoice('PAID', '100000000'),
      invoice('PAID', '50000000'),
      invoice('PENDING', '25000000'),
    ]);
    expect(stats.receivedBase).toBe(150_000_000n);
    expect(stats.paidCount).toBe(2);
  });

  it('sums non-terminal invoices into awaiting', () => {
    const stats = deriveOverview([
      invoice('PENDING', '25000000'),
      invoice('PROCESSING', '10000000'),
      invoice('UNDERPAID', '5000000'),
      invoice('EXPIRED', '99000000'),
    ]);
    expect(stats.awaitingBase).toBe(40_000_000n);
    expect(stats.openCount).toBe(3);
  });

  it('excludes expired and failed invoices from both figures', () => {
    const stats = deriveOverview([
      invoice('EXPIRED', '100000000'),
      invoice('FAILED', '100000000'),
    ]);
    expect(stats.receivedBase).toBe(0n);
    expect(stats.awaitingBase).toBe(0n);
    expect(stats.openCount).toBe(0);
    expect(stats.paidCount).toBe(0);
  });

  it('sums payableBase, which is what actually arrived', () => {
    // amountBase is what the merchant asked for; payableBase adds the
    // amount nonce and is what the customer actually sent.
    const paid = invoice('PAID', '100004417');
    paid.amountBase = '100000000';
    expect(deriveOverview([paid]).receivedBase).toBe(100_004_417n);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd business && npx vitest run lib/overview.test.ts`
Expected: FAIL — cannot resolve `./overview`.

- [ ] **Step 3: Write the module**

Create `business/lib/overview.ts`:

```ts
import type { Invoice } from './api';
import { isTerminal } from './status';

export interface OverviewStats {
  /** Sum of payableBase across PAID invoices. */
  receivedBase: bigint;
  /** Sum of payableBase across invoices that can still be paid. */
  awaitingBase: bigint;
  openCount: number;
  paidCount: number;
}

/**
 * Aggregates client-side from the invoice list the dashboard already polls,
 * rather than through a dedicated stats endpoint. A merchant's invoice list
 * is small, the list is already in memory, and adding a server route would
 * put this plan into server/ for no gain.
 *
 * Figures use payableBase, not amountBase: payableBase carries the amount
 * nonce and is the sum the customer actually transferred.
 */
export function deriveOverview(invoices: Invoice[]): OverviewStats {
  let receivedBase = 0n;
  let awaitingBase = 0n;
  let openCount = 0;
  let paidCount = 0;

  for (const invoice of invoices) {
    const payable = BigInt(invoice.payableBase);

    if (invoice.status === 'PAID') {
      receivedBase += payable;
      paidCount += 1;
    } else if (!isTerminal(invoice.status)) {
      awaitingBase += payable;
      openCount += 1;
    }
  }

  return { receivedBase, awaitingBase, openCount, paidCount };
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd business && npx vitest run lib/overview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add business/lib/overview.ts business/lib/overview.test.ts
git commit -m "feat(business): derive overview figures from the invoice list"
```

---

## Task 4: Invoice timeline derivation

**Files:**
- Create: `business/lib/timeline.ts`
- Create: `business/lib/timeline.test.ts`

**Interfaces:**
- Consumes: `Invoice` from `business/lib/api.ts`
- Produces: `deriveTimeline(invoice: Invoice): TimelineStep[]`, `TimelineStep = { key: 'created' | 'processing' | 'settled'; label: string; state: TimelineState; detail?: string }`, `TimelineState = 'done' | 'current' | 'pending' | 'skipped' | 'failed'`

This is the task that carries spec §2.3: an invoice that jumps `PENDING → PAID` must render `Processing` as **skipped with an explanation**, never as a stuck spinner. The consumer app does not call `POST /public/invoices/:id/payments`, so this is the *normal* path today, not an edge case.

- [ ] **Step 1: Write the failing test**

Create `business/lib/timeline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deriveTimeline } from './timeline';
import type { Invoice, InvoiceStatus } from './api';

function invoice(status: InvoiceStatus, overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv1',
    amountBase: '100000000',
    payableBase: '100004417',
    recipient: '0x0000000000000000000000000000000000000001',
    destChain: 'arc-testnet',
    asset: 'USDC',
    status,
    description: null,
    sourceTxHash: null,
    destTxHash: null,
    paidAt: null,
    expiresAt: '2026-09-10T00:00:00.000Z',
    createdAt: '2026-09-09T00:00:00.000Z',
    ...overrides,
  };
}

const stateOf = (invoiceValue: Invoice, key: string) =>
  deriveTimeline(invoiceValue).find((step) => step.key === key)!;

describe('deriveTimeline', () => {
  it('always returns the three steps in order', () => {
    expect(deriveTimeline(invoice('PENDING')).map((step) => step.key)).toEqual([
      'created', 'processing', 'settled',
    ]);
  });

  it('marks created done for every status', () => {
    for (const status of ['PENDING', 'PROCESSING', 'PAID', 'EXPIRED', 'FAILED'] as InvoiceStatus[]) {
      expect(stateOf(invoice(status), 'created').state).toBe('done');
    }
  });

  it('leaves processing pending while the invoice is pending', () => {
    expect(stateOf(invoice('PENDING'), 'processing').state).toBe('pending');
    expect(stateOf(invoice('PENDING'), 'settled').state).toBe('pending');
  });

  it('marks processing current while the invoice is processing', () => {
    expect(stateOf(invoice('PROCESSING'), 'processing').state).toBe('current');
  });

  it('marks processing skipped when a paid invoice was never reported', () => {
    // The consumer app does not call POST /public/invoices/:id/payments
    // (spec base doc s10), so PENDING -> PAID with no sourceTxHash is the
    // normal path. It must read as skipped-and-explained, not as a step
    // that is still running.
    const step = stateOf(invoice('PAID'), 'processing');
    expect(step.state).toBe('skipped');
    expect(step.detail).toMatch(/not reported/i);
  });

  it('marks processing done when a paid invoice was reported', () => {
    const step = stateOf(invoice('PAID', { sourceTxHash: '0xabc' }), 'processing');
    expect(step.state).toBe('done');
  });

  it('marks settled done and carries the Arc transaction hash', () => {
    const step = stateOf(invoice('PAID', { destTxHash: '0xdef' }), 'settled');
    expect(step.state).toBe('done');
    expect(step.detail).toBe('0xdef');
  });

  it('marks settled skipped for an expired invoice', () => {
    expect(stateOf(invoice('EXPIRED'), 'settled').state).toBe('skipped');
    expect(stateOf(invoice('EXPIRED'), 'processing').state).toBe('skipped');
  });

  it('marks settled failed for a failed invoice', () => {
    expect(stateOf(invoice('FAILED'), 'settled').state).toBe('failed');
  });

  it('keeps an underpaid invoice open rather than failing it', () => {
    // UNDERPAID -> PAID is a legal server-side transition.
    const step = stateOf(invoice('UNDERPAID'), 'settled');
    expect(step.state).toBe('current');
    expect(step.detail).toMatch(/short/i);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd business && npx vitest run lib/timeline.test.ts`
Expected: FAIL — cannot resolve `./timeline`.

- [ ] **Step 3: Write the module**

Create `business/lib/timeline.ts`:

```ts
import type { Invoice } from './api';

export type TimelineState = 'done' | 'current' | 'pending' | 'skipped' | 'failed';

export interface TimelineStep {
  key: 'created' | 'processing' | 'settled';
  label: string;
  state: TimelineState;
  /** Explanatory line, or the transaction hash on a settled step. */
  detail?: string;
}

/**
 * The PDF's Pending -> Processing -> Paid, rendered honestly.
 *
 * PROCESSING is only ever set by POST /public/invoices/:id/payments, which
 * the consumer checkout app does not call today. An invoice therefore
 * normally goes straight from PENDING to PAID, and the Processing step must
 * say it was skipped and why — showing a spinner there would claim work is
 * in progress that nothing is doing.
 */
export function deriveTimeline(invoice: Invoice): TimelineStep[] {
  return [
    { key: 'created', label: 'Created', state: 'done', detail: invoice.createdAt },
    processingStep(invoice),
    settledStep(invoice),
  ];
}

function processingStep(invoice: Invoice): TimelineStep {
  const step = { key: 'processing' as const, label: 'Processing' };

  switch (invoice.status) {
    case 'PENDING':
      return { ...step, state: 'pending' };
    case 'PROCESSING':
      return { ...step, state: 'current', detail: invoice.sourceTxHash ?? undefined };
    case 'PAID':
    case 'UNDERPAID':
      return invoice.sourceTxHash
        ? { ...step, state: 'done', detail: invoice.sourceTxHash }
        : {
            ...step,
            state: 'skipped',
            detail: 'Payment was not reported by the checkout app',
          };
    case 'EXPIRED':
    case 'FAILED':
      return { ...step, state: 'skipped' };
  }
}

function settledStep(invoice: Invoice): TimelineStep {
  const step = { key: 'settled' as const, label: 'Paid on Arc' };

  switch (invoice.status) {
    case 'PENDING':
    case 'PROCESSING':
      return { ...step, state: 'pending' };
    case 'PAID':
      return { ...step, state: 'done', detail: invoice.destTxHash ?? undefined };
    case 'UNDERPAID':
      // Still open: the server allows UNDERPAID -> PAID once the balance
      // arrives, so this is a partial payment, not a failure.
      return { ...step, state: 'current', detail: 'Paid short of the invoiced amount' };
    case 'EXPIRED':
      return { ...step, state: 'skipped', detail: 'Invoice expired before payment' };
    case 'FAILED':
      return { ...step, state: 'failed' };
  }
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `cd business && npx vitest run lib/timeline.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add business/lib/timeline.ts business/lib/timeline.test.ts
git commit -m "feat(business): derive an honest invoice status timeline"
```

---

## Task 5: API client, business context, and the invoice polling hook

**Files:**
- Modify: `business/lib/api.ts`
- Create: `business/lib/business-context.tsx`
- Create: `business/lib/use-invoices.ts`

**Interfaces:**
- Consumes: `usePrivy`, `useWallets` from `@privy-io/react-auth`; `Business` and the widened `Invoice` from Task 2
- Produces:
  - `useApi()` gains `getInvoice(id: string): Promise<Invoice>`; `registerBusiness(name?: string)` now resolves to `Business`
  - `BusinessProvider`, `useBusiness(): Business` from `business/lib/business-context.tsx`
  - `useInvoices(): { invoices: Invoice[]; error: string | null; loading: boolean; refresh: () => Promise<void> }` from `business/lib/use-invoices.ts`

- [ ] **Step 1: Add the new calls**

In `business/lib/api.ts`, correct `registerBusiness`'s return type and add two calls before the `return` statement:

```ts
  /** Idempotent; call after login so the server has a Business row. */
  const registerBusiness = useCallback(
    (name?: string) =>
      request<Business>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: wallets[0]?.address, name }),
      }),
    [request, wallets],
  );

  const getInvoice = useCallback(
    (id: string) => request<Invoice>(`/invoices/${id}`),
    [request],
  );
```

And widen the returned object:

```ts
  return { registerBusiness, listInvoices, createInvoice, getInvoice };
```

`GET /auth/me` is deliberately not wired up: the layout already holds the
`Business` returned by `POST /auth/register` and shares it through context,
so a second endpoint returning the same row would be an unused export.

- [ ] **Step 2: Create the business context**

Create `business/lib/business-context.tsx`:

```tsx
'use client';

import { createContext, useContext } from 'react';
import type { Business } from './api';

const BusinessContext = createContext<Business | null>(null);

export const BusinessProvider = BusinessContext.Provider;

/**
 * The dashboard layout registers the business and renders nothing until the
 * row exists, so every page below it can assume a Business is present.
 */
export function useBusiness(): Business {
  const business = useContext(BusinessContext);
  if (!business) {
    throw new Error('useBusiness must be used inside the dashboard layout');
  }
  return business;
}
```

- [ ] **Step 3: Create the polling hook**

Create `business/lib/use-invoices.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApi, type Invoice } from './api';

const POLL_INTERVAL_MS = 10_000;

/**
 * The Arc watcher marks invoices paid out of band, so the list is polled
 * rather than fetched once.
 *
 * This hook deliberately does NOT register the business. Registration
 * upserts Business.walletAddress and must happen exactly once per session
 * in the dashboard layout — running it on a poll could flip the payout
 * address, because useWallets() ordering is not stable between a connected
 * and an embedded wallet.
 */
export function useInvoices() {
  const { listInvoices } = useApi();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setInvoices(await listInvoices());
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, [listInvoices]);

  useEffect(() => {
    // refresh is async, so every setState inside it lands in a microtask
    // after an await, never synchronously in this effect body. That is what
    // the set-state-in-effect rule targets, so this is a false positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { invoices, error, loading, refresh };
}
```

- [ ] **Step 4: Verify types and lint**

Run: `cd business && npx tsc --noEmit && npm run lint`
Expected: no type errors, no lint errors. `dashboard/page.tsx` still compiles — it is rewritten in Task 9.

- [ ] **Step 5: Commit**

```bash
git add business/lib/api.ts business/lib/business-context.tsx business/lib/use-invoices.ts
git commit -m "feat(business): add invoice detail fetch, business context, and polling hook"
```

---

## Task 6: Dashboard shell layout and navigation

**Files:**
- Create: `business/app/(merchant)/dashboard/nav.tsx`
- Create: `business/app/(merchant)/dashboard/layout.tsx`

**Interfaces:**
- Consumes: `useApi`, `Business` from `business/lib/api.ts`; `BusinessProvider` from `business/lib/business-context.tsx`
- Produces: a `/dashboard/*` shell that guarantees an authenticated, registered `Business` to every page beneath it, and `useBusiness()` availability

The registration effect moves here from `dashboard/page.tsx`. That is the point of the task: registration becomes a layout concern that runs once, and pages stop owning it.

- [ ] **Step 1: Write the navigation component**

Create `business/app/(merchant)/dashboard/nav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  { href: '/dashboard/identity', label: 'Identity', soon: true },
  { href: '/dashboard/team', label: 'Team', soon: true },
  { href: '/dashboard/payroll', label: 'Payroll', soon: true },
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
      <span className="flex items-center justify-between rounded-md px-3 py-2 text-muted">
        {item.label}
        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
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
      className={`rounded-md px-3 py-2 ${
        active ? 'bg-stone-100 font-medium text-ink' : 'text-muted hover:text-ink'
      }`}
    >
      {item.label}
    </Link>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {PRIMARY.map((item) => (
        <Row key={item.href} item={item} pathname={pathname} />
      ))}
      <div className="my-3 border-t border-line" />
      {SECONDARY.map((item) => (
        <Row key={item.href} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Write the layout**

Create `business/app/(merchant)/dashboard/layout.tsx`:

```tsx
'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useApi, type Business } from '@/lib/api';
import { BusinessProvider } from '@/lib/business-context';
import { Nav } from './nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  const { registerBusiness } = useApi();

  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  // Registers the connected wallet as the payout address exactly once per
  // session. It must NOT run on a timer: POST /auth/register upserts
  // Business.walletAddress, and useWallets() ordering between a connected
  // and an embedded wallet is not guaranteed stable by Privy, so repeating
  // it could flip where invoices pay out with no merchant action. A
  // deliberate change goes through Settings instead.
  useEffect(() => {
    if (!authenticated || wallets.length === 0 || business) return;
    let cancelled = false;
    void (async () => {
      try {
        const registered = await registerBusiness();
        if (!cancelled) setBusiness(registered);
      } catch (cause) {
        if (!cancelled) setError((cause as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, wallets.length, business, registerBusiness]);

  if (!ready || !authenticated) return null;

  if (error) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

  if (!business) {
    return (
      <main className="flex flex-1 items-center justify-center px-6">
        <p className="text-muted">Loading your account…</p>
      </main>
    );
  }

  return (
    <BusinessProvider value={business}>
      <div className="flex min-h-full flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-card px-4 py-6">
          <span className="px-3 text-base font-semibold tracking-tight">UniPay</span>
          <p className="mt-1 px-3 text-xs text-muted">Business</p>
          <div className="mt-8 flex flex-1 flex-col">
            <Nav />
          </div>
          <div className="border-t border-line pt-4">
            <p className="truncate px-3 font-mono text-[11px] text-muted">
              {business.walletAddress}
            </p>
            <button
              onClick={logout}
              className="mt-2 px-3 text-xs text-muted hover:text-ink"
            >
              Log out
            </button>
          </div>
        </aside>
        <div className="flex-1 overflow-x-auto">{children}</div>
      </div>
    </BusinessProvider>
  );
}
```

- [ ] **Step 3: Verify types and lint**

Run: `cd business && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Visual check**

Run: `cd business && npm run dev`, log in, and open `http://localhost:3000/dashboard`.
Expected: the sidebar renders with Overview active, Identity/Team/Payroll disabled with a "Soon" badge, and the wallet address in mono at the foot. The existing invoice list still renders in the content area — Task 9 replaces it.

- [ ] **Step 5: Commit**

```bash
git add "business/app/(merchant)/dashboard/layout.tsx" "business/app/(merchant)/dashboard/nav.tsx"
git commit -m "feat(business): add dashboard shell layout and sidebar navigation"
```

---

## Task 7: Invoices table page

**Files:**
- Create: `business/app/(merchant)/dashboard/invoices/page.tsx`

**Interfaces:**
- Consumes: `useInvoices` from `business/lib/use-invoices.ts`; `presentStatus` from `business/lib/status.ts`; `formatUsdc`, `formatDateTime` from `business/lib/format.ts`
- Produces: the `/dashboard/invoices` route that Task 6's nav links to and Task 8 links back from

- [ ] **Step 1: Write the page**

Create `business/app/(merchant)/dashboard/invoices/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useInvoices } from '@/lib/use-invoices';
import { presentStatus } from '@/lib/status';
import { formatUsdc, formatDateTime } from '@/lib/format';

export default function InvoicesPage() {
  const { invoices, error, loading } = useInvoices();

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-muted">
            You receive USDC on Arc, whatever the customer pays with.
          </p>
        </div>
        <Link
          href="/dashboard/invoices/new"
          className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover"
        >
          New invoice
        </Link>
      </header>

      {error && <p className="mt-6 text-red-600">{error}</p>}

      <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">Expires</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((invoice) => {
              const status = presentStatus(invoice.status);
              return (
                <tr
                  key={invoice.id}
                  className="h-11 border-b border-line last:border-0 hover:bg-stone-50"
                >
                  <td className="px-4">
                    <Link
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="font-mono font-medium hover:text-accent"
                    >
                      {formatUsdc(BigInt(invoice.payableBase))}
                    </Link>
                  </td>
                  <td className="px-4 text-muted">{invoice.description ?? '—'}</td>
                  <td className="px-4">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-4 whitespace-nowrap text-muted">
                    {formatDateTime(invoice.createdAt)}
                  </td>
                  <td className="px-4 whitespace-nowrap text-muted">
                    {formatDateTime(invoice.expiresAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {invoices.length === 0 && (
          <p className="px-4 py-8 text-center text-muted">
            {loading ? 'Loading invoices…' : 'No invoices yet.'}
          </p>
        )}
      </div>
    </main>
  );
}
```

The amount column shows `payableBase`, not `amountBase` — that is the figure on the payment link and QR code, and the one a merchant reconciles against an incoming transfer.

- [ ] **Step 2: Verify types and lint**

Run: `cd business && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Visual check**

Run: `cd business && npm run dev`, then open `http://localhost:3000/dashboard/invoices`.
Expected: a bordered table on a white card, amounts in mono and vertically aligned across rows, status pills, "Invoices" active in the sidebar.

- [ ] **Step 4: Commit**

```bash
git add "business/app/(merchant)/dashboard/invoices/page.tsx"
git commit -m "feat(business): add the invoices table page"
```

---

## Task 8: Invoice detail page with status timeline

**Files:**
- Create: `business/app/(merchant)/dashboard/invoices/[id]/page.tsx`

**Interfaces:**
- Consumes: `useApi` from `business/lib/api.ts`; `deriveTimeline` from `business/lib/timeline.ts`; `presentStatus`, `isTerminal` from `business/lib/status.ts`; `formatUsdc`, `formatDateTime` from `business/lib/format.ts`; `ARC_EXPLORER_URL` from `business/lib/chains.ts`
- Produces: the `/dashboard/invoices/[id]` route linked from Task 7's table

- [ ] **Step 1: Write the page**

Create `business/app/(merchant)/dashboard/invoices/[id]/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { useApi, type Invoice } from '@/lib/api';
import { deriveTimeline, type TimelineState } from '@/lib/timeline';
import { presentStatus, isTerminal } from '@/lib/status';
import { formatUsdc, formatDateTime } from '@/lib/format';
import { ARC_EXPLORER_URL } from '@/lib/chains';

const MARKER: Record<TimelineState, string> = {
  done: 'bg-emerald-500',
  current: 'bg-blue-500',
  pending: 'bg-stone-300',
  skipped: 'bg-stone-200',
  failed: 'bg-red-500',
};

export default function InvoiceDetailPage(props: PageProps<'/dashboard/invoices/[id]'>) {
  const { id } = use(props.params);
  const { getInvoice } = useApi();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setInvoice(await getInvoice(id));
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [getInvoice, id]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Poll only while the invoice can still change. The Arc watcher flips it
  // to PAID out of band, so a terminal invoice has nothing left to poll for.
  useEffect(() => {
    if (!invoice || isTerminal(invoice.status)) return;
    const timer = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(timer);
  }, [invoice, refresh]);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl px-8 py-10">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (!invoice) {
    return (
      <main className="mx-auto w-full max-w-3xl px-8 py-10">
        <p className="text-muted">Loading invoice…</p>
      </main>
    );
  }

  const status = presentStatus(invoice.status);
  const steps = deriveTimeline(invoice);

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-10">
      <Link href="/dashboard/invoices" className="text-muted hover:text-ink">
        ← Invoices
      </Link>

      <header className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="font-mono text-3xl font-medium tracking-tight">
            {formatUsdc(BigInt(invoice.payableBase))} USDC
          </h1>
          <p className="mt-1 text-muted">{invoice.description ?? 'No description'}</p>
        </div>
        <span className={`rounded-full px-3 py-1 font-medium ${status.className}`}>
          {status.label}
        </span>
      </header>

      <section className="mt-8 rounded-lg border border-line bg-card p-6">
        <h2 className="text-[11px] uppercase tracking-wide text-muted">Progress</h2>
        <ol className="mt-4 space-y-4">
          {steps.map((step) => (
            <li key={step.key} className="flex gap-3">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${MARKER[step.state]}`} />
              <div className="min-w-0">
                <p className={step.state === 'skipped' ? 'text-muted' : 'font-medium'}>
                  {step.label}
                  {step.state === 'skipped' && ' — skipped'}
                </p>
                {step.key === 'created' && step.detail && (
                  <p className="text-muted">{formatDateTime(step.detail)}</p>
                )}
                {step.key !== 'created' && step.detail && (
                  step.detail.startsWith('0x') ? (
                    <a
                      href={`${ARC_EXPLORER_URL}/tx/${step.detail}`}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate font-mono text-[11px] text-accent hover:underline"
                    >
                      {step.detail}
                    </a>
                  ) : (
                    <p className="text-muted">{step.detail}</p>
                  )
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-4 rounded-lg border border-line bg-card p-6">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Requested</dt>
          <dd className="mt-1 font-mono">{formatUsdc(BigInt(invoice.amountBase))} USDC</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Payable</dt>
          <dd className="mt-1 font-mono">{formatUsdc(BigInt(invoice.payableBase))} USDC</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Settlement</dt>
          <dd className="mt-1">Arc · {invoice.asset}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-muted">Expires</dt>
          <dd className="mt-1">{formatDateTime(invoice.expiresAt)}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[11px] uppercase tracking-wide text-muted">Recipient</dt>
          <dd className="mt-1 truncate font-mono text-[11px]">{invoice.recipient}</dd>
        </div>
      </dl>

      <p className="mt-6 text-muted">
        Share this invoice at{' '}
        <Link href={`/i/${invoice.id}`} className="text-accent hover:underline">
          /i/{invoice.id}
        </Link>
        , where the customer gets the payment link and QR code.
      </p>
    </main>
  );
}
```

The "Requested" and "Payable" pair is shown deliberately: the difference between them is the amount nonce, and a merchant who sees `100.00` requested against `100.004417` payable should be able to see why without reading the spec.

- [ ] **Step 2: Verify types and lint**

Run: `cd business && npx tsc --noEmit && npm run lint`
Expected: clean. `PageProps<'/dashboard/invoices/[id]'>` is generated by Next into `next-env.d.ts`; if it is not yet resolvable, run `npm run dev` once to regenerate types, as `app/i/[id]/page.tsx` already relies on the same global.

- [ ] **Step 3: Visual check**

Run: `cd business && npm run dev`, create an invoice, and open it from the table.
Expected: the timeline shows Created done, Processing pending, Paid on Arc pending. After paying it on Arc testnet, Processing reads "Processing — skipped / Payment was not reported by the checkout app" and the Arc transaction hash links to `testnet.arcscan.app`.

- [ ] **Step 4: Commit**

```bash
git add "business/app/(merchant)/dashboard/invoices/[id]/page.tsx"
git commit -m "feat(business): add invoice detail page with status timeline"
```

---

## Task 9: Overview page

**Files:**
- Modify: `business/app/(merchant)/dashboard/page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `useInvoices`, `deriveOverview`, `presentStatus`, `formatUsdc`, `formatDateTime`, `useBusiness`
- Produces: the `/dashboard` index route

The existing file's authentication redirect and registration effect are **deleted**, not moved — Task 6's layout now owns both.

- [ ] **Step 1: Rewrite the page**

Overwrite `business/app/(merchant)/dashboard/page.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useInvoices } from '@/lib/use-invoices';
import { deriveOverview } from '@/lib/overview';
import { presentStatus } from '@/lib/status';
import { formatUsdc, formatDateTime } from '@/lib/format';
import { useBusiness } from '@/lib/business-context';

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-medium">{value}</p>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  );
}

export default function OverviewPage() {
  const business = useBusiness();
  const { invoices, error, loading } = useInvoices();
  const stats = deriveOverview(invoices);
  const recent = invoices.slice(0, 5);

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {business.name ?? 'Overview'}
          </h1>
          <p className="mt-1 text-muted">Settling to USDC on Arc.</p>
        </div>
        <Link
          href="/dashboard/invoices/new"
          className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover"
        >
          New invoice
        </Link>
      </header>

      {error && <p className="mt-6 text-red-600">{error}</p>}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat
          label="Received"
          value={`${formatUsdc(stats.receivedBase)} USDC`}
          sub={`across ${stats.paidCount} paid ${stats.paidCount === 1 ? 'invoice' : 'invoices'}`}
        />
        <Stat label="Awaiting payment" value={`${formatUsdc(stats.awaitingBase)} USDC`} />
        <Stat label="Open invoices" value={String(stats.openCount)} />
      </div>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-medium">Recent activity</h2>
          <Link href="/dashboard/invoices" className="text-muted hover:text-ink">
            All invoices →
          </Link>
        </div>

        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-card">
          {recent.map((invoice) => {
            const status = presentStatus(invoice.status);
            return (
              <li key={invoice.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="font-mono font-medium hover:text-accent"
                  >
                    {formatUsdc(BigInt(invoice.payableBase))} USDC
                  </Link>
                  <p className="truncate text-muted">
                    {invoice.description ?? 'No description'} · {formatDateTime(invoice.createdAt)}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
                  {status.label}
                </span>
              </li>
            );
          })}

          {recent.length === 0 && (
            <li className="px-4 py-8 text-center text-muted">
              {loading ? 'Loading…' : 'No invoices yet. Create one to get paid.'}
            </li>
          )}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify types and lint**

Run: `cd business && npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Visual check**

Run: `cd business && npm run dev`, open `http://localhost:3000/dashboard`.
Expected: three stat cards with mono figures, recent activity beneath, no duplicate registration call in the network tab (exactly one `POST /auth/register` per page load).

- [ ] **Step 4: Commit**

```bash
git add "business/app/(merchant)/dashboard/page.tsx"
git commit -m "feat(business): replace the dashboard index with an overview page"
```

---

## Task 10: Settings page

**Files:**
- Create: `business/app/(merchant)/dashboard/settings/page.tsx`

**Interfaces:**
- Consumes: `useBusiness` from `business/lib/business-context.tsx`; `useApi` from `business/lib/api.ts`; `formatDateTime`; `ARC_EXPLORER_URL` from `business/lib/chains.ts`; `usePrivy` from `@privy-io/react-auth`
- Produces: the `/dashboard/settings` route linked from Task 6's nav

- [ ] **Step 1: Write the page**

Create `business/app/(merchant)/dashboard/settings/page.tsx`:

```tsx
'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useState } from 'react';
import { useApi } from '@/lib/api';
import { useBusiness } from '@/lib/business-context';
import { formatDateTime } from '@/lib/format';
import { ARC_EXPLORER_URL } from '@/lib/chains';

export default function SettingsPage() {
  const business = useBusiness();
  const { wallets } = useWallets();
  const { exportWallet } = usePrivy();
  const { registerBusiness } = useApi();

  const [name, setName] = useState(business.name ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const connected = wallets[0]?.address;
  const payoutMismatch =
    connected && connected.toLowerCase() !== business.walletAddress.toLowerCase();

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await registerBusiness(name.trim() || undefined);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-8 py-10">
      <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

      <section className="mt-8 rounded-lg border border-line bg-card p-6">
        <h2 className="font-medium">Business</h2>
        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted">Display name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="Acme Corp"
              className="rounded-md border border-line px-3 py-2"
            />
            <span className="text-muted">
              Shown to customers on the public payment page.
            </span>
          </label>
          {error && <p className="text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="self-start rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          >
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-lg border border-line bg-card p-6">
        <h2 className="font-medium">Payout wallet</h2>
        <p className="mt-1 text-muted">
          Invoices settle to this address as USDC on Arc. UniPay never holds your funds.
        </p>

        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Address</dt>
            <dd className="mt-1 break-all font-mono text-[11px]">
              <a
                href={`${ARC_EXPLORER_URL}/address/${business.walletAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                {business.walletAddress}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Settlement network</dt>
            {/*
              Read-only. Invoice.destChain is fixed to arc-testnet server-side
              and there is no endpoint to change it, so offering a control
              here would imply a choice the merchant does not have.
            */}
            <dd className="mt-1">Arc testnet · USDC</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-muted">Registered</dt>
            <dd className="mt-1 text-muted">{formatDateTime(business.createdAt)}</dd>
          </div>
        </dl>

        {payoutMismatch && (
          <div className="mt-4 rounded-md bg-amber-50 p-3 ring-1 ring-amber-200">
            <p className="text-amber-800">
              The wallet you are signed in with ({connected}) is not your payout address.
              Saving below will change where future invoices pay out. Existing invoices keep
              the address they were created with.
            </p>
            <button
              onClick={() => void registerBusiness(name.trim() || undefined)}
              className="mt-3 rounded-md border border-amber-300 px-3 py-1.5 font-medium text-amber-900"
            >
              Use this wallet for payouts
            </button>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-line bg-card p-6">
        <h2 className="font-medium">Wallet</h2>
        <p className="mt-1 text-muted">
          Your keys are held by Privy, never by UniPay. Exporting is available for embedded
          wallets only.
        </p>
        <button
          onClick={() => void exportWallet()}
          className="mt-4 rounded-md border border-line px-4 py-2 font-medium hover:bg-stone-50"
        >
          Export wallet
        </button>
      </section>
    </main>
  );
}
```

The payout-mismatch panel is the deliberate counterpart to the layout's once-per-session registration: a payout address change is possible, but only as an explicit act with its consequence stated.

- [ ] **Step 2: Verify types and lint**

Run: `cd business && npx tsc --noEmit && npm run lint`
Expected: clean. If `exportWallet` is not exposed by `usePrivy` in `@privy-io/react-auth@3.40`, drop the Wallet section's button and keep the explanatory copy — do not add a dependency to work around it.

- [ ] **Step 3: Visual check**

Run: `cd business && npm run dev`, open `http://localhost:3000/dashboard/settings`.
Expected: name saves and reappears on the public invoice page as the business name; payout address links to Arcscan.

- [ ] **Step 4: Commit**

```bash
git add "business/app/(merchant)/dashboard/settings/page.tsx"
git commit -m "feat(business): add the settings page"
```

---

## Task 11: Restyle the login and create-invoice pages

**Files:**
- Modify: `business/app/(merchant)/page.tsx`
- Modify: `business/app/(merchant)/dashboard/invoices/new/page.tsx`

**Interfaces:**
- Consumes: the tokens from Task 1
- Produces: nothing new — this closes the visual gap between the shell and the two pre-existing screens

- [ ] **Step 1: Restyle the login page**

In `business/app/(merchant)/page.tsx`, replace the returned markup (leave the `usePrivy` / redirect logic exactly as it is):

```tsx
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold tracking-tight">UniPay for Business</h1>
        <p className="mt-3 text-muted">
          Accept payments from any chain. Receive USDC on Arc.
        </p>
      </div>

      <button
        onClick={login}
        disabled={!ready}
        className="rounded-md bg-accent px-5 py-2.5 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
      >
        {ready ? 'Connect or create a wallet' : 'Loading…'}
      </button>

      <p className="max-w-sm text-center text-muted">
        UniPay is non-custodial. Your wallet and funds stay under your control.
      </p>
    </main>
  );
```

- [ ] **Step 2: Restyle the create-invoice page**

In `business/app/(merchant)/dashboard/invoices/new/page.tsx`, replace the returned markup (leave `handleSubmit` and all validation exactly as it is — `parseUsdcInput` mirrors the server's cent-alignment rule and must not be touched):

```tsx
  return (
    <main className="mx-auto w-full max-w-md px-8 py-10">
      <h1 className="text-xl font-semibold tracking-tight">New invoice</h1>
      <p className="mt-1 text-muted">
        You receive USDC on Arc, whatever the customer pays with.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">Amount (USDC)</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="100.00"
            required
            className="rounded-md border border-line px-3 py-2.5 font-mono text-lg"
          />
          <span className="text-muted">
            Whole cents only. UniPay adds a few sub-cent digits so an incoming
            transfer matches this invoice and no other.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">
            Description (optional)
          </span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={280}
            placeholder="Order #1234"
            className="rounded-md border border-line px-3 py-2.5"
          />
        </label>

        {error && <p className="text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2.5 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {submitting ? 'Creating…' : 'Create invoice'}
        </button>
      </form>
    </main>
  );
```

- [ ] **Step 3: Redirect the created invoice to its detail page**

In the same file, change the post-create navigation so a merchant lands on the merchant-side view rather than the customer-facing one:

```tsx
      const invoice = await createInvoice(amount, description || undefined);
      router.push(`/dashboard/invoices/${invoice.id}`);
```

- [ ] **Step 4: Run the full suite**

Run: `cd business && npm test && npm run build`
Expected: all Vitest tests pass, lint clean, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add "business/app/(merchant)/page.tsx" "business/app/(merchant)/dashboard/invoices/new/page.tsx"
git commit -m "feat(business): restyle login and create-invoice onto the merchant tokens"
```

---

## Definition of done

- A merchant logs in and lands on a sidebar dashboard, not a bare list.
- Overview shows received, awaiting, and open-invoice figures derived from the invoice list, with recent activity beneath.
- `/dashboard/invoices` renders a real table with mono, column-aligned amounts.
- `/dashboard/invoices/[id]` shows a status timeline that reports `PROCESSING` as **skipped with an explanation** when the checkout app never reported the payment, and links the Arc transaction to `testnet.arcscan.app`.
- `/dashboard/settings` shows the payout address, allows a business name, and makes a payout-address change explicit rather than incidental.
- `POST /auth/register` fires exactly once per session, from the layout — never on a poll.
- Identity, Team, and Payroll appear in the navigation as disabled "Soon" rows, ready for Plans 3–5.
- `npm test` and `npm run build` both pass in `business/`.
- No file under `client/` or `server/` was modified.

## Follow-on plans

- **Plan 3 — ENS identity:** ENSv2 Sepolia registration, `unipay.*` records, the business subregistry. Fills the Identity nav row. Gated on the day-0 spike (spec §1.1).
- **Plan 4 — Team:** employee records and subname issuance. Fills the Team nav row.
- **Plan 5 — Payroll:** server-prepared CCTP routes and client-signed batch execution. Fills the Payroll nav row.
