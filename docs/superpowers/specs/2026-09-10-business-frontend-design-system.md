# UniPay Business — Frontend Design System

**Date:** 2026-09-10
**Status:** Approved design, pending implementation plan
**Scope:** `business/` presentation only. No `server/`, no `client/`.
**Builds on:** `docs/superpowers/specs/2026-09-09-unipay-merchant-dashboard-design.md` §2.2 (*the shell spec*), whose six-token table this document supersedes with a semantic layer.

---

## 0. Why this document exists

The shell spec chose a direction — warm stone neutrals, one teal accent, IBM Plex Sans with Plex Mono for every figure, 13px base, 44px table rows — and the four implementation plans since then built twelve routes against it. The direction was right. It was never *committed to*, and it was applied by hand on every screen.

The result is measurable drift. In `business/app`:

- **17 hand-typed accent-button declarations**, across three padding pairs (`px-4 py-2`, `px-5 py-2.5`, `px-5 py-3`). **One of the 17** carries `focus-visible` styles — the landing page's. (`bg-accent` appears 20 times; the other three are decorative — the nonce rule, a bullet dot, a step indicator.)
- **36 `border border-line bg-card` declarations**, spanning cards, inputs and table wrappers, mixing `rounded-md` / `rounded-lg` / `rounded-xl` with `p-5` / `p-6` / `p-7`.
- **Ten centered empty/loading blocks across six files**, and **seven screens** branching on `loading` / `loaded` independently, each with its own wording.
- Four hand-built tables, four variants of the display-amount treatment, three near-duplicate copy-to-clipboard rows.

Meanwhile `app/(merchant)/page.tsx` — the landing page — is the best-designed surface in the repository: a nonce tail that underlines itself behind `prefers-reduced-motion`, a `clamp()` display figure, a two-layer shadow, an accent pull-quote. **The standard already exists in the repo.** This document brings the other eleven routes up to it, and moves the vocabulary out of twenty-one component files into one token layer and nine primitives.

### 0.1 Design goal

**Credibility.** A merchant moving real USDC should feel they are in a financial instrument. The reference direction — gathered from `styles.refero.design`, whose DESIGN.md corpus was surveyed for fintech and analytics products — is **"quiet analyst's desk on warm paper"** (Seline Analytics), with the component restraint of Mercury's banking system. Notably, Seline's canvas is `#fafaf9`: byte-identical to the `--color-ground` already in `business/app/globals.css`. The app is already in this family and has simply not committed.

The discipline borrowed, in one line each:

- **Seline** — the 1px hairline border *is* the structure; shadows are rationed to one element per view; the accent is the only chromatic fill on screen.
- **Mercury** — separation by value contrast, not elevation; a single accent reserved exclusively for the primary action.
- **Steep / Linear** — weight restraint (hierarchy from size and position, never from `font-bold`); tight negative tracking at display sizes; three radii, not seven.

### 0.2 Directions considered and rejected

| | Direction | Rejected because |
|---|---|---|
| B | **Mercury dark-first** — onyx `#171721` canvas, graphite cards, cobalt accent | Forks the palette permanently, and the product's core artifact is an invoice. An invoice is a document, and documents are paper. The public `/i/[id]` page would have to stay light regardless, so a dark dashboard buys two palettes to maintain. |
| C | **Full dual-theme token layer**, light and dark shipped together | Most of the budget goes to a dark theme nobody has asked for, across twelve routes of hand-rolled utility classes. |

**Chosen: A — committed warm ledger, light-only, built on C's token discipline.** Tokens are named by role, so adding dark later is a token file rather than a rewrite. Accent stays teal `#0D9488`: it avoids the fintech-blue cliché, reads as settlement rather than generic SaaS, and requires no migration.

---

## 1. Hard constraints

These bind every wave in §5.

