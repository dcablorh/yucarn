export interface HumanError {
  /** What the merchant reads. Always present, always a full sentence. */
  message: string;
  /** The original text, kept so support can be given something exact. */
  detail?: string;
}

/**
 * Two GENERIC variants, neither of which claims fault it cannot know:
 * an unclassified failure might be ours, the merchant's, or the chain's,
 * so the copy only ever promises that nothing was lost.
 */
const GENERIC_WITH_DETAIL =
  'Something went wrong. Nothing was lost — the exact message is in the details below.';
const GENERIC_NO_DETAIL = 'Something went wrong. Nothing was lost — try again in a moment.';

/**
 * Known technical failures, in the words a merchant would use.
 *
 * The timeout entry is the one that matters most: a merchant who retries
 * a transfer that is already confirming can pay twice, so that message
 * points at the receipt instead of at the button. But `humanizeError`
 * cannot tell a payment timeout from one that happened while just
 * loading a list, so the sentence has to stay true for both — it hedges
 * with "if you were sending a payment" rather than asserting a transfer
 * is in flight when there may be none.
 */
const KNOWN: Array<{ match: RegExp; message: string }> = [
  {
    match: /failed to fetch|networkerror|load failed|err_network|fetch failed/i,
    message: "We couldn't reach Yucarn. Check your connection and try again.",
  },
  {
    match: /user rejected|user denied|action_rejected|\b4001\b/i,
    message: 'You cancelled the request in your wallet. Nothing was sent.',
  },
  {
    match: /timed? out|timeout|deadline exceeded/i,
    message:
      'That took too long to confirm. If you were sending a payment, it may already be on its way — check the receipt on Arc before sending again.',
  },
  {
    match: /chain mismatch|unsupported chain|wrong network|switch chain|does not match the target chain/i,
    message: 'Your wallet is on the wrong network. Approve the switch to Arc, then try again.',
  },
  {
    match: /insufficient funds|insufficient balance|exceeds the balance/i,
    message: "This wallet doesn't hold enough to cover the transfer and its gas.",
  },
  {
    match: /nonce too low|replacement transaction underpriced|already known/i,
    message:
      'An earlier transaction from this wallet is still settling. Wait for it to confirm, then try again.',
  },
  {
    match: /\b401\b|unauthorized|not authenticated/i,
    message: 'Your session has expired. Sign in again.',
  },
  {
    match: /\b(429|rate limit)\b/i,
    message: 'Too many requests at once. Wait a few seconds and try again.',
  },
];

/**
 * JS runtime-crash phrasing: the language's own error text, not
 * something written for a reader. These pass every other check here —
 * capitalised, single line, period-terminated — so they need their own
 * rejection. Being routed to GENERIC instead is cheap: Alert shows the
 * real text behind its disclosure either way, so when in doubt this
 * stays strict rather than risk a raw crash reaching the merchant as
 * the primary message.
 */
const RUNTIME_CRASH =
  /cannot read propert|is not a function|is not defined|is not iterable|undefined is not|null is not|unexpected token|maximum call stack|internal server error/i;

/** Hex blobs, stack frames, enum shouting and JS crash text are not sentences. */
function readsAsSentence(text: string): boolean {
  if (text.length < 8 || text.length > 300) return false;
  if (/0x[0-9a-f]{8,}/i.test(text)) return false;
  if (/\n|\bat \w+ \(|Error:|_[A-Z]{2,}|[{}<>]/.test(text)) return false;
  if (/^[A-Z0-9_]+$/.test(text)) return false;
  if (RUNTIME_CRASH.test(text)) return false;
  return /^[A-Z]/.test(text) && /[.!?]$/.test(text);
}

/** Narrows to viem's `BaseError`-shaped objects without reaching for `any`. */
function hasShortMessage(value: unknown): value is { shortMessage: string } {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = (value as { shortMessage?: unknown }).shortMessage;
  return typeof candidate === 'string' && candidate.length > 0;
}

/**
 * viem's `BaseError` (and everything it throws — chain mismatches,
 * insufficient funds, reverts) sets a public `shortMessage`: one clean
 * sentence, ahead of the multi-line `.message` that stacks it with
 * metaMessages, a Details: line and a Version: line. Preferring it here
 * is what makes those errors classifiable and readable at all.
 */
function rawText(raw: unknown): string {
  if (hasShortMessage(raw)) return raw.shortMessage;
  if (raw instanceof Error) return raw.message;
  if (typeof raw === 'string') return raw;
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
  if (!text) return { message: GENERIC_NO_DETAIL };

  for (const { match, message } of KNOWN) {
    if (match.test(text)) return { message, detail: text };
  }

  if (readsAsSentence(text)) return { message: text };

  return { message: GENERIC_WITH_DETAIL, detail: text };
}
