import { describe, it, expect } from 'vitest';
import { formatUsdc, parseUsdcInput, formatDateTime } from './format';

describe('formatUsdc', () => {
  it('renders whole amounts with two decimals', () => {
    expect(formatUsdc(100_000_000n)).toBe('100.00');
  });

  it('shows the nonce tail when present', () => {
    expect(formatUsdc(100_000_417n)).toBe('100.000417');
  });

  it('renders sub-dollar amounts', () => {
    expect(formatUsdc(50_000n)).toBe('0.05');
  });

  it('renders zero', () => {
    expect(formatUsdc(0n)).toBe('0.00');
  });
});

describe('parseUsdcInput', () => {
  it('parses a whole number', () => {
    expect(parseUsdcInput('100')).toBe(100_000_000n);
  });

  it('parses cents', () => {
    expect(parseUsdcInput('12.50')).toBe(12_500_000n);
  });

  it('rejects more than six decimal places', () => {
    expect(() => parseUsdcInput('1.0000001')).toThrow();
  });

  it('rejects a non-numeric value', () => {
    expect(() => parseUsdcInput('abc')).toThrow();
  });

  it('rejects zero', () => {
    expect(() => parseUsdcInput('0')).toThrow(/greater than zero/);
  });

  it('rejects an amount that is not a whole number of cents', () => {
    // Mirrors the server-side rule (BLOCKING FIX 1): the sub-cent digits
    // are reserved for the invoice's amount nonce, so an amount that
    // already uses them cannot be accepted here either.
    expect(() => parseUsdcInput('10.0001')).toThrow(/cent/);
  });

  it('accepts an amount that is exactly a whole number of cents', () => {
    expect(parseUsdcInput('10.01')).toBe(10_010_000n);
  });
});

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