1. **Presentation only.** The last five commits on `feat/business-side` are hard-won payment and payroll correctness — not paying anyone twice, pairing each confirmed hash with its own call, not discarding transaction hashes. **No file in `business/lib/` changes except `status.ts`** (whose class tuples become tokens) **and `format.ts`** (only if a display helper is genuinely missing).

2. **All eight vitest suites stay green and stay unedited.** `activity`, `format`, `overview`, `pay`, `payout-chains`, `status`, `timeline`, `wallet-batch`. **If a suite needs editing to pass, that is the signal that this work has strayed out of presentation** — stop and reassess rather than adjusting the test.

   `status.test.ts` deserves a specific note, because it is the one suite this work reaches: it asserts `presentation.className` contains `'bg-'`. Token classes such as `bg-positive-wash` still satisfy that, **so `StatusPresentation` keeps its `className` field** and `Badge` consumes `presentStatus()` rather than replacing it. The migration retones the values; it does not change the shape of the presenter.

3. **No new runtime dependencies.** Tailwind v4 and the existing `@theme` mechanism are sufficient. No component library, no CSS-in-JS, no icon package.

4. **No information-architecture changes.** Routes, navigation order, and the shell's structure are settled by the shell spec §2.1. This document changes how those screens look, not what they contain or where they live.

5. **`client/` remains off-limits**, per the base spec's standing constraints.

---

## 2. The token layer

Replaces the flat `@theme` block in `business/app/globals.css`. Tokens are named by **role**, never by value — `surface-sunken`, not `stone-100` — which is what makes §0.1's "dark later is a token file" claim true.

### 2.1 Surfaces

| Token | Value | Role |
|---|---|---|
| `canvas` | `#FAFAF9` | Page background. Warm off-white that reads as paper. |
| `surface` | `#FFFFFF` | Cards, panels, elevated content. |
| `surface-sunken` | `#F5F5F4` | Inputs at rest, `<code>`, table heads, inset wells. |
| `surface-inverse` | `#1C1917` | Inverted chips and the active tab treatment. |

`surface-sunken` is new and resolves a real bug in kind: inset elements currently borrow `bg-ground`, which makes them invisible when a card sits on the canvas.

**Never invert canvas and surface.** `#FAFAF9` is the page; `#FFFFFF` is only ever a surface on top of it.

### 2.2 Lines

| Token | Value | Role |
|---|---|---|
| `line` | `#E7E5E4` | The primary structural device. Card edges, table rules, dividers. |
| `line-strong` | `#D6D3D1` | Section breaks and input borders needing more definition. |

### 2.3 Text

| Token | Value | Role |
|---|---|---|
| `ink` | `#1C1917` | Headings, figures, primary content. |
| `ink-soft` | `#57534E` | **New.** Body copy and table cell content. |
| `muted` | `#78716C` | Secondary copy, helper text, inactive nav. |
| `faint` | `#A8A29E` | Micro-labels, placeholders, disabled states. |

`ink-soft` is the most consequential single addition. Today `muted` does triple duty — secondary copy, table cells, *and* uppercase micro-labels — so the dashboard has three text levels where it needs four, and reads flat as a result.

### 2.4 Accent and status

| Token | Value | Role |
|---|---|---|
| `accent` | `#0D9488` | The one chromatic fill. Primary action only. |
| `accent-hover` | `#0F766E` | Hover and press. |
| `accent-wash` | `#F0FDFA` | **New.** Active nav row, selected table row. |

The six invoice states move out of `lib/status.ts`'s hardcoded Tailwind tuples and into tokens, each a `{ wash, text, ring }` triple:

| Token | Maps to state |
|---|---|
| `positive` | `PAID` |
| `pending` | `PENDING` |
| `progress` | `PROCESSING` |
| `caution` | `UNDERPAID` |
| `negative` | `FAILED` |
| `neutral` | `EXPIRED` |

Hue assignments carry over from the shell spec (emerald / amber / blue / orange / red / stone), re-toned for the warm ground. The point of promoting them is reference: today nothing outside `status.ts` can name "paid green", so the overview's activity list and the payroll views each re-guess it independently.

