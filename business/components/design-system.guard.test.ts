import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', 'app');
const LIB = join(__dirname, '..', 'lib');

/**
 * Empty, and it stays empty. A new screen uses the primitives from the
 * start; this set exists only as the record of a migration that finished.
 */
const MIGRATING = new Set<string>([]);

/**
 * Each rule names the primitive that owns the pattern. The patterns are
 * deliberately shape-specific: a decorative `bg-accent` hairline is
 * fine, a rounded padded one is a button that should come from Button.
 */
const RULES: Array<{ pattern: RegExp; owner: string }> = [
  /*
   * Padding is what distinguishes a button from a decoration: the
   * landing page's bullet dot and nonce underline are both `bg-accent`
   * with no padding, and they are not buttons. Tailwind class order
   * carries no meaning, so each pattern matches either order within the
   * same tag; `[^>]` bounds the gap so a match can never span two
   * elements, and it is capped so it cannot run away. The `(?![\w-])`
   * lookahead keeps `bg-accent-wash` / `bg-accent-hover` (a colour, not
   * a button) out of this rule — the next wave's migrated nav relies on
   * that distinction.
   */
  {
    pattern: /bg-accent(?![\w-])[^>]{0,200}?\bpx-\d|\bpx-\d[^>]{0,200}?bg-accent(?![\w-])/,
    owner: 'Button (components/button.tsx)',
  },
  {
    // A card has a radius; a sidebar or top bar has a border and a surface
    // colour but no radius, and is not a card. The (?![\w-]) guards stop
    // border-line matching inside border-line-strong and bg-surface inside
    // bg-surface-sunken — an input wrapper is not a hand-rolled card.
    pattern: /<[^>]*(?=[^>]*\bborder-line(?![\w-]))(?=[^>]*\bbg-(?:card|surface)(?![\w-]))(?=[^>]*\brounded-)[^>]*>/,
    owner: 'Card (components/card.tsx)',
  },
  {
    // Real ad-hoc empty states carry vertical padding; a centred caption
    // does not. Without this, "Loading…" and "Pay from any wallet" were
    // being flagged as hand-rolled empty states.
    pattern: /<[^>]*(?=[^>]*\btext-center\b)(?=[^>]*\btext-muted\b)(?=[^>]*\b(?:py|my)-\d)[^>]*>/,
    owner: 'EmptyState (components/empty-state.tsx)',
  },
  {
    /*
     * Any property, not just `bg-`. The landing page's dark band used
     * `text-stone-400` and `border-stone-700` for years precisely
     * because this rule only watched backgrounds — the raw palette got
     * in through text and borders while the guard read as green. `zinc`
     * is here too: `providers.tsx` still uses it, and it belongs to the
     * same class of leak.
     */
    pattern: /\b(bg|text|border|ring|outline|divide|fill|stroke)-(emerald|amber|blue|orange|red|stone|zinc|teal|slate|gray|neutral)-\d{2,3}/,
    owner: 'the tokens (globals.css) — TONE for status colours',
  },
  { pattern: /\bbg-(ground|card)\b/, owner: 'the canvas/surface tokens' },
  { pattern: /text-red-600/, owner: 'Alert (components/alert.tsx)' },
  {
    /*
     * Bare `rounded` counts too — it is Tailwind's 0.25rem default and a
     * fourth radius by the back door, which is how `providers.tsx` kept
     * one while this rule read as green. The trailing guard is what lets
     * `rounded-card`, `rounded-control` and `rounded-pill` through.
     */
    pattern: /\brounded(-(sm|md|lg|xl|2xl|3xl|full))?(?![\w-])/,
    owner: 'the three radius tokens',
  },
  {
    pattern: /<[^>]*(?=[^>]*\btext-accent\b)(?=[^>]*\bhover:underline\b)[^>]*>/,
    owner: 'linkClass (components/button.tsx)',
  },
];

interface SourceFile {
  /** Directory the file was found under (joined with `relative` to read it). */
  root: string;
  /** Path relative to `root`, forward-slash separated. */
  relative: string;
  /** What a violation is reported under, and what MIGRATING keys on. */
  label: string;
}

function sourceFiles(root: string, extension: string, label: (relative: string) => string): SourceFile[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith(extension))
    .map((entry) => {
      const relative = entry.split(sep).join('/');
      return { root, relative, label: label(relative) };
    });
}

describe('design system guard', () => {
  // app/**/*.tsx is the migrated screens. lib/**/*.ts is in scope too:
  // lib/status.ts is the one lib/ file this migration was allowed to
  // change, and the historical home of the raw-palette status tuples —
  // without this it could revert to `bg-amber-50 text-amber-700` and
  // nothing here would notice.
  const files = [
    ...sourceFiles(APP, '.tsx', (relative) => relative),
    ...sourceFiles(LIB, '.ts', (relative) => `lib/${relative}`),
  ];

  it('finds the app source tree', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('lists only files that exist, so a rename cannot hide behind the allowlist', () => {
    const labels = files.map((file) => file.label);
    for (const allowed of MIGRATING) {
      expect(labels, `${allowed} is allowlisted but does not exist`).toContain(allowed);
    }
  });

  it('never hand-rolls a primitive in a migrated file', () => {
    const violations: string[] = [];

    for (const { root, relative, label } of files) {
      if (MIGRATING.has(label)) continue;
      const source = readFileSync(join(root, relative), 'utf8');
      for (const { pattern, owner } of RULES) {
        const hit = source.match(pattern);
        if (hit) violations.push(`${label}: "${hit[0]}" belongs to ${owner}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
