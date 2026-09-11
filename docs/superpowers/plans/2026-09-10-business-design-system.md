# Business Frontend Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-applied styling across `business/`'s twelve routes with one semantic token layer and nine primitives, so the merchant app reads as a single deliberate financial instrument.

**Architecture:** A Tailwind v4 `@theme` token layer named by role (`surface-sunken`, not `stone-100`) lands first, with the four legacy token names kept as aliases so unmigrated screens keep rendering. Nine primitives in `business/components/` then absorb the vocabulary that is currently retyped per screen. Twelve routes migrate in seven waves; a guard test with a shrinking allowlist enforces that a migrated file never hand-rolls a button, card, or empty state again. The legacy aliases are deleted in the final task, when the allowlist is empty.

**Tech Stack:** Next.js 16.3.4 (App Router), React 19.2.8, Tailwind CSS 4.3.3 (`@theme`, no config file), TypeScript 5 strict, vitest 3.2.7, eslint 9 via `eslint-config-next`.

**Spec:** `docs/superpowers/specs/2026-09-10-business-frontend-design-system.md`

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the spec's §1.

1. **Presentation only.** No file in `business/lib/` changes except `status.ts` and `format.ts` (the latter only if a display helper is genuinely missing). Specifically off-limits: `pay.ts`, `payroll.ts`, `wallet-batch.ts`, `overview.ts`, `activity.ts`, `timeline.ts`, `payout-chains.ts`, `api.ts`, `employees.ts`, `ens.ts`, `arc.ts`, `chains.ts`, `sepolia.ts`, `use-invoices.ts`, `business-context.tsx`.
2. **All eight vitest suites stay green and stay unedited:** `activity`, `format`, `overview`, `pay`, `payout-chains`, `status`, `timeline`, `wallet-batch`. **If a suite needs editing to pass, that is the signal that this work has strayed out of presentation — stop and reassess rather than adjusting the test.**
3. **No new runtime dependencies.** No component library, no CSS-in-JS, no icon package. **Also no new devDependencies** — `jsdom` and `@testing-library/react` are NOT installed, so no test may render a React component. Tests are pure TypeScript only.
4. **No information-architecture changes.** Routes, navigation order, and shell structure are settled. This changes how screens look, not what they contain or where they live.
5. **`client/` remains off-limits.**
6. **One chromatic filled element per viewport.** Status badges are washes with a ring, never fills.
7. **Weight caps at 600 and is rationed.** Hierarchy comes from size, position, and colour.
8. **Radii: exactly three** — `radius-control` 6px, `radius-card` 10px, `radius-pill` 9999px.
9. **Elevation: no shadow by default** (borders do the work), `shadow-raised` for cards that must lift, `shadow-float` **at most once per view**.
10. **Motion:** colour and opacity only, 150ms. One orchestrated entrance per page maximum, always inside `@media (prefers-reduced-motion: no-preference)`.
11. **Never invert canvas and surface.** `#FAFAF9` is the page; `#FFFFFF` is only ever a surface on top of it.
12. **Every string a merchant reads is production copy.** Sentence case, no jargon, no developer shorthand, no raw exception text as the primary message. Consistent terms: *invoice*, *payout*, *wallet*, *USDC*, *Arc*, *payroll run*, *team member* — never "base units", "tx", "batch item", "biz", or an enum name. Error copy says what happened, whether money moved, and what to do next; it never implies data or funds were lost when they were not. Amounts always go through `formatUsdc`, dates through `formatDateTime`. **A raw error string is never the only thing on screen** — see `Alert` and `humanizeError` in Task 7.

### Verification command (run from `business/`)

```bash
npm test          # vitest run && eslint
npx tsc --noEmit  # types only, faster than a full build during iteration
npm run build     # before finishing a wave
```

---

## File Structure

**Create — pure logic (tested):**

| File | Responsibility |
|---|---|
| `business/components/cx.ts` | Conditional class joiner. No dependency on Tailwind. |
| `business/components/cx.test.ts` | Tests for the above. |
| `business/components/list-state.ts` | `resolveListState` — the loading/error/empty precedence currently duplicated across 7 screens. |
| `business/components/list-state.test.ts` | Tests for the above. |
| `business/components/tokens.test.ts` | Parses `app/globals.css`; asserts every token the spec requires exists. |
| `business/components/design-system.guard.test.ts` | Greps `app/`; fails if a migrated file hand-rolls a primitive. Allowlist shrinks per wave. |
| `business/components/humanize-error.ts` | `humanizeError` — turns a technical failure into a sentence a merchant can act on. |
| `business/components/humanize-error.test.ts` | Tests for the above. |
| `business/components/copy.guard.test.ts` | Greps `app/`; fails on developer shorthand or banned terms in user-facing strings. |

**Create — primitives (verified by build, lint, and eye). Ten, not nine: `Alert` was added once the raw-error survey showed sixteen screens printing exception text at merchants.**

| File | Exports |
|---|---|
| `business/components/button.tsx` | `Button`, `ButtonLink`, `buttonClass` |
| `business/components/card.tsx` | `Card` |
| `business/components/badge.tsx` | `Badge`, `TONE` |
| `business/components/field.tsx` | `Field`, `inputClass` |
| `business/components/page-header.tsx` | `PageHeader` |
| `business/components/table.tsx` | `Table`, `Th`, `Td`, `Tr` |
| `business/components/empty-state.tsx` | `EmptyState` |
| `business/components/figure.tsx` | `Figure` |
| `business/components/copy-row.tsx` | `CopyRow` |
| `business/components/alert.tsx` | `Alert` |

Files are kebab-case with PascalCase exports, matching the existing convention (`employee-form.tsx`, `wallet-card.tsx`). **No barrel `index.ts`** — explicit import paths keep the guard test unambiguous.

**Modify:** `business/app/globals.css`, `business/lib/status.ts`, and the twelve route files plus nine sub-components, in waves.

### Two deliberate deviations from the spec's API sketch

Both are YAGNI calls; note them when reporting, and do not silently reintroduce.

- **`Button` has no `busy` prop.** The spec sketched one, but every form already switches its own label (`{submitting ? 'Sending…' : 'Send'}`) and passes `disabled`. A `busy` prop would only re-express `disabled`.
- **`Card` renders a `div` only, with no polymorphic `as`.** Callers needing `<ul>`/`<table>` inside use `padded={false}` and nest. Generic `as` typing in TS strict costs more than it returns here.

---

## Task 1: The token layer

**Files:**
- Modify: `business/app/globals.css` (entire file, currently 31 lines)
- Test: `business/components/tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind utility classes used by every later task — `bg-canvas`, `bg-surface`, `bg-surface-sunken`, `bg-surface-inverse`, `border-line`, `border-line-strong`, `text-ink`, `text-ink-soft`, `text-muted`, `text-faint`, `bg-accent`, `bg-accent-hover`, `bg-accent-wash`, `bg-{tone}-wash`, `text-{tone}-ink`, `ring-{tone}-line` for the six tones, `text-caption|label|body|lead|subhead|section|title|display`, `rounded-control|card|pill`, `shadow-raised|float`. The legacy `bg-ground`, `bg-card`, `text-ink`, `text-muted`, `bg-accent` keep working.

- [ ] **Step 1: Write the failing test**

Create `business/components/tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

/** The @theme block is the only place tokens may be declared. */
const theme = css.slice(css.indexOf('@theme'), css.indexOf('}', css.indexOf('@theme')));

const TONES = ['positive', 'pending', 'progress', 'caution', 'negative', 'neutral'];

