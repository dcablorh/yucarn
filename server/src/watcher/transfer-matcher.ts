export interface ObservedTransfer {
  to: string;
  valueBase: bigint;
  txHash: string;
  blockNumber: bigint;
}

export interface MatchableInvoice {
  id: string;
  recipient: string;
  payableBase: bigint;
}

export interface TransferMatch {
  invoiceId: string;
  txHash: string;
  valueBase: bigint;
}

const key = (recipient: string, amount: bigint): string =>
  `${recipient.toLowerCase()}:${amount.toString()}`;

/**
 * Matches observed USDC transfers to open invoices on exact amount and
 * recipient. Exactness is safe because every open invoice carries a unique
 * sub-cent nonce and the consumer app guarantees exact net delivery.
 *
 * Each invoice is credited at most once per run; the earliest transfer wins.
 *
 * The (recipient, payableBase) key is *expected* to be unique across open
 * invoices — that's the whole point of the nonce — but it is not enforced
 * at the database level (nonce uniqueness does not imply payable
 * uniqueness; see BLOCKING FIX 1). If two open invoices somehow collide on
 * the same key, an incoming transfer is genuinely ambiguous: crediting
 * either one risks marking the wrong invoice PAID for the customer's money.
 * Both are excluded from matching rather than letting the last one in the
 * list silently win — leaving them open is the safe failure.
 */
export function matchTransfers(
  transfers: readonly ObservedTransfer[],
  invoices: readonly MatchableInvoice[],
): TransferMatch[] {
  const byAmount = new Map<string, MatchableInvoice>();
  const ambiguousKeys = new Set<string>();

  for (const invoice of invoices) {
    const k = key(invoice.recipient, invoice.payableBase);
    if (byAmount.has(k)) {
      ambiguousKeys.add(k);
      continue;
    }
    byAmount.set(k, invoice);
  }

  for (const k of ambiguousKeys) {
    byAmount.delete(k);
  }

  const credited = new Set<string>();
  const matches: TransferMatch[] = [];

  for (const transfer of transfers) {
    const invoice = byAmount.get(key(transfer.to, transfer.valueBase));
    if (!invoice || credited.has(invoice.id)) continue;

    credited.add(invoice.id);
    matches.push({
      invoiceId: invoice.id,
      txHash: transfer.txHash,
      valueBase: transfer.valueBase,
    });
  }

  return matches;
}
