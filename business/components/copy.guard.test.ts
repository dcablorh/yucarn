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
  //
  // Narrowed from the brief's version: `[^<>{}]{4,}` allows `\n`, so a
  // TypeScript generic close bracket (`useState<Employee | null>`)
  // reads as a JSX text node's `>` and the match runs on through the
  // call and every `const`/`useState` line after it until the *next*
  // unrelated `<` — real ones observed: "(null);\n  const [error,
  // setError] = useState" and "(initialCalls);\n\n  const step =
  // currentStep(registration); ...". That is code, not something a
  // merchant reads, and it tripped the `null` rule on every one of
  // ~14 `useState<T | null>(null)` declarations in app/. Real JSX
  // text in this app never opens with a literal `(` right after the
  // tag (checked: every `>(` in app/ is `.map((x) => (`, inside a
  // `{}` expression the outer regex already excludes) — filtering
  // those out removes the false positives without touching genuine
  // multi-line prose, which never starts this way.
  for (const m of source.matchAll(/>([^<>{}\n][^<>{}]{4,})</g)) {
    if (!/^\(/.test(m[1].trimStart())) found.push(m[1]);
  }
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