describe('design tokens', () => {
  it('declares every surface, line and text role', () => {
    for (const name of [
      'canvas',
      'surface',
      'surface-sunken',
      'surface-inverse',
      'line',
      'line-strong',
      'ink',
      'ink-soft',
      'muted',
      'faint',
      'accent',
      'accent-hover',
      'accent-wash',
    ]) {
      expect(theme, `--color-${name}`).toContain(`--color-${name}:`);
    }
  });

  it('declares a wash, ink and line for all six status tones', () => {
    for (const tone of TONES) {
      expect(theme, tone).toContain(`--color-${tone}-wash:`);
      expect(theme, tone).toContain(`--color-${tone}-ink:`);
      expect(theme, tone).toContain(`--color-${tone}-line:`);
    }
  });

  it('declares the full type scale', () => {
    for (const step of [
      'caption',
      'label',
      'body',
      'lead',
      'subhead',
      'section',
      'title',
      'display',
    ]) {
      expect(theme, step).toContain(`--text-${step}:`);
    }
  });

  it('declares exactly three radii and two elevations', () => {
    for (const name of ['control', 'card', 'pill']) {
      expect(theme).toContain(`--radius-${name}:`);
    }
    expect(theme).toContain('--shadow-raised:');
    expect(theme).toContain('--shadow-float:');
    // Three radii, not seven. Guards against a fourth creeping in.
    expect(theme.match(/--radius-[a-z-]+:/g)).toHaveLength(3);
  });

  it('keeps the legacy aliases so unmigrated screens still render', () => {
    // Deleted in the final task, when no screen references them.
    for (const legacy of ['ground', 'card']) {
      expect(theme, legacy).toContain(`--color-${legacy}:`);
    }
  });

  it('never inverts canvas and surface', () => {
    expect(theme).toContain('--color-canvas: #FAFAF9');
    expect(theme).toContain('--color-surface: #FFFFFF');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd business && npx vitest run components/tokens.test.ts`
Expected: FAIL — the first assertion reports `--color-canvas` missing (the current `@theme` declares `ground`, `card`, `line`, `ink`, `muted`, `accent`, `accent-hover` only).

- [ ] **Step 3: Write the token layer**

Replace the whole of `business/app/globals.css` with:

```css
@import "tailwindcss";

@theme {
  /*
   * Named by ROLE, never by value. That is what makes a dark theme a
   * change to this block rather than a rewrite of twelve routes.
   */

  /* Surfaces. #FAFAF9 is the page; #FFFFFF is only ever a surface on
     top of it. Never invert these two. */
  --color-canvas: #FAFAF9;
  --color-surface: #FFFFFF;
  /* Inputs at rest, <code>, table heads, inset wells. Inset elements
     used to borrow the canvas colour, which made them invisible on a
     card. */
  --color-surface-sunken: #F5F5F4;
  --color-surface-inverse: #1C1917;

  /* Lines carry the structure here. Elevation is the exception, not the
     rule — see --shadow-float. */
  --color-line: #E7E5E4;
  --color-line-strong: #D6D3D1;

  /* Four text levels. ink-soft is the one that was missing: `muted` was
     doing secondary copy, table cells AND micro-labels at once, which
     is why the dashboard read flat. */
  --color-ink: #1C1917;
  --color-ink-soft: #57534E;
  --color-muted: #78716C;
  --color-faint: #A8A29E;

  /* The one chromatic fill. Primary action only. */
  --color-accent: #0D9488;
  --color-accent-hover: #0F766E;
  --color-accent-wash: #F0FDFA;

  /*
   * Status tones. Hue assignments carry over from the shell spec, at
   * Tailwind's 50/700/200 steps, so the six invoice states look
   * unchanged — but they are now nameable from outside lib/status.ts,
   * which is why the activity list and payroll views no longer each
   * re-guess "paid green".
   */
  --color-positive-wash: #ECFDF5;
  --color-positive-ink: #047857;
  --color-positive-line: #A7F3D0;

  --color-pending-wash: #FFFBEB;
  --color-pending-ink: #B45309;
  --color-pending-line: #FDE68A;

  --color-progress-wash: #EFF6FF;
  --color-progress-ink: #1D4ED8;
  --color-progress-line: #BFDBFE;

  --color-caution-wash: #FFF7ED;
  --color-caution-ink: #C2410C;
  --color-caution-line: #FED7AA;

  --color-negative-wash: #FEF2F2;
  --color-negative-ink: #B91C1C;
  --color-negative-line: #FECACA;

  --color-neutral-wash: #F5F5F4;
  --color-neutral-ink: #57534E;
  --color-neutral-line: #E7E5E4;

  /*
   * Legacy aliases. Screens migrate in waves, and an unmigrated screen
   * still says bg-ground / bg-card. Deleted in the final task.
   */
  --color-ground: #FAFAF9;
  --color-card: #FFFFFF;

  /*
   * The type scale. The app used to jump 11px -> 13px -> text-xl with
   * nothing between, so every intermediate size was improvised.
   * Negative tracking at size is the cheapest thing that makes type
   * look designed rather than defaulted.
   */
  --text-caption: 0.625rem;
  --text-caption--line-height: 1.4;
  --text-caption--letter-spacing: 0.02em;

  --text-label: 0.6875rem;
  --text-label--line-height: 1.4;
  --text-label--letter-spacing: 0.04em;
  --text-label--font-weight: 500;

  --text-body: 0.8125rem;
  --text-body--line-height: 1.5;

  --text-lead: 0.9375rem;
  --text-lead--line-height: 1.6;

  --text-subhead: 1.0625rem;
  --text-subhead--line-height: 1.4;
  --text-subhead--letter-spacing: -0.01em;
  --text-subhead--font-weight: 500;

  --text-section: 1.25rem;
  --text-section--line-height: 1.3;
  --text-section--letter-spacing: -0.015em;
  --text-section--font-weight: 600;

  --text-title: 1.625rem;
  --text-title--line-height: 1.2;
  --text-title--letter-spacing: -0.02em;
  --text-title--font-weight: 600;

  --text-display: clamp(1.9rem, 4.4vw, 2.6rem);
  --text-display--line-height: 1.05;
  --text-display--letter-spacing: -0.025em;
  --text-display--font-weight: 500;

  /* Exactly three. */
  --radius-control: 6px;
  --radius-card: 10px;
  --radius-pill: 9999px;

  /* Borders do the work by default. shadow-float is the landing page's
     figure shadow, promoted — at most one element per view, which is
     what keeps it meaningful. */
  --shadow-raised: 0 4px 16px rgba(0, 0, 0, 0.05);
  --shadow-float: 0 1px 2px rgba(28, 25, 23, 0.04), 0 12px 32px -16px rgba(28, 25, 23, 0.18);

  --font-sans: var(--font-plex-sans), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, SFMono-Regular, monospace;
}

/*
 * Literal values, not var(--text-body) / var(--color-canvas).
 * Tailwind v4 prunes theme variables that no utility references (the
 * reason @theme static exists), so a var() here can silently resolve to
 * nothing and drop the body back to the browser's 16px. app/layout.tsx
 * carries bg-canvas / text-ink / font-sans as utilities; these two
 * declarations are the base that cannot be expressed that way.
 */
body {
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd business && npx vitest run components/tokens.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Verify nothing regressed and the app still renders**

Run: `cd business && npm test && npm run build`
Expected: all suites pass (the eight existing plus `tokens`), lint clean, build succeeds. The app should look **identical** at this point — only aliases were added.

- [ ] **Step 6: Commit**

```bash
git add business/app/globals.css business/components/tokens.test.ts
git commit -m "feat(business): declare the design system as role-named tokens

Named by role rather than value, so a dark theme later is a change to
this block rather than a rewrite of twelve routes. ink-soft is the
addition that matters: muted was carrying secondary copy, table cells
and micro-labels at once, which is why the dashboard read flat.

The four legacy names stay as aliases until the last screen migrates.
Nothing looks different yet.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: `cx` — the class joiner

**Files:**
- Create: `business/components/cx.ts`
- Test: `business/components/cx.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `cx(...parts: Array<string | false | null | undefined>): string` — used by every primitive.

- [ ] **Step 1: Write the failing test**

Create `business/components/cx.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins the parts it is given', () => {
    expect(cx('a', 'b')).toBe('a b');
  });

  it('drops the falsy parts a conditional class produces', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('collapses whitespace so a multi-line base string stays one class list', () => {
    expect(cx('a\n  b', 'c')).toBe('a b c');
  });

  it('returns an empty string when everything is falsy', () => {
    expect(cx(false, undefined)).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd business && npx vitest run components/cx.test.ts`
Expected: FAIL — `Failed to resolve import "./cx"`.

- [ ] **Step 3: Write the implementation**

Create `business/components/cx.ts`:

```ts
/**
 * Joins class names, dropping the falsy ones a conditional produces.
 *
 * Deliberately not tailwind-merge: no new dependencies, and none of the
 * primitives here need last-wins conflict resolution. A caller's
 * className is appended after the base, which is enough for Tailwind's
 * later-wins cascade in practice.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd business && npx vitest run components/cx.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add business/components/cx.ts business/components/cx.test.ts
git commit -m "feat(business): add cx, the class joiner the primitives share

Not tailwind-merge: no new dependencies, and no primitive here needs
last-wins conflict resolution.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: `resolveListState` — the loading/error/empty precedence

This is the one piece of genuine logic in the whole plan. Seven screens branch on `loading` / `loaded` inline today, and they do not agree on precedence. Getting it wrong shows a merchant "no invoices yet" when the API is merely unreachable — the worst possible lie for a payments product.

**Files:**
- Create: `business/components/list-state.ts`
- Test: `business/components/list-state.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type ListState = 'loading' | 'error' | 'empty'` and `resolveListState(input: { loading: boolean; loaded: boolean; error?: string | null }): ListState`.

- [ ] **Step 1: Write the failing test**

Create `business/components/list-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveListState } from './list-state';

describe('resolveListState', () => {
  it('reports loading while a request is in flight', () => {
    expect(resolveListState({ loading: true, loaded: false })).toBe('loading');
  });

  it('prefers loading over a stale error, so a retry does not look broken', () => {
    // The retry is already in flight; showing the previous failure here
    // would tell the merchant nothing is happening when something is.
    expect(resolveListState({ loading: true, loaded: false, error: 'boom' })).toBe('loading');
  });

  it('reports an error when one was reported and nothing is in flight', () => {
    expect(resolveListState({ loading: false, loaded: false, error: 'boom' })).toBe('error');
  });

  it('reports an error when the fetch never completed, even with no message', () => {
    // This is the case the old inline ternaries got right and it must be
    // preserved: !loading && !loaded means the API is unreachable, NOT
    // that the merchant has no invoices.
    expect(resolveListState({ loading: false, loaded: false })).toBe('error');
  });

  it('reports empty only once a load has actually succeeded', () => {
    expect(resolveListState({ loading: false, loaded: true })).toBe('empty');
  });

  it('treats a successful reload as empty even if an earlier attempt failed', () => {
    expect(resolveListState({ loading: false, loaded: true, error: null })).toBe('empty');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd business && npx vitest run components/list-state.test.ts`
Expected: FAIL — `Failed to resolve import "./list-state"`.

- [ ] **Step 3: Write the implementation**

Create `business/components/list-state.ts`:

```ts
export type ListState = 'loading' | 'error' | 'empty';

export interface ListStateInput {
  /** A request is in flight right now. */
  loading: boolean;
  /** A request has completed successfully at least once. */
  loaded: boolean;
  /** The last reported failure, if any. */
  error?: string | null;
}

/**
 * Decides what an empty list should say.
 *
 * Precedence is loading > error > empty, and `empty` requires `loaded`.
 * That last clause is the important one: `!loading && !loaded` means the
 * API is unreachable, so the list is unknown rather than empty. Telling
 * a merchant "no invoices yet" when we simply could not ask is the
 * worst failure mode this component has.
 */
export function resolveListState({ loading, loaded, error }: ListStateInput): ListState {
  if (loading) return 'loading';
  if (error) return 'error';
  return loaded ? 'empty' : 'error';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd business && npx vitest run components/list-state.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add business/components/list-state.ts business/components/list-state.test.ts
git commit -m "feat(business): settle the loading, error and empty precedence

Seven screens branch on loading and loaded inline today and do not
agree on the order. The clause worth keeping is that empty requires
loaded: not loading and not loaded means the API is unreachable, so the
list is unknown rather than empty. Telling a merchant they have no
invoices when we could not ask is the worst thing this can say.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: `Button` and `Card`

Six of the seventeen accent buttons are `<Link>`s, not `<button>`s, so this task ships both element flavours over one shared class function.

**Files:**
- Create: `business/components/button.tsx`, `business/components/card.tsx`

**Interfaces:**
- Consumes: `cx` from Task 2.
- Produces:
  - `buttonClass(options?: { variant?: 'primary' | 'secondary' | 'quiet'; size?: 'sm' | 'md'; className?: string }): string`
  - `Button(props: React.ComponentProps<'button'> & { variant?; size? })` — defaults `type="button"`
  - `ButtonLink(props: React.ComponentProps<typeof Link> & { variant?; size? })`
  - `Card(props: { padded?: boolean; className?: string; children: React.ReactNode })`

- [ ] **Step 1: Write `button.tsx`**

Create `business/components/button.tsx`:

```tsx
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'quiet';
type Size = 'sm' | 'md';

/**
 * The focus ring lives here on purpose. Before this component, one of
 * seventeen hand-typed accent buttons had focus-visible styles; putting
 * it in the base fixes the other sixteen at once.
 */
const BASE = `
  inline-flex shrink-0 items-center justify-center gap-2
  rounded-control font-medium whitespace-nowrap
  transition-colors duration-150
  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
  focus-visible:outline-accent
  disabled:cursor-not-allowed disabled:opacity-40
  aria-disabled:cursor-not-allowed aria-disabled:opacity-40
`;

/** primary is the only chromatic fill, and there is one per viewport. */
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  secondary: 'border border-line bg-surface text-ink hover:bg-surface-sunken',
  quiet: 'text-muted hover:text-ink',
};

const SIZE: Record<Size, string> = {
  sm: 'px-3 py-1.5',
  md: 'px-4 py-2',
};

export function buttonClass({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cx(BASE, VARIANT[variant], SIZE[size], className);
}

export function Button({
  variant,
  size,
  className,
  type = 'button',
  ...rest
}: ComponentProps<'button'> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...rest} />;
}

export function ButtonLink({
  variant,
  size,
  className,
  ...rest
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass({ variant, size, className })} {...rest} />;
}
```

- [ ] **Step 2: Write `card.tsx`**

Create `business/components/card.tsx`:

```tsx
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
  className,
  children,
}: {
  padded?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx('rounded-card border border-line bg-surface', padded && 'p-5', className)}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Verify both compile and lint**

Run: `cd business && npx tsc --noEmit && npx eslint components`
Expected: no errors. (No unit test here: rendering a component requires jsdom, which Global Constraint 3 forbids. `buttonClass` is exercised through the guard test and the waves.)

- [ ] **Step 4: Commit**

```bash
git add business/components/button.tsx business/components/card.tsx
git commit -m "feat(business): add the Button and Card primitives

Seventeen hand-typed accent buttons across three padding pairs, with one
focus ring between them. The ring lives in the base class now, so the
other sixteen are fixed by adoption. ButtonLink exists because six of
the seventeen are links rather than buttons.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: `Badge` and the status token migration

`lib/status.test.ts` asserts `presentation.className` contains `'bg-'`. Token classes such as `bg-pending-wash` still satisfy that, so **`StatusPresentation` keeps its `className` field and the suite stays unedited.** `Badge` therefore supplies only the *shape*; the tone arrives as a class string. That split is what keeps the test green, and it means `TONE` is exported for the callers (payroll) that have no `InvoiceStatus` to hand.

**Files:**
- Create: `business/components/badge.tsx`
- Modify: `business/lib/status.ts:16-47` (the `PRESENTATION` map's `className` values only)

**Interfaces:**
- Consumes: `cx` from Task 2.
- Produces:
  - `type Tone = 'positive' | 'pending' | 'progress' | 'caution' | 'negative' | 'neutral'`
  - `TONE: Record<Tone, string>` — the wash/ink/ring class triple per tone
  - `Badge(props: { className?: string; children: ReactNode })`
  - `presentStatus(status).className` now returns token classes, same shape as before.

- [ ] **Step 1: Write `badge.tsx`**

Create `business/components/badge.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from './cx';

export type Tone = 'positive' | 'pending' | 'progress' | 'caution' | 'negative' | 'neutral';

/**
 * A wash, an ink and a ring per tone — never a fill. Filled badges would
 * compete with the primary action, and there is one chromatic fill per
 * viewport.
 *
 * Exported for callers that have no InvoiceStatus to hand (payroll), so
 * they stop re-guessing "paid green" from raw Tailwind palettes.
 */
export const TONE: Record<Tone, string> = {
  positive: 'bg-positive-wash text-positive-ink ring-positive-line',
  pending: 'bg-pending-wash text-pending-ink ring-pending-line',
  progress: 'bg-progress-wash text-progress-ink ring-progress-line',
  caution: 'bg-caution-wash text-caution-ink ring-caution-line',
  negative: 'bg-negative-wash text-negative-ink ring-negative-line',
  neutral: 'bg-neutral-wash text-neutral-ink ring-neutral-line',
};

/**
 * Badge owns the shape; the tone arrives as a class string. That split
 * keeps lib/status.ts as the single authority on what each invoice state
 * looks like, and keeps its suite passing unchanged.
 */
export function Badge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-pill px-2 py-0.5 text-label ring-1',
        className,
      )}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Run the existing status suite to confirm the baseline**

Run: `cd business && npx vitest run lib/status.test.ts`
Expected: PASS. Note the count; it must not change in Step 4.

- [ ] **Step 3: Retone `lib/status.ts`**

In `business/lib/status.ts`, change **only** the six `className` values. Leave `label`, `terminal`, the interface, the doc comments, and both exported functions exactly as they are.

```ts
const PRESENTATION: Record<InvoiceStatus, StatusPresentation> = {
  PENDING: {
    label: 'Pending',
    className: 'bg-pending-wash text-pending-ink ring-pending-line',
    terminal: false,
  },
  PROCESSING: {
    label: 'Processing',
    className: 'bg-progress-wash text-progress-ink ring-progress-line',
    terminal: false,
  },
  PAID: {
    label: 'Paid',
    className: 'bg-positive-wash text-positive-ink ring-positive-line',
    terminal: true,
  },
  EXPIRED: {
    label: 'Expired',
    className: 'bg-neutral-wash text-neutral-ink ring-neutral-line',
    terminal: true,
  },
  UNDERPAID: {
    label: 'Underpaid',
    className: 'bg-caution-wash text-caution-ink ring-caution-line',
    terminal: false,
  },
  FAILED: {
    label: 'Failed',
    className: 'bg-negative-wash text-negative-ink ring-negative-line',
    terminal: true,
  },
};
```

Note the `ring-1` moved out of these strings and into `Badge`'s base class — the shape belongs to the primitive.

- [ ] **Step 4: Run the status suite unedited to verify it still passes**

Run: `cd business && npx vitest run lib/status.test.ts && git diff --stat business/lib/status.test.ts`
Expected: PASS with the same test count as Step 2, and **`git diff` on the test file must be empty**. If the suite fails, Global Constraint 2 applies: stop, do not edit the test.

- [ ] **Step 5: Commit**

```bash
git add business/components/badge.tsx business/lib/status.ts
git commit -m "feat(business): give the six invoice states nameable tones

status.ts stays the single authority on what each state looks like, and
its suite passes untouched. Badge owns only the shape, so the ring moved
out of the class strings and into the primitive. TONE is exported for
payroll, which had no InvoiceStatus to hand and was re-guessing paid
green from raw Tailwind palettes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: `EmptyState`, `PageHeader`, `Figure`

**Files:**
- Create: `business/components/empty-state.tsx`, `business/components/page-header.tsx`, `business/components/figure.tsx`

**Interfaces:**
- Consumes: `cx` (Task 2), `resolveListState` (Task 3).
- Produces:
  - `EmptyState(props: { loading: boolean; loaded: boolean; error?: string | null; subject: string; empty: string; action?: ReactNode; className?: string })`
  - `PageHeader(props: { title: string; subtitle?: string; action?: ReactNode })`
  - `Figure(props: { amount: string; unit?: string; size?: 'md' | 'lg'; tone?: 'ink' | 'muted'; className?: string })`

- [ ] **Step 1: Write `empty-state.tsx`**

Create `business/components/empty-state.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from './cx';
import { resolveListState } from './list-state';

/**
 * The one place a list says nothing-to-show.
 *
 * `subject` keeps the error specific ("your invoices") while the sentence
 * stays consistent across screens — the failure states were the app's
 * least consistent surface, which is exactly the wrong place to improvise,
 * because a merchant reads them when they are anxious about their money.
 *
 * The error copy never implies data loss: an unreachable API has not lost
 * anything.
 */
export function EmptyState({
  loading,
  loaded,
  error,
  subject,
  empty,
  action,
  className,
}: {
  loading: boolean;
  loaded: boolean;
  error?: string | null;
  /** Plural noun for the error sentence, e.g. "your invoices". */
  subject: string;
  /** What to say when the load succeeded and there is genuinely nothing. */
  empty: string;
  action?: ReactNode;
  className?: string;
}) {
  const state = resolveListState({ loading, loaded, error });

  const message =
    state === 'loading'
      ? 'Loading…'
      : state === 'error'
        ? `We couldn't load ${subject}. Nothing has been lost — try again in a moment.`
        : empty;

  return (
    <div className={cx('px-5 py-10 text-center text-muted', className)} aria-live="polite">
      <p className="mx-auto max-w-[46ch]">{message}</p>
      {state === 'empty' && action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Write `page-header.tsx`**

Create `business/components/page-header.tsx`:

```tsx
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
```

- [ ] **Step 3: Write `figure.tsx`**

Create `business/components/figure.tsx`:

```tsx
import { cx } from './cx';

/**
 * A monetary amount at display size. Mono with tabular figures, because
 * these line up column-wise elsewhere in the app and a merchant should
 * read the same glyphs in both places. The unit rides at 0.42em so the
 * number stays the thing you see.
 */
export function Figure({
  amount,
  unit = 'USDC',
  size = 'md',
  tone = 'ink',
  className,
}: {
  amount: string;
  unit?: string;
  size?: 'md' | 'lg';
  tone?: 'ink' | 'muted';
  className?: string;
}) {
  return (
    <p
      className={cx(
        'font-mono',
        size === 'lg' ? 'text-display' : 'text-title',
        tone === 'muted' ? 'text-muted' : 'text-ink',
        className,
      )}
    >
      {amount}
      {unit && (
        <span className="ml-2 align-baseline text-[0.42em] font-normal tracking-normal text-muted">
          {unit}
        </span>
      )}
    </p>
  );
}
```

- [ ] **Step 4: Verify they compile and lint**

Run: `cd business && npx tsc --noEmit && npx eslint components && npm test`
Expected: no type errors, no lint errors, all suites green.

- [ ] **Step 5: Commit**

```bash
git add business/components/empty-state.tsx business/components/page-header.tsx business/components/figure.tsx
git commit -m "feat(business): add EmptyState, PageHeader and Figure

EmptyState is the one that matters: ten centered blocks across six files,
seven screens each wording loading and error their own way. It takes the
subject so the sentence stays consistent while staying specific, and its
error copy never implies data loss, because an unreachable API has not
lost anything.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: `Table`, `Field`, `CopyRow`, `Alert` + `humanizeError`

Sixteen places currently render a raw error string straight to the merchant in bare `text-red-600` — `Failed to fetch`, viem revert dumps, `HTTP 500`. `humanizeError` is the fix, and it is the last piece of real logic in the plan.

**Files:**
- Create: `business/components/table.tsx`, `business/components/field.tsx`, `business/components/copy-row.tsx`, `business/components/alert.tsx`, `business/components/humanize-error.ts`
- Test: `business/components/humanize-error.test.ts`

**Interfaces:**
- Consumes: `cx` (Task 2), `Card` (Task 4), `Button` (Task 4).
- Produces:
  - `Table(props: { head: ReactNode; children: ReactNode; className?: string })`, `Th`, `Td`, `Tr`
  - `Field(props: { label: string; htmlFor?: string; hint?: string; error?: string | null; children: ReactNode })`, `inputClass(className?: string): string`
  - `CopyRow(props: { label: string; value: string })`
  - `humanizeError(raw: unknown): { message: string; detail?: string }`
  - `Alert(props: { error: unknown; className?: string })`

- [ ] **Step 1: Write `table.tsx`**

Create `business/components/table.tsx`:

```tsx
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
  return <th className={cx('px-4 py-2.5 text-label uppercase text-faint', className)} {...rest} />;
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
```

- [ ] **Step 2: Write `field.tsx`**

Create `business/components/field.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cx } from './cx';

/**
 * Inputs sit on the sunken surface so they read as recessed on a white
 * card — they used to borrow the canvas colour, which made them
 * invisible there.
 */
export function inputClass(className?: string): string {
  return cx(
    `w-full rounded-control border border-line-strong bg-surface-sunken px-3 py-2
     text-ink placeholder:text-faint
     transition-colors duration-150
     focus:border-accent focus:bg-surface focus:outline-none
     focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
     focus-visible:outline-accent
     disabled:cursor-not-allowed disabled:opacity-40`,
    className,
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-label uppercase text-faint">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1.5 text-negative-ink">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-muted">{hint}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `copy-row.tsx`**

Create `business/components/copy-row.tsx`. This is promoted verbatim in behaviour from `app/i/[id]/invoice-view.tsx:41-70` — **keep the silent clipboard failure**, including its comment.

```tsx
'use client';

import { useState } from 'react';
import { Button } from './button';

/**
 * A labelled value with a copy button. Addresses and payment links are
 * the two things in this app a merchant needs out of the browser and
 * into something else.
 */
export function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p className="text-label uppercase text-faint">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-control border border-line bg-surface-sunken px-2 py-1.5 font-mono text-caption">
          {value}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              if (!navigator.clipboard?.writeText) throw new Error('unavailable');
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              // Clipboard access is missing (insecure context, some webviews).
              // The value is selectable on screen, so this needs no error state.
            }
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the failing test for `humanizeError`**

Create `business/components/humanize-error.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { humanizeError } from './humanize-error';

describe('humanizeError', () => {
  it('explains an unreachable API without blaming the merchant', () => {
    const { message } = humanizeError(new TypeError('Failed to fetch'));
    expect(message).toContain("couldn't reach");
    expect(message).not.toContain('fetch');
  });

  it('treats a cancelled wallet prompt as a choice, not a failure', () => {
    const { message } = humanizeError(new Error('User rejected the request'));
    expect(message).toContain('cancelled');
  });

  it('says what a timeout means for money that may already be moving', () => {
    // The critical case: a merchant must not retry a transfer that is
    // already on its way.
    const { message } = humanizeError(new Error('Timed out waiting for receipt'));
    expect(message).toContain('may already');
  });

  it('names the wrong-network case with the action that fixes it', () => {
    const { message } = humanizeError(new Error('Chain mismatch: expected Arc'));
    expect(message).toContain('Arc');
  });

  it('explains insufficient funds as covering the transfer and its gas', () => {
    const { message } = humanizeError(new Error('insufficient funds for gas'));
    expect(message).toContain('gas');
  });

  it('passes a server sentence through, because it was written for a human', () => {
    const raw = 'That amount is above the invoice limit.';
    expect(humanizeError(new Error(raw)).message).toBe(raw);
  });

  it('hides a hex dump behind a generic sentence but keeps it as detail', () => {
    const raw = 'execution reverted 0x08c379a0000000000000000000000000';
    const { message, detail } = humanizeError(new Error(raw));
    expect(message).not.toContain('0x08c379a0');
    expect(detail).toBe(raw);
  });

  it('survives being handed something that is not an Error', () => {
    expect(humanizeError(undefined).message.length).toBeGreaterThan(0);
    expect(humanizeError({ nope: true }).message.length).toBeGreaterThan(0);
  });

  it('never returns an empty message', () => {
    for (const input of ['', '   ', null, 0, new Error('')]) {
      expect(humanizeError(input).message.trim().length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `cd business && npx vitest run components/humanize-error.test.ts`
Expected: FAIL — `Failed to resolve import "./humanize-error"`.

- [ ] **Step 6: Write `humanize-error.ts`**

Create `business/components/humanize-error.ts`:

```ts
export interface HumanError {
  /** What the merchant reads. Always present, always a full sentence. */
  message: string;
  /** The original text, kept so support can be given something exact. */
  detail?: string;
}

const GENERIC = 'Something went wrong on our side. Nothing was lost — try again in a moment.';

/**
 * Known technical failures, in the words a merchant would use.
 *
 * The timeout entry is the one that matters most: a merchant who retries
 * a transfer that is already confirming can pay twice, so that message
 * points at the explorer instead of at the button.
 */
const KNOWN: Array<{ match: RegExp; message: string }> = [
  {
    match: /failed to fetch|networkerror|load failed|err_network|fetch failed/i,
    message: "We couldn't reach UniPay. Check your connection and try again.",
  },
  {
    match: /user rejected|user denied|action_rejected|\b4001\b/i,
    message: 'You cancelled the request in your wallet. Nothing was sent.',
  },
  {
    match: /timed? out|timeout|deadline exceeded/i,
    message:
      'That took too long to confirm. The transfer may already be on its way, so check the explorer before sending again.',
  },
  {
    match: /chain mismatch|unsupported chain|wrong network|switch chain/i,
    message: 'Your wallet is on the wrong network. Approve the switch to Arc, then try again.',
  },
  {
    match: /insufficient funds|insufficient balance/i,
    message: "This wallet doesn't hold enough to cover the transfer and its gas.",
  },
  {
    match: /nonce too low|replacement transaction underpriced|already known/i,
    message:
      'An earlier transaction from this wallet is still settling. Wait for it to confirm, then try again.',
  },
  {
    match: /\b401\b|unauthorized|not authenticated/i,
    message: 'Your session has expired. Log out and sign in again.',
  },
  {
    match: /\b(429|rate limit)\b/i,
    message: 'Too many requests at once. Wait a few seconds and try again.',
  },
];

/** Hex blobs, stack frames and enum shouting are not sentences. */
function readsAsSentence(text: string): boolean {
  if (text.length < 8 || text.length > 200) return false;
  if (/0x[0-9a-f]{8,}/i.test(text)) return false;
  if (/\n|\bat \w+ \(|Error:|_[A-Z]{2,}|[{}<>]/.test(text)) return false;
  if (/^[A-Z0-9_]+$/.test(text)) return false;
  return /^[A-Z]/.test(text) && /[.!?]$/.test(text);
}

function rawText(raw: unknown): string {
  if (typeof raw === 'string') return raw;
  if (raw instanceof Error) return raw.message;
  return '';
}

/**
 * Turns whatever a failure produced into something a merchant can act on.
 *
 * A server message that already reads as a sentence passes through
 * untouched — the API writes those for humans, and rewording them here
 * would lose real information such as which field was rejected.
 */
export function humanizeError(raw: unknown): HumanError {
  const text = rawText(raw).trim();
  if (!text) return { message: GENERIC };

  for (const { match, message } of KNOWN) {
    if (match.test(text)) return { message, detail: text };
  }

  if (readsAsSentence(text)) return { message: text };

  return { message: GENERIC, detail: text };
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd business && npx vitest run components/humanize-error.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 8: Write `alert.tsx`**

Create `business/components/alert.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { cx } from './cx';
import { humanizeError } from './humanize-error';

/**
 * The one way this app shows a failure.
 *
 * The human sentence leads. The original text is kept behind a
 * disclosure so a merchant can hand support something exact without
 * having to read it first — sixteen screens used to print it raw as the
 * only thing on offer.
 */
export function Alert({ error, className }: { error: unknown; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!error) return null;

  const { message, detail } = humanizeError(error);

  return (
    <div
      role="alert"
      className={cx(
        'rounded-card border border-negative-line bg-negative-wash px-4 py-3 text-negative-ink',
        className,
      )}
    >
      <p>{message}</p>
      {detail && detail !== message && (
        <>
          <button
            type="button"
            onClick={() => setOpen((was) => !was)}
            className="mt-1.5 text-caption underline underline-offset-2 hover:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-expanded={open}
          >
            {open ? 'Hide details' : 'Show details'}
          </button>
          {open && (
            <p className="mt-1.5 break-words font-mono text-caption text-muted">{detail}</p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 9: Verify they compile and lint**

Run: `cd business && npx tsc --noEmit && npx eslint components && npm test`
Expected: clean, all suites green.

- [ ] **Step 10: Commit**

```bash
git add business/components/table.tsx business/components/field.tsx business/components/copy-row.tsx business/components/alert.tsx business/components/humanize-error.ts business/components/humanize-error.test.ts
git commit -m "feat(business): add Table, Field, CopyRow, and honest error copy

Inputs move onto the sunken surface. They used to borrow the canvas
colour, which made them invisible on a white card — the bug the new
surface token exists to fix.

CopyRow keeps its silent clipboard failure: the value is selectable on
screen, so a missing clipboard needs no error state.

Sixteen screens printed a raw error string as the only thing on offer —
Failed to fetch, revert dumps, HTTP 500. Alert leads with the sentence a
merchant can act on and keeps the original behind a disclosure, so
support still gets something exact. The timeout wording is the one that
earns its keep: it points at the explorer rather than the button,
because a merchant who retries a transfer that is already confirming
can pay twice.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: The guard test, and Wave 1 — the invoices list

The guard makes spec §6's "done means" mechanically true. It starts with every route on the allowlist; each wave from here deletes entries. **Adding an entry back is never a valid fix.**

**Files:**
- Create: `business/components/design-system.guard.test.ts`
- Modify: `business/app/(merchant)/dashboard/invoices/page.tsx` (whole file, 87 lines)

**Interfaces:**
- Consumes: every primitive from Tasks 4–7.
- Produces: the `MIGRATING` allowlist that Tasks 9–14 shrink.

- [ ] **Step 1: Write the failing guard test**

Create `business/components/design-system.guard.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', 'app');

/**
 * Routes that still hand-roll their styling. Each wave DELETES entries
 * here. Adding one back is never a valid fix for a failing guard — the
 * fix is to use the primitive.
 */
const MIGRATING = new Set<string>([
  'layout.tsx',
  '(merchant)/page.tsx',
  '(merchant)/dashboard/layout.tsx',
  '(merchant)/dashboard/nav.tsx',
  '(merchant)/dashboard/page.tsx',
  '(merchant)/dashboard/wallet-card.tsx',
  '(merchant)/dashboard/invoices/[id]/page.tsx',
  '(merchant)/dashboard/invoices/[id]/share-card.tsx',
  '(merchant)/dashboard/invoices/new/page.tsx',
  '(merchant)/dashboard/identity/page.tsx',
  '(merchant)/dashboard/identity/claim-form.tsx',
  '(merchant)/dashboard/identity/identity-card.tsx',
  '(merchant)/dashboard/identity/registration-flow.tsx',
  '(merchant)/dashboard/team/page.tsx',
  '(merchant)/dashboard/team/employee-form.tsx',
  '(merchant)/dashboard/team/employee-table.tsx',
  '(merchant)/dashboard/payroll/page.tsx',
  '(merchant)/dashboard/payroll/new/page.tsx',
  '(merchant)/dashboard/payroll/[id]/page.tsx',
  '(merchant)/dashboard/settings/page.tsx',
  'i/[id]/invoice-view.tsx',
]);

/**
 * Each rule names the primitive that owns the pattern. The patterns are
 * deliberately shape-specific: a decorative `bg-accent` hairline is
 * fine, a rounded padded one is a button that should come from Button.
 */
const RULES: Array<{ pattern: RegExp; owner: string }> = [
  /*
   * Padding is what distinguishes a button from a decoration: the
   * landing page's bullet dot and nonce underline are both `bg-accent`
   * with no padding, and they are not buttons.
   */
  { pattern: /bg-accent[^"'`]*\bpx-\d/, owner: 'Button (components/button.tsx)' },
  { pattern: /border-line\s+bg-(card|surface)/, owner: 'Card (components/card.tsx)' },
  { pattern: /text-center\s+text-muted/, owner: 'EmptyState (components/empty-state.tsx)' },
  { pattern: /\bbg-(emerald|amber|blue|orange|red|stone)-\d{2,3}/, owner: 'TONE (components/badge.tsx)' },
  { pattern: /\bbg-(ground|card)\b/, owner: 'the canvas/surface tokens' },
  { pattern: /text-red-600/, owner: 'Alert (components/alert.tsx)' },
  { pattern: /rounded-(sm|md|lg|xl|2xl|full)\b/, owner: 'the three radius tokens' },
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.tsx'))
    .map((entry) => entry.split(sep).join('/'));
}

describe('design system guard', () => {
  const files = sourceFiles(APP);

  it('finds the app source tree', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('lists only files that exist, so a rename cannot hide behind the allowlist', () => {
    for (const allowed of MIGRATING) {
      expect(files, `${allowed} is allowlisted but does not exist`).toContain(allowed);
    }
  });

  it('never hand-rolls a primitive in a migrated file', () => {
    const violations: string[] = [];

    for (const file of files) {
      if (MIGRATING.has(file)) continue;
      const source = readFileSync(join(APP, file), 'utf8');
      for (const { pattern, owner } of RULES) {
        const hit = source.match(pattern);
        if (hit) violations.push(`${file}: "${hit[0]}" belongs to ${owner}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the guard to verify it fails**

Run: `cd business && npx vitest run components/design-system.guard.test.ts`
Expected: FAIL on the third test. `invoices/page.tsx` is not on the allowlist and still contains `rounded-lg border border-line bg-card`, `rounded-md bg-accent px-4 py-2`, `px-4 py-8 text-center text-muted`, and `rounded-full`. Confirm the violation list names that file — that is the wave's to-do list.

- [ ] **Step 3: Migrate the invoices list**

Replace the whole of `business/app/(merchant)/dashboard/invoices/page.tsx` with:

```tsx
'use client';

import { ButtonLink } from '@/components/button';
import { Badge } from '@/components/badge';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { Table, Td, Th, Tr } from '@/components/table';
import Link from 'next/link';
import { useInvoices } from '@/lib/use-invoices';
import { presentStatus } from '@/lib/status';
import { formatUsdc, formatDateTime } from '@/lib/format';

export default function InvoicesPage() {
  const { invoices, error, loading, loaded } = useInvoices();

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title="Invoices"
        subtitle="You receive USDC on Arc, whatever the customer pays with."
        action={<ButtonLink href="/dashboard/invoices/new">New invoice</ButtonLink>}
      />

      <div className="mt-8">
        <Table
          head={
            <>
              <Th>Amount</Th>
              <Th>Description</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th>Expires</Th>
            </>
          }
        >
          {invoices.map((invoice) => {
            const status = presentStatus(invoice.status);
            return (
              <Tr key={invoice.id}>
                <Td>
                  <Link
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="font-mono font-medium text-ink hover:text-accent"
                  >
                    {formatUsdc(BigInt(invoice.payableBase))}
                  </Link>
                </Td>
                <Td>{invoice.description ?? '—'}</Td>
                <Td>
                  <Badge className={status.className}>{status.label}</Badge>
                </Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(invoice.createdAt)}</Td>
                <Td className="whitespace-nowrap text-muted">{formatDateTime(invoice.expiresAt)}</Td>
              </Tr>
            );
          })}
        </Table>

        {invoices.length === 0 && (
          <EmptyState
            loading={loading}
            loaded={loaded}
            error={error}
            subject="your invoices"
            empty="No invoices yet."
          />
        )}
      </div>
    </main>
  );
}
```

Two behaviour notes. The error banner that used to render above the table is now folded into `EmptyState`, which is correct because `useInvoices` only errors when it has no data to show. And the empty state moved outside `Table`, since a `<p>` is not valid inside `<tbody>` — it was previously a sibling of the table inside the card, which had the same effect.

- [ ] **Step 4: Confirm the allowlist needs no edit**

`invoices/page.tsx` was deliberately left **off** `MIGRATING` in Step 1, which is why the guard failed against it in Step 2. There is nothing to delete here. Confirm by running:

```bash
cd business && grep -c "invoices/page.tsx" components/design-system.guard.test.ts
```

Expected: `0`. Later waves are the ones that delete entries.

- [ ] **Step 5: Run the guard and the full suite**

Run: `cd business && npx vitest run components/design-system.guard.test.ts && npm test && npx tsc --noEmit`
Expected: guard PASSES (3 tests), all other suites green, types clean.

- [ ] **Step 6: Look at it**

Run: `cd business && npm run dev`, open `/dashboard/invoices`, and check at desktop width **and ~400px**:
- head row reads as recessed (sunken) with uppercase faint labels
- rows are 44px, hairline-ruled, hover tints to canvas
- the status badge is a wash with a ring, not a fill
- Tab-focus the "New invoice" button and confirm a visible teal ring
- with the API stopped, the empty state says it could not load *and* that nothing was lost

- [ ] **Step 7: Commit**

```bash
git add business/components/design-system.guard.test.ts "business/app/(merchant)/dashboard/invoices/page.tsx"
git commit -m "feat(business): enforce the design system, and adopt it on invoices

The guard greps app/ and fails when a migrated file hand-rolls a button,
a card, an empty state or a status colour. Every route starts
allowlisted; each wave deletes entries, and adding one back is never a
valid fix.

Invoices goes first as the proof: the table, badge, header and empty
state all come from primitives now, and the empty state finally
distinguishes an unreachable API from an actually empty ledger.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Wave 2 — the shell

The frame around every screen reviewed after this, and where `accent-wash` earns its keep.

**Files:**
- Modify: `business/app/(merchant)/dashboard/nav.tsx` (74 lines), `business/app/(merchant)/dashboard/layout.tsx:88-164` (the returned JSX only)
- Modify: `business/components/design-system.guard.test.ts` (drop 2 allowlist entries)

**Interfaces:**
- Consumes: `Button` (Task 4), `cx` (Task 2).
- Produces: no new exports.

- [ ] **Step 1: Migrate `nav.tsx`**

Replace the `Row` and `Nav` functions in `business/app/(merchant)/dashboard/nav.tsx`. Keep `NavItem`, `PRIMARY`, `SECONDARY`, and `isActive` **exactly as they are** — they are information architecture, which Global Constraint 4 freezes.

```tsx
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
```

Add `import { cx } from '@/components/cx';` to the top of the file, after the `next/navigation` import.

In `Nav`, change the divider to use the token:

```tsx
      <div className="hidden border-t border-line md:my-3 md:block" />
```

(unchanged — `border-line` is already a token; verify no `rounded-md` remains).

- [ ] **Step 2: Migrate the shell in `layout.tsx`**

In `business/app/(merchant)/dashboard/layout.tsx`, change **only** the JSX. Every hook, effect, ref, and comment above `if (!ready || !authenticated) return null;` is payment-adjacent correctness — Global Constraint 1 — and must not be touched.

Replace the error/loading block:

```tsx
  if (!business || !contextValue) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        {error ? (
          <>
            <p className="max-w-md text-negative-ink">We couldn&apos;t load your account.</p>
            <p className="max-w-md font-mono text-caption text-muted">{error}</p>
            <div className="mt-2 flex gap-3">
              <Button
                onClick={() => {
                  startedRef.current = false;
                  setError(null);
                  setRetry((attempt) => attempt + 1);
                }}
              >
                Try again
              </Button>
              <Button variant="quiet" onClick={logout}>
                Log out
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted">Loading your account…</p>
        )}
      </main>
    );
  }
```

Then the shell itself — the `md:` flip from sidebar to top bar is load-bearing, so the breakpoint classes are preserved exactly and only colours, radii and type change:

```tsx
      <div className="flex h-dvh flex-col overflow-hidden md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-line bg-surface md:h-full md:w-56 md:border-b-0 md:border-r md:px-4 md:py-6">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:block md:px-3 md:py-0">
            <div className="min-w-0">
              <span className="text-subhead font-semibold tracking-tight text-ink">UniPay</span>
              <p className="text-label uppercase text-faint md:mt-1">Business</p>
            </div>
            {/* On a narrow screen the footer block below is hidden, so the
                wallet and log-out ride in the brand row instead. */}
            <div className="flex shrink-0 items-center gap-3 md:hidden">
              <span className="font-mono text-caption text-muted">
                {shortenAddress(business.walletAddress)}
              </span>
              <Button variant="quiet" size="sm" onClick={logout}>
                Log out
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col md:mt-8">
            <Nav />
          </div>

          <div className="hidden border-t border-line pt-4 md:block">
            <p className="truncate px-3 font-mono text-caption text-muted">
              {business.walletAddress}
            </p>
            <Button variant="quiet" size="sm" className="mt-2 px-3" onClick={logout}>
              Log out
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
      </div>
```

Add `import { Button } from '@/components/button';` to the imports.

- [ ] **Step 3: Drop both files from the allowlist**

In `business/components/design-system.guard.test.ts`, delete these two lines from `MIGRATING`:

```ts
  '(merchant)/dashboard/layout.tsx',
  '(merchant)/dashboard/nav.tsx',
```

- [ ] **Step 4: Run the guard and full suite**

Run: `cd business && npm test && npx tsc --noEmit`
Expected: green. If the guard reports `bg-stone-100` in `nav.tsx`, the `Soon` chip was missed — it must be `bg-surface-sunken`.

- [ ] **Step 5: Look at it, especially the breakpoint flip**

Run `npm run dev` and check `/dashboard/invoices`:
- **Desktop:** sidebar 224px, active row in accent-wash, brand block reads as a unit, wallet + log-out pinned at the bottom
- **~400px:** sidebar becomes a top bar, nav scrolls horizontally, wallet address and log-out appear in the brand row, and the footer block is hidden
- Tab through the nav and confirm every row shows a focus ring
- Confirm the active row is legible without relying on colour alone (it is also `font-medium`)

- [ ] **Step 6: Commit**

```bash
git add "business/app/(merchant)/dashboard/layout.tsx" "business/app/(merchant)/dashboard/nav.tsx" business/components/design-system.guard.test.ts
git commit -m "feat(business): rebuild the shell on the token layer

The active nav row is the one place accent-wash appears, so the current
screen is legible at a glance without a second chromatic fill competing
with the page's own action. It carries font-medium too, so the state
does not rest on colour alone.

The md: flip from sidebar to top bar is load-bearing and its breakpoint
classes are untouched. Every hook and effect above the JSX is
payment-adjacent and untouched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: Wave 3 — the overview

**Files:**
- Modify: `business/app/(merchant)/dashboard/page.tsx` (158 lines), `business/app/(merchant)/dashboard/wallet-card.tsx` (124 lines)
- Modify: `business/components/design-system.guard.test.ts` (drop 2 entries)

**Interfaces:**
- Consumes: `PageHeader`, `ButtonLink`, `Card`, `EmptyState`, `Figure`, `TONE`, `CopyRow`, `cx`.
- Produces: no new exports.

- [ ] **Step 1: Replace the local `Stat` with a tokenised one**

In `business/app/(merchant)/dashboard/page.tsx`, replace the local `Stat` function (lines 16–24) with:

```tsx
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <p className="text-label uppercase text-faint">{label}</p>
      <p className="mt-2 font-mono text-section text-ink">{value}</p>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </Card>
  );
}
```

- [ ] **Step 2: Migrate the header, stats fallback and activity list**

In the same file, replace the returned JSX from `<header>` through the closing `</section>` with:

```tsx
    <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-8 md:py-10">
      <PageHeader
        title={business.name ?? 'Overview'}
        subtitle="Settling to USDC on Arc."
        action={<ButtonLink href="/dashboard/invoices/new">New invoice</ButtonLink>}
      />

      {loaded ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Received"
            value={`${formatUsdc(stats.receivedBase)} USDC`}
            sub={`across ${stats.paidCount} paid ${stats.paidCount === 1 ? 'invoice' : 'invoices'}`}
          />
          <Stat label="Awaiting payment" value={`${formatUsdc(stats.awaitingBase)} USDC`} />
          <Stat label="Open invoices" value={String(stats.openCount)} />
        </div>
      ) : (
        <Card className="mt-8" padded={false}>
          <EmptyState
            loading={loading}
            loaded={loaded}
            error={error}
            subject="your figures"
            empty="No figures yet."
          />
        </Card>
      )}

      <WalletCard address={business.walletAddress} />

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-subhead text-ink">Recent activity</h2>
          <Link href="/dashboard/invoices" className="text-muted hover:text-ink">
            All invoices →
          </Link>
        </div>

        <Card className="mt-4" padded={false}>
          <ul className="divide-y divide-line">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-caption font-medium ring-1',
                      entry.direction === 'in' ? TONE.positive : TONE.neutral,
                    )}
                    aria-hidden
                  >
                    {entry.direction === 'in' ? '↓' : '↑'}
                  </span>
                  <div className="min-w-0">
                    <Link href={entry.href} className="font-medium text-ink hover:text-accent">
                      {entry.title}
                    </Link>
                    <p className="truncate text-muted">
                      {entry.detail} · {formatDateTime(entry.at)}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={cx(
                      'font-mono font-medium',
                      entry.direction === 'in' ? 'text-positive-ink' : 'text-ink',
                    )}
                  >
                    {entry.direction === 'in' ? '+' : '−'}
                    {formatUsdc(entry.amountBase)}
                  </p>
                  {entry.txHash ? (
                    <a
                      href={`${ARC_EXPLORER_URL}/tx/${entry.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-caption text-accent hover:underline"
                    >
                      receipt
                    </a>
                  ) : (
                    <span className="text-caption text-faint">no receipt</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {activity.length === 0 && (
            <EmptyState
              loading={loading}
              loaded={loaded}
              error={error}
              subject="your activity"
              empty="Nothing has moved yet. A paid invoice or a payroll run shows up here."
            />
          )}
        </Card>
      </section>
    </main>
```

Update the imports at the top of the file to add:

```tsx
import { Card } from '@/components/card';
import { ButtonLink } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { PageHeader } from '@/components/page-header';
import { TONE } from '@/components/badge';
import { cx } from '@/components/cx';
```

The `useCallback`/`useEffect` pair that loads payroll batches, and its `catch { setBatches([]) }` degradation, stay exactly as they are — that is Global Constraint 1.

- [ ] **Step 3: Migrate `wallet-card.tsx`**

Read `business/app/(merchant)/dashboard/wallet-card.tsx` in full first. Then: wrap its outer surface in `Card`, replace its label/value pairs with `CopyRow` where the value is an address or a link, replace any `rounded-lg`/`rounded-md` with `rounded-card`/`rounded-control`, `bg-ground` with `bg-surface-sunken`, and any accent button with `Button`. Keep every wallet-reading hook and its error handling unchanged.

- [ ] **Step 4: Drop both files from the allowlist**

Delete from `MIGRATING`:

```ts
  '(merchant)/dashboard/page.tsx',
  '(merchant)/dashboard/wallet-card.tsx',
```

- [ ] **Step 5: Run the guard and full suite**

Run: `cd business && npm test && npx tsc --noEmit`
Expected: green. `overview.test.ts` and `activity.test.ts` must pass **unedited** — if either fails, presentation has leaked into derivation logic.

- [ ] **Step 6: Look at it**

`/dashboard` at both widths. The three stat cards should read as one row of instruments; the activity list's in/out chips now come from `TONE`, so a received payment is the same green as a Paid badge — check that they match.

- [ ] **Step 7: Commit**

```bash
git add "business/app/(merchant)/dashboard/page.tsx" "business/app/(merchant)/dashboard/wallet-card.tsx" business/components/design-system.guard.test.ts
git commit -m "feat(business): rebuild the overview on the primitives

The activity list's in and out chips take their colour from TONE now, so
a received payment is the same green as a Paid badge. It was picking
emerald-50 out of the raw palette and landing near, but not on, the
value status.ts uses.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 11: Wave 4 — invoice detail, new invoice, share card

**Files:**
- Modify: `business/app/(merchant)/dashboard/invoices/[id]/page.tsx` (150 lines), `.../[id]/share-card.tsx` (94 lines), `.../new/page.tsx` (87 lines)
- Modify: `business/components/design-system.guard.test.ts` (drop 3 entries)

**Interfaces:**
- Consumes: `PageHeader`, `Button`, `Card`, `Badge`, `Field`, `inputClass`, `Figure`, `CopyRow`, `EmptyState`.
- Produces: no new exports.

- [ ] **Step 1: Read all three files in full**

Run: `cd business && cat "app/(merchant)/dashboard/invoices/[id]/page.tsx" "app/(merchant)/dashboard/invoices/[id]/share-card.tsx" "app/(merchant)/dashboard/invoices/new/page.tsx"`

Note every status pill, card, button, input, and centered message. That list is this task's work.

- [ ] **Step 2: Migrate `new/page.tsx`**

Wrap each labelled input in `Field` with `inputClass()` on the control, replace the submit button (`rounded-md bg-accent px-5 py-2.5 …`, line 80) with `<Button type="submit" disabled={…}>`, wrap the form surface in `Card`, and put the screen title through `PageHeader`. Keep the amount parsing, the `payableBase` handling, and every validation branch unchanged.

- [ ] **Step 3: Migrate `[id]/page.tsx`**

Replace the status pill with `<Badge className={status.className}>`, the amount with `<Figure amount={…} />`, each surface with `Card`, the timeline's step markers with `TONE` classes, and any centered loading/error text with `EmptyState`. The timeline's honest "skipped step" rendering for `PROCESSING` — which exists because the consumer app does not call the payments endpoint — must render exactly as it does now.

- [ ] **Step 4: Migrate `share-card.tsx`**

Replace its address/link rows with `CopyRow`, its surface with `Card`, and its buttons with `Button`. The QR code element from `qrcode.react` keeps its current size and `bg-white` (a QR needs true white to scan reliably, not the surface token) — leave it, and add a one-line comment saying why.

- [ ] **Step 5: Drop the three files from the allowlist**

Delete from `MIGRATING`:

```ts
  '(merchant)/dashboard/invoices/[id]/page.tsx',
  '(merchant)/dashboard/invoices/[id]/share-card.tsx',
  '(merchant)/dashboard/invoices/new/page.tsx',
```

- [ ] **Step 6: Run the guard and full suite**

Run: `cd business && npm test && npx tsc --noEmit`
Expected: green, with `timeline.test.ts` and `format.test.ts` passing unedited.

The QR's `bg-white` matches no guard rule, so it needs no exemption.

- [ ] **Step 7: Look at it**

Create an invoice end to end at both widths. Check the QR still scans with a phone. Confirm the invoice detail's timeline still shows Pending → Paid honestly, with no stuck spinner on the skipped Processing step.

- [ ] **Step 8: Commit**

```bash
git add "business/app/(merchant)/dashboard/invoices" business/components/design-system.guard.test.ts
git commit -m "feat(business): rebuild the invoice loop on the primitives

The QR keeps a true-white ground rather than the surface token, because
a scanner needs the contrast. The timeline still shows a skipped
Processing step honestly.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 12: Wave 5 — team and payroll

The densest wave: `payroll/[id]/page.tsx` is 368 lines of chain-aware execution logic interleaved with markup.

**Files:**
- Modify: `business/app/(merchant)/dashboard/team/page.tsx` (153), `team/employee-form.tsx` (138), `team/employee-table.tsx` (126), `payroll/page.tsx` (97), `payroll/new/page.tsx` (197), `payroll/[id]/page.tsx` (368)
- Modify: `business/components/design-system.guard.test.ts` (drop 6 entries)

**Interfaces:**
- Consumes: every primitive.
- Produces: no new exports.

- [ ] **Step 1: Read all six files in full before editing any of them**

- [ ] **Step 2: Migrate the two tables**

`team/employee-table.tsx` and the payroll list tables move to `Table`/`Th`/`Tr`/`Td`. Their column sets, sort order, and cell contents do not change — Global Constraint 4.

- [ ] **Step 3: Migrate the forms**

`team/employee-form.tsx` and `payroll/new/page.tsx`: each labelled control into `Field` with `inputClass()`, each submit into `Button`. Every validation branch, address check, and chain-selection behaviour stays byte-identical in effect.

- [ ] **Step 4: Migrate `payroll/[id]/page.tsx` by extraction, not rewrite**

This file mixes presentation with the per-item execution state machine that four recent commits fixed. Work in this order:

1. Identify the purely presentational blocks — the per-item row, the status chip, the batch summary header, the receipt link.
2. Extract each into a local component **in the same file**, moving the JSX **unchanged**.
3. Only then restyle inside those extracted components.

Do not reorder hooks, do not touch effect dependency arrays, do not change when a send is armed, and do not alter how a confirmed hash is paired with its call. If a restyle seems to require any of that, stop — Global Constraint 1.

Payroll statuses take their colour from `TONE`, replacing whatever raw palette classes are there now.

- [ ] **Step 5: Migrate the remaining screens' empty states**

`team/page.tsx`, `payroll/page.tsx`, and `payroll/new/page.tsx` each have a `px-6 py-12 text-center` block. All three become `EmptyState` with an accurate `subject` ("your team", "your payroll runs", "your team").

- [ ] **Step 6: Drop all six files from the allowlist**

Delete from `MIGRATING`:

```ts
  '(merchant)/dashboard/team/page.tsx',
  '(merchant)/dashboard/team/employee-form.tsx',
  '(merchant)/dashboard/team/employee-table.tsx',
  '(merchant)/dashboard/payroll/page.tsx',
  '(merchant)/dashboard/payroll/new/page.tsx',
  '(merchant)/dashboard/payroll/[id]/page.tsx',
```

- [ ] **Step 7: Run the guard and full suite**

Run: `cd business && npm test && npx tsc --noEmit && npm run build`
Expected: green. **`wallet-batch.test.ts` (21KB, the largest suite) and `payout-chains.test.ts` must pass unedited.** They cover exactly the logic this task must not disturb; a failure here means the extraction moved behaviour.

- [ ] **Step 8: Look at it**

Run a payroll batch on testnet at both widths. Confirm: a partially-sent batch still reports per-item state correctly, each receipt link still points at the right transaction, and nobody can be paid twice by double-clicking.

- [ ] **Step 9: Commit**

```bash
git add "business/app/(merchant)/dashboard/team" "business/app/(merchant)/dashboard/payroll" business/components/design-system.guard.test.ts
git commit -m "feat(business): rebuild team and payroll on the primitives

payroll/[id] was restyled by extracting its presentational blocks first
and moving the JSX unchanged, then styling inside them. The per-item
execution state machine, the hash-to-call pairing and the double-send
guards are untouched, and wallet-batch and payout-chains pass unedited.

Payroll statuses take their colour from TONE rather than re-guessing it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 13: Wave 6 — identity and settings

**Files:**
- Modify: `business/app/(merchant)/dashboard/identity/page.tsx` (70), `identity/claim-form.tsx` (128), `identity/identity-card.tsx` (61), `identity/registration-flow.tsx` (378), `settings/page.tsx` (175)
- Modify: `business/components/design-system.guard.test.ts` (drop 5 entries)

**Interfaces:**
- Consumes: every primitive.
- Produces: no new exports.

- [ ] **Step 1: Read all five files in full**

- [ ] **Step 2: Migrate `settings/page.tsx`**

Three `rounded-lg border border-line bg-card p-6` sections become `Card`; the payout-address control goes into `Field` with `inputClass()`; the save button (line 99) becomes `<Button>`. **The deliberate-change path for the payout address keeps every one of its confirmations** — this is the screen where changing a payout address is meant to feel like an intentional act, and no styling change may make it feel lighter.

- [ ] **Step 3: Migrate `registration-flow.tsx`**

Its step indicator currently does `done ? 'bg-emerald-500' : active ? 'bg-accent' : 'bg-stone-300'` (line 268). Replace with tokens: `bg-positive-ink`, `bg-accent`, `bg-line-strong`. Its three accent buttons (lines 280, 300, 328) become `Button`. The commit → 60s wait → register sequence, and every timer and error branch in it, stays exactly as it is.

- [ ] **Step 4: Migrate `claim-form.tsx` and `identity-card.tsx`**

`Field` + `inputClass()` for the name input, `Button` for the submit, `Card` for both surfaces, `CopyRow` for any displayed ENS name or address.

- [ ] **Step 5: Drop all five files from the allowlist**

Delete from `MIGRATING`:

```ts
  '(merchant)/dashboard/identity/page.tsx',
  '(merchant)/dashboard/identity/claim-form.tsx',
  '(merchant)/dashboard/identity/identity-card.tsx',
  '(merchant)/dashboard/identity/registration-flow.tsx',
  '(merchant)/dashboard/settings/page.tsx',
```

- [ ] **Step 6: Run the guard and full suite**

Run: `cd business && npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 7: Look at it**

Both screens at both widths. Walk the registration flow far enough to see the step indicator in all three states and confirm the states are distinguishable without colour (the `done` step should also differ in shape or content, not hue alone — if it does not, add a check glyph).

- [ ] **Step 8: Commit**

```bash
git add "business/app/(merchant)/dashboard/identity" "business/app/(merchant)/dashboard/settings" business/components/design-system.guard.test.ts
git commit -m "feat(business): rebuild identity and settings on the primitives

The registration step indicator was picking emerald-500, accent and
stone-300 out of three different palettes; it now reads from the tone
tokens. The payout-address change keeps every confirmation it had —
that screen is meant to feel like an intentional act.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 14: Wave 7 — the public pages, and deleting the legacy aliases

The last wave empties the allowlist, which is what lets the aliases go.

**Files:**
- Modify: `business/app/i/[id]/invoice-view.tsx` (341), `business/app/(merchant)/page.tsx` (200), `business/app/layout.tsx:28`
- Modify: `business/app/globals.css` (delete 2 tokens), `business/components/tokens.test.ts` (invert one test)
- Modify: `business/components/design-system.guard.test.ts` (empty the allowlist)

**Interfaces:**
- Consumes: every primitive.
- Produces: an empty `MIGRATING` set.

- [ ] **Step 1: Migrate `invoice-view.tsx`**

Delete its local `CopyRow` (lines 41–70) and import `@/components/copy-row` instead — the promoted version is behaviourally identical, including the silent clipboard failure. Its `Shell`, the PAID and non-payable panels, and the pay button all move to `Card`, `Figure`, `Badge` and `Button`.

The payment state machine is the most safety-critical code in the app: `Phase`, `PHASE_LABEL`, `TERMINAL_STATUSES`, the polling effect, the `armed` computation, and every branch of `pay()` stay exactly as they are. In particular the comment-documented rule that **no state after `signing` re-arms the button** must remain true after restyling — verify by reading, not by assuming.

- [ ] **Step 2: Point the root layout at the new tokens**

`business/app/layout.tsx:28` still says `bg-ground`, which is about to stop existing. Change the one class:

```tsx
      <body className="min-h-full flex flex-col bg-canvas text-ink">
```

Do **not** add `font-sans`. The font needs no utility: Tailwind's preflight applies `--font-sans` to `html` (`preflight.css:33` → `theme.css:494`), and the `@theme` block defines it as IBM Plex. That is why Task 1 could drop `font-family` from the `body {}` rule.

- [ ] **Step 3: Align the landing page**

`business/app/(merchant)/page.tsx` mostly stands. Change only:
- `cta()`'s hand-typed class string → `buttonClass({ size: … })`, keeping both call sites' padding intent (`sm` for the header, `md` for the hero)
- `rounded-xl border border-line bg-card p-7 shadow-[…]` → `<Card className="shadow-float p-7">` (this is the one `shadow-float` on the page — spec §2.6's one-per-view privilege, honoured)
- the display figure → `text-display`, replacing the inline `clamp()`
- `bg-ground`/`bg-card` → `bg-canvas`/`bg-surface`

**Keep the `NONCE_UNDERLINE` animation exactly as it is,** including its `prefers-reduced-motion` guard. It is the app's one orchestrated entrance and the reason this page reads as designed.

- [ ] **Step 4: Empty the allowlist**

In `business/components/design-system.guard.test.ts`, reduce `MIGRATING` to:

```ts
/**
 * Empty, and it stays empty. A new screen uses the primitives from the
 * start; this set exists only as the record of a migration that finished.
 */
const MIGRATING = new Set<string>([]);
```

- [ ] **Step 5: Run the guard to confirm the whole tree is clean**

Run: `cd business && npx vitest run components/design-system.guard.test.ts`
Expected: PASS. Any violation names a file and the primitive that owns the pattern — fix the file, never the allowlist.

- [ ] **Step 6: Delete the legacy aliases**

In `business/app/globals.css`, delete the alias block:

```css
  /*
   * Legacy aliases. Screens migrate in waves, and an unmigrated screen
   * still says bg-ground / bg-card. Deleted in the final task.
   */
  --color-ground: #FAFAF9;
  --color-card: #FFFFFF;
```

In `business/components/tokens.test.ts`, invert that test so the aliases can never come back:

```ts
  it('has no legacy aliases left', () => {
    // The migration is finished; bg-ground and bg-card are gone, and the
    // guard test keeps them from returning.
    for (const legacy of ['ground', 'card']) {
      expect(theme, legacy).not.toContain(`--color-${legacy}:`);
    }
  });
```

- [ ] **Step 7: Full verification**

Run: `cd business && npm test && npx tsc --noEmit && npm run build`
Expected: all suites green — the eight originals unedited, plus `tokens`, `cx`, `list-state`, and the guard. Build clean.

If the build fails with an unknown utility `bg-ground` or `bg-card`, a screen was missed; the guard's `bg-(ground|card)` rule should have caught it, so also check `.ts` files and any `className` built by string concatenation.

- [ ] **Step 8: Look at all twelve routes**

Walk every route at desktop and ~400px:

`/` · `/dashboard` · `/dashboard/invoices` · `/dashboard/invoices/new` · `/dashboard/invoices/[id]` · `/dashboard/identity` · `/dashboard/team` · `/dashboard/payroll` · `/dashboard/payroll/new` · `/dashboard/payroll/[id]` · `/dashboard/settings` · `/i/[id]`

Check spec §6's done-means list: no hand-rolled button, card, or status colour anywhere; every list's three states from `EmptyState`; every interactive element reachable and visibly focused by keyboard; and at most one `shadow-float` per view.

- [ ] **Step 9: Commit**

```bash
git add business/app business/components business/lib
git commit -m "feat(business): finish the migration and drop the legacy tokens

The allowlist is empty, so bg-ground and bg-card are gone and the token
test now asserts they cannot come back. Twelve routes, one vocabulary.

invoice-view keeps its payment state machine untouched: no state after
signing re-arms the pay button, which is what stops a customer paying
twice. The landing page keeps its nonce underline and its single
shadow-float.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 15: The copy audit

Global Constraint 12 applies to every task, and this one verifies it across the finished app. Wording is the last thing a merchant judges the product on and the first thing that betrays an unfinished one.

**Files:**
- Create: `business/components/copy.guard.test.ts`
- Modify: any route whose copy the audit finds wanting

**Interfaces:**
- Consumes: `humanizeError`, `Alert` (Task 7).
- Produces: nothing new.

- [ ] **Step 1: Write the failing copy guard**

Create `business/components/copy.guard.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', 'app');

/**
 * Terms that are ours, not the merchant's. Each names what to say
 * instead. Matched inside JSX text and string literals only — an
 * identifier called payableBase is fine, a sentence containing "base
 * units" is not.
 */
const BANNED: Array<{ pattern: RegExp; instead: string }> = [
  { pattern: /base units?\b/i, instead: 'a formatted amount via formatUsdc' },
  { pattern: /\btx\b(?! hash)/i, instead: '"transaction"' },
  { pattern: /\bbatch item\b/i, instead: '"payment" or "person"' },
  { pattern: /\bbiz\b/i, instead: '"business"' },
  { pattern: /\bENS name is nil\b|\bnull\b|\bundefined\b/i, instead: 'an em dash or "Not set"' },
  { pattern: /\b(PENDING|PROCESSING|UNDERPAID|EXPIRED)\b/, instead: 'presentStatus().label' },
  { pattern: /\bfoo\b|\bbar\b|lorem ipsum|TODO|FIXME|XXX/i, instead: 'real copy' },
];

/** Prose the app shows: JSX text nodes and quoted strings in JSX props. */
function userFacingText(source: string): string[] {
  const found: string[] = [];
  // JSX text between tags, e.g. >Nothing has moved yet.<
  for (const m of source.matchAll(/>([^<>{}\n][^<>{}]{4,})</g)) found.push(m[1]);
  // Quoted copy in props that render text.
  for (const m of source.matchAll(
    /(?:title|subtitle|label|empty|subject|placeholder|hint|aria-label)=(?:"([^"]{4,})"|\{'([^']{4,})'\})/g,
  )) {
    found.push(m[1] ?? m[2] ?? '');
  }
  // Template and single-quoted sentences assigned to copy-ish names.
  for (const m of source.matchAll(/(?:message|label|title|body|empty):\s*'([^']{4,})'/g)) {
    found.push(m[1]);
  }
  return found.filter(Boolean);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.tsx'))
    .map((entry) => entry.split(sep).join('/'));
}

describe('copy guard', () => {
  const files = sourceFiles(APP);

  it('uses no developer shorthand in anything a merchant reads', () => {
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(join(APP, file), 'utf8');
      for (const text of userFacingText(source)) {
        for (const { pattern, instead } of BANNED) {
          if (pattern.test(text)) {
            violations.push(`${file}: "${text.trim().slice(0, 70)}" — use ${instead}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('routes every error through Alert rather than printing it raw', () => {
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(join(APP, file), 'utf8');
      // <p ...>{error}</p> and friends: a bare error in a text node.
      if (/>\s*\{\s*(error|err)\s*\}\s*</.test(source)) {
        violations.push(`${file}: prints a raw error — wrap it in <Alert error={…} />`);
      }
    }

    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see the real inventory**

Run: `cd business && npx vitest run components/copy.guard.test.ts`
Expected: FAIL, listing every remaining raw error print and every piece of shorthand. **Read the whole list before fixing anything** — it is the audit.

- [ ] **Step 3: Replace every raw error print with `Alert`**

For each violation from the second test, replace the bare print with the primitive:

```tsx
{/* was: {error && <p className="mt-6 text-red-600">{error}</p>} */}
{error && <Alert error={error} className="mt-6" />}
```

In `dashboard/layout.tsx`, the account-load failure currently shows the sentence *and* the raw text in mono beneath it. That becomes one `Alert`, whose disclosure holds the raw text — the retry and log-out buttons stay exactly where they are.

- [ ] **Step 4: Fix the shorthand the first test found**

Rewrite each flagged string per Global Constraint 12. Where a status enum leaks into prose, route it through `presentStatus().label`. Where a missing value renders as `null` or `undefined`, render an em dash.

**Never remove a term from `BANNED` to make the test pass.** The one permitted adjustment is to `userFacingText`, the prose extractor, and only when a match is demonstrably *not* something a merchant reads — the extractor is hand-rolled regex over JSX and will have false positives. A real user-facing string is always rewritten, never excused.

- [ ] **Step 5: Read every user-facing sentence in the app, in order**

Run: `cd business && npm run dev`, then walk all twelve routes and read the copy aloud as a merchant would meet it. Fix anything that is:
- **A label that assumes our model** — "Payable base", "Dest chain", "Nonce tail"
- **An empty state that says nothing useful** — "No data" tells a merchant nothing about what would put data there
- **A button that names an implementation** — "Submit" where "Send payroll" is what happens
- **A hint that is missing** — an amount field with no indication that the sub-cent tail is added automatically
- **Inconsistent terminology** across screens for the same thing

Keep the existing voice: the landing page's copy ("You name the amount. They pay with whatever they hold.") is the register to match — plain, direct, second person, no exclamation marks.

- [ ] **Step 6: Full verification**

Run: `cd business && npm test && npx tsc --noEmit && npm run build`
Expected: all suites green, including both guards, with the eight original suites unedited.

- [ ] **Step 7: Commit**

```bash
git add business/app business/components
git commit -m "feat(business): make every string a merchant reads production copy

Sixteen screens printed exception text as the only thing on offer. They
route through Alert now, which leads with a sentence and keeps the
original behind a disclosure.

The copy guard greps for the shorthand that leaks from our model into
their reading — base units, tx, batch item, a status enum in prose, a
null rendered as the word null. Weakening the guard to accommodate a
string is never the fix; the string gets rewritten.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review

Run against the spec after the plan is written, before execution starts.

**1. Spec coverage**

| Spec section | Task |
|---|---|
| §2.1–2.7 token layer | Task 1 |
| §3.1 type scale | Task 1 |
| §3.2 typography rules | Tasks 1, 9–14 (applied per screen) |
| §3.3 motion and focus | Task 4 (focus in `Button` base), Task 14 (motion preserved) |
| §4 nine primitives | Tasks 2–7 |
| §4.1 `EmptyState` precedence | Task 3 (logic), Task 6 (component) |
| §4.2 what is not built | File Structure section — no Modal/Toast/Tabs/Tooltip/icons anywhere |
| §5 waves 1–7 | Tasks 8–14 |
| §5.1 extraction not rewrite | Task 12 Step 4 |
| §5.2 responsive checks | Every wave's "look at it" step |
| §6 verification + done-means | Task 14 Steps 6–7, plus the guard test from Task 8 |
| Global Constraint 12, production copy | Task 7 (`humanizeError`, `Alert`), Task 15 (audit) |
| §1 constraints 1–5 | Global Constraints, restated in the tasks they bind |

No gaps.

**2. Placeholder scan**

No "TBD", no "add error handling", no "similar to Task N". Tasks 10 Step 3, 11 Steps 2–4, 12 Steps 2–5, and 13 Steps 2–4 give per-file instructions rather than full file bodies — those files are 61–378 lines of payment logic that must be read before editing, and reproducing them here would invite a blind paste over logic Global Constraint 1 protects. Each names the exact lines, the exact patterns, and the exact primitive.

**3. Type consistency**

- `cx(...parts: Array<string | false | null | undefined>): string` — consistent in Tasks 2, 4, 6, 7, 10.
- `resolveListState(input: ListStateInput): ListState` — defined Task 3, consumed only by `EmptyState` in Task 6.
- `EmptyState` props `{ loading, loaded, error, subject, empty, action?, className? }` — same shape at all six call sites (Tasks 8, 10, 11, 12).
- `TONE: Record<Tone, string>` — defined Task 5, consumed Tasks 10, 12, 13.
- `Badge({ className, children })` takes a class string, never a `tone` prop; `status.className` supplies the tone. Consistent in Tasks 5, 8, 11.
- `buttonClass({ variant?, size?, className? })` — defined Task 4, consumed by `Button`, `ButtonLink`, and Task 14's `cta()`.
- `Card({ padded?, className?, children })` — `padded={false}` used by `Table` (Task 7) and Tasks 10, 11.
- No `busy` prop on `Button` anywhere; no polymorphic `as` on `Card` anywhere.

Consistent.
