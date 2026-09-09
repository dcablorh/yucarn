import { matchTransfers } from './transfer-matcher';

const invoice = (id: string, payableBase: bigint, recipient = '0xmerchant') => ({
  id,
  recipient,
  payableBase,
});

const transfer = (to: string, valueBase: bigint, txHash = '0xtx') => ({
  to,
  valueBase,
  txHash,
  blockNumber: 1n,
});

describe('matchTransfers', () => {
  it('matches an exact amount to the right invoice', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_000_417n)],
      [invoice('inv_a', 100_000_417n), invoice('inv_b', 100_000_918n)],
    );
    expect(matches).toEqual([
      { invoiceId: 'inv_a', txHash: '0xtx', valueBase: 100_000_417n },
    ]);
  });

  it('distinguishes same-amount invoices by their nonce', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_000_918n)],
      [invoice('inv_a', 100_000_417n), invoice('inv_b', 100_000_918n)],
    );
    expect(matches.map((m) => m.invoiceId)).toEqual(['inv_b']);
  });

  it('ignores a transfer to a different recipient', () => {
    expect(
      matchTransfers(
        [transfer('0xsomeone_else', 100_000_417n)],
        [invoice('inv_a', 100_000_417n)],
      ),
    ).toEqual([]);
  });

  it('compares recipients case-insensitively', () => {
    const matches = matchTransfers(
      [transfer('0xMERCHANT', 100_000_417n)],
      [invoice('inv_a', 100_000_417n, '0xmerchant')],
    );
    expect(matches).toHaveLength(1);
  });

  it('ignores an amount that does not match any invoice', () => {
    expect(
      matchTransfers([transfer('0xmerchant', 99_000_000n)], [invoice('inv_a', 100_000_417n)]),
    ).toEqual([]);
  });

  it('never credits one invoice twice within a run', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_000_417n, '0xtx1'), transfer('0xmerchant', 100_000_417n, '0xtx2')],
      [invoice('inv_a', 100_000_417n)],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].txHash).toBe('0xtx1');
  });

  it('matches several invoices in one batch', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_000_417n, '0xtx1'), transfer('0xmerchant', 50_000_918n, '0xtx2')],
      [invoice('inv_a', 100_000_417n), invoice('inv_b', 50_000_918n)],
    );
    expect(matches.map((m) => m.invoiceId).sort()).toEqual(['inv_a', 'inv_b']);
  });

  it('returns nothing when there are no open invoices', () => {
    expect(matchTransfers([transfer('0xmerchant', 100_000_417n)], [])).toEqual([]);
  });

  it('credits neither invoice when two open invoices share a payable amount', () => {
    // Nonce uniqueness does not imply payable uniqueness (BLOCKING FIX 1):
    // e.g. "10.00" + nonce 1500 and "10.001" + nonce 500 both land on
    // 10.001500. An incoming transfer for that amount is genuinely
    // ambiguous, so neither invoice may be credited — an arbitrary winner
    // would mean crediting one merchant's invoice with another's payment.
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_001_500n)],
      [invoice('inv_a', 100_001_500n), invoice('inv_b', 100_001_500n)],
    );
    expect(matches).toEqual([]);
  });

  it('still matches an unrelated invoice when a different pair collides', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 50_000_000n, '0xtx_ok')],
      [
        invoice('inv_a', 100_001_500n),
        invoice('inv_b', 100_001_500n),
        invoice('inv_c', 50_000_000n),
      ],
    );
    expect(matches).toEqual([
      { invoiceId: 'inv_c', txHash: '0xtx_ok', valueBase: 50_000_000n },
    ]);
  });
});
