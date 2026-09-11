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