**One chromatic filled element per viewport.** Status badges are washes with a ring, not fills, so they do not compete with the primary action.

### 2.5 Radii — exactly three

| Token | Value | Applies to |
|---|---|---|
| `radius-control` | `6px` | Buttons, inputs, selects. |
| `radius-card` | `10px` | Cards, panels, tables. |
| `radius-pill` | `9999px` | Badges, status pills, chips. |

Replaces the current arbitrary mix of `rounded-md` / `lg` / `xl` across 36 surface declarations.

### 2.6 Elevation — two levels and one privilege

| Token | Value | Rule |
|---|---|---|
| *(none)* | — | **Default.** Borders do the work. |
| `shadow-raised` | `0 4px 16px rgba(0,0,0,0.05)` | Cards that must lift off the canvas. |
| `shadow-float` | `0 1px 2px rgba(28,25,23,0.04), 0 12px 32px -16px rgba(28,25,23,0.18)` | **At most one element per view.** |

`shadow-float` is the landing page's existing figure shadow, promoted to a token. Its one-per-view rule is what keeps it meaningful.

### 2.7 Spacing rhythm

4px base. Card padding standardises on **20px** (`p-5`), replacing today's `p-5`/`p-6`/`p-7` drift. Section gap **40px**; page padding **32px** desktop, **20px** below `md`. Table rows stay at the shell spec's **44px**.

---

## 3. Typography

**Keep IBM Plex Sans and IBM Plex Mono. Keep the 13px base.** Both were deliberate and both are correct: the dashboard is a ledger, density is the point, and Plex Mono with `tabular-nums` is what makes amount columns align. What changes is discipline.

### 3.1 The scale

Today the app jumps 11px → 13px → `text-xl` with nothing between, so every intermediate size is improvised per screen.

| Role | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| `caption` | 10px | 400 | `0.02em` | Timestamps, meta. |
| `label` | 11px | 500 | `0.04em`, uppercase | Micro-labels, table heads, stat labels. |
| `body` | 13px | 400 | — | Default. The ledger base. |
| `lead` | 15px | 400 | — | Page subtitles, public-page copy. |
| `subhead` | 17px | 500 | `-0.01em` | Card and section titles. |
| `section` | 20px | 600 | `-0.015em` | Section headings. |
| `title` | 26px | 600 | `-0.02em` | Page titles. |
| `display` | `clamp()` | 500 | `-0.025em` | Landing hero, public invoice amount. |

### 3.2 Rules

- **Negative tracking at size.** `-0.02em` on titles, tighter above. The cheapest change that makes type look designed rather than defaulted.
- **Weight caps at 600, and 600 is rationed.** Hierarchy comes from size, position, and colour. `font-medium` is currently applied to rows, cells, labels, *and* links simultaneously, so nothing wins.
- **Every figure is mono with `tabular-nums`.** The existing `.font-mono` global rule stays; it is correct and load-bearing.
- **`label` is always uppercase with tracking**, and always `faint` — never `muted`. This is what frees `muted` for actual secondary copy.

### 3.3 Motion and focus

Formalise what the landing page already does well:

- Transitions on **colour and opacity only**, 150ms. No layout or transform transitions on hover.
- **One orchestrated entrance per page, maximum**, always inside `@media (prefers-reduced-motion: no-preference)`.
- **`focus-visible` is a primitive's responsibility.** 19 of 20 current buttons have no focus ring; centralising it in `Button` fixes all of them at once. Ring: 2px `accent`, 2px offset.

---

## 4. Primitives

Nine components at `business/components/`, imported via the existing `@/` alias. Each replaces something written three or more times today — nothing speculative.

