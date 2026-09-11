import { USDC_DECIMALS } from './chains';

/**
 * Renders micro-USDC for display. Trailing zeros collapse to two decimals,
 * so a nonce tail like 100.000417 stays visible while 100.000000 reads 100.00.
 */
export function formatUsdc(base: bigint): string {
  const scale = 10n ** BigInt(USDC_DECIMALS);
  const whole = base / scale;
  const fraction = (base % scale).toString().padStart(USDC_DECIMALS, '0');
  const trimmed = fraction.replace(/0+$/, '');
  const decimals = trimmed.length <= 2 ? fraction.slice(0, 2) : fraction;
  return `${whole}.${decimals}`;
}

/** 1 cent in 6-decimal USDC base units. See parseUsdcInput for why it matters. */
const CENT_BASE = 10_000n;

/**
 * Mirrors the server's parseUsdcAmount (server/src/invoices/invoices.service.ts)
 * so the merchant gets an inline error instead of a round-trip to the API.
 *
 * Rejects non-positive amounts and any amount that is not a whole number of
 * cents — the server reserves the sub-cent digits (base units 1..9999) for
 * the invoice's amount nonce (spec §10), so an amount that already uses
 * them would collide with the nonce space.
 */
export function parseUsdcInput(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error('Enter an amount with at most 6 decimal places');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  const base =
    BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) +
    BigInt(fraction.padEnd(USDC_DECIMALS, '0'));

  if (base <= 0n) {
    throw new Error('Enter an amount greater than zero');
  }

  if (base % CENT_BASE !== 0n) {
    throw new Error(
      'Enter an amount with at most 2 decimal places; the sub-cent digits are reserved for the invoice amount nonce',
    );
  }

  return base;
}

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

  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const value = parts.find((part) => part.type === type)?.value ?? '';
    // Trim month abbreviations to 3 characters for consistency across Node versions
    return type === 'month' ? value.slice(0, 3) : value;
  };

  return `${get('day')} ${get('month')} ${get('year')}, ${get('hour')}:${get('minute')} UTC`;
}
