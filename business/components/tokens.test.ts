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

  it('declares the inverse text roles a dark section needs', () => {
    // surface-inverse existed on its own for a long time, with no text
    // colours to go on it — which is why the landing page's dark band
    // reached for raw palette classes. Measured against #1C1917:
    // ink-inverse 16.03:1, muted-inverse 8.33:1, accent-inverse 9.39:1.
    // The light accent is not decorative: #0F766E is only 3.20:1 there,
    // so it cannot carry text or a focus ring on a dark ground.
    for (const name of ['ink-inverse', 'muted-inverse', 'accent-inverse', 'line-inverse']) {
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
      // One step above display, for the landing hero only. It replaced an
      // inline clamp the scale could not keep in tune with `display`.
      'hero',
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

  it('has no legacy aliases left', () => {
    // The migration is finished; bg-ground and bg-card are gone, and the
    // guard test keeps them from returning.
    for (const legacy of ['ground', 'card']) {
      expect(theme, legacy).not.toContain(`--color-${legacy}:`);
    }
  });

  it('never inverts canvas and surface', () => {
    expect(theme).toContain('--color-canvas: #FAFAF9');
    expect(theme).toContain('--color-surface: #FFFFFF');
  });
});