| Primitive | API sketch | Replaces | Consumers |
|---|---|---|---|
| `Button` | `variant: primary \| secondary \| quiet`, `size: sm \| md`, `busy?` | 17 declarations, 3 padding pairs, 1 focus ring | all |
| `Card` | `padded?` (off for tables and lists) | 36 declarations, 3 radii, 3 paddings | all |
| `Badge` | `tone` from §2.4 status tokens | `status.ts` tuples + per-page re-guesses | invoices, payroll, activity |
| `Field` | `label`, `hint`, `error`, wraps input/select | 5 form implementations | new invoice, new payroll, employee form, settings, claim form |
| `PageHeader` | `title`, `subtitle`, `action` slot | retyped on all 10 dashboard pages | dashboard |
| `Table` / `Th` / `Td` | sunken head, hairline rows, 44px rhythm | 4 hand-built tables | invoices, team, payroll, payroll detail |
| `EmptyState` | `state: loading \| empty \| error`, `message`, `action?` | 10 blocks across 6 files | every list |
| `Figure` | the display amount, mono + tabular + unit | 4 per-page variants | overview, invoice detail, public invoice, payroll detail |
| `CopyRow` | `label`, `value`, clipboard-failure tolerant | 3 near-duplicates | wallet card, share card, settings |

### 4.1 `EmptyState` is the sleeper

Seven screens currently branch on `loading` / `loaded` inline, with copy worded independently each time. The failure states are therefore the app's *least* consistent surface — visible to a merchant at exactly the moment they are most anxious about their money. One primitive taking the triad fixes the consistency and the copy together.

Its `error` state must never imply data loss where none occurred. `CopyRow` likewise keeps the existing silent-failure behaviour for missing clipboard access (insecure contexts, some webviews): the value is selectable on screen, so it needs no error state.

### 4.2 What is deliberately *not* built

No `Modal`, no `Toast`, no `Tabs`, no `Tooltip`, no icon set. None is used today, and YAGNI applies. No `Input` separate from `Field` — a bare input has no callers.

---

## 5. Application waves

Each wave is independently reviewable in the running app and independently committable.

| Wave | Work | Why here |
|---|---|---|
| 1 | Token layer + nine primitives + **Invoices list** | Proof of direction on one real screen before touching fourteen more. |
| 2 | **Shell** — `dashboard/layout.tsx`, `nav.tsx` | The frame around everything. Where `accent-wash` earns its keep on the active row. |
| 3 | **Overview** — stats, wallet card, activity ledger | The screen a merchant lands on. |
| 4 | **Invoice detail + new + share card** | The core loop. |
| 5 | **Team + Payroll** (list, new, detail) | Highest line count; densest logic. |
| 6 | **Identity + Settings** | Forms and long-running flows. |
| 7 | **Public `/i/[id]` + landing alignment** | The customer-facing surfaces. The landing page mostly stands; it adopts the tokens. |

### 5.1 Wave-5 note

`payroll/[id]/page.tsx` (368 lines) and `i/[id]/invoice-view.tsx` (341 lines) interleave payment logic with markup heavily enough that editing the markup in place is error-prone against constraint §1.1. Extract the presentational blocks into local components in the same file or a sibling, **moving logic unchanged** — no rewrites, no behavioural edits, no reordering of effects.

### 5.2 Responsive

Every wave is checked at desktop **and ~400px**. The shell's `md:` flip from sidebar to horizontal top bar is the most fragile thing in the layout: below `md`, the wallet address and log-out relocate into the brand row and the nav scrolls horizontally. That behaviour is load-bearing and must survive.

---

## 6. Verification

Per wave, in order:

1. `npm test` in `business/` — vitest plus eslint. Green, with all eight suites unedited.
2. `npm run build` — types clean.
3. Dev server, screen by screen, desktop and ~400px.

There is no visual regression tooling in the repo and this document does not add any; verification of appearance is by driving the running app.

**Done means:** no `bg-accent` string outside `Button`; no `border-line bg-card` string outside `Card`; no inline status class tuples; every list's empty, loading, and error state coming from `EmptyState`; every interactive element reachable and visibly focused by keyboard; all eight suites green.
