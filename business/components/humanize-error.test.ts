import { describe, expect, it } from 'vitest';
import { humanizeError } from './humanize-error';

describe('humanizeError', () => {
  it('explains an unreachable API without blaming the merchant', () => {
    const { message } = humanizeError(new TypeError('Failed to fetch'));
    expect(message).toContain("couldn't reach");
    expect(message).not.toContain('fetch');
  });

  it('treats a cancelled wallet prompt as a choice, not a failure', () => {
    const { message } = humanizeError(new Error('User rejected the request'));
    expect(message).toContain('cancelled');
  });

  it('says what a timeout means for money that may already be moving', () => {
    // The critical case: a merchant must not retry a transfer that is
    // already on its way.
    const { message } = humanizeError(new Error('Timed out waiting for receipt'));
    expect(message).toContain('may already');
  });

  it('names the wrong-network case with the action that fixes it', () => {
    const { message } = humanizeError(new Error('Chain mismatch: expected Arc'));
    expect(message).toContain('Arc');
  });

  it('explains insufficient funds as covering the transfer and its gas', () => {
    const { message } = humanizeError(new Error('insufficient funds for gas'));
    expect(message).toContain('gas');
  });

  it('passes a server sentence through, because it was written for a human', () => {
    const raw = 'That amount is above the invoice limit.';
    expect(humanizeError(new Error(raw)).message).toBe(raw);
  });

  it('hides a hex dump behind a generic sentence but keeps it as detail', () => {
    const raw = 'execution reverted 0x08c379a0000000000000000000000000';
    const { message, detail } = humanizeError(new Error(raw));
    expect(message).not.toContain('0x08c379a0');
    expect(detail).toBe(raw);
  });

  it('survives being handed something that is not an Error', () => {
    expect(humanizeError(undefined).message.length).toBeGreaterThan(0);
    expect(humanizeError({ nope: true }).message.length).toBeGreaterThan(0);
  });

  it('never returns an empty message', () => {
    for (const input of ['', '   ', null, 0, new Error('')]) {
      expect(humanizeError(input).message.trim().length).toBeGreaterThan(0);
    }
  });

  // The four cases below reproduce real viem SDK error shapes verified
  // against node_modules/viem's source (errors/chain.ts, errors/node.ts,
  // errors/base.ts). BaseError composes a multi-line `.message` from
  // `shortMessage` + metaMessages + a Version line, joined by `\n` — these
  // fixtures mirror that composition so the tests would have caught the
  // original dead KNOWN branches and the multi-line rejection.

  it('recognises a real ChainMismatchError and names Arc and the switch', () => {
    const shortMessage =
      'The current chain of the wallet (id: 1) does not match the target chain for the transaction (id: 100 – Arc).';
    const raw = {
      shortMessage,
      message: [
        shortMessage,
        '',
        'Current Chain ID:  1',
        'Expected Chain ID: 100 – Arc',
        '',
        'Version: viem@2.56.0',
      ].join('\n'),
    };
    const { message } = humanizeError(raw);
    expect(message).toContain('Arc');
    expect(message).toContain('switch');
  });

  it('recognises a real InsufficientFundsError and mentions gas', () => {
    const shortMessage =
      'The total cost (gas * gas fee + value) of executing this transaction exceeds the balance of the account.';
    const raw = {
      shortMessage,
      message: [
        shortMessage,
        '',
        'This error could arise when the account does not have enough funds to:',
        ' - pay for the total gas fee,',
        ' - pay for the value to send.',
        ' ',
        'The cost of the transaction is calculated as `gas * gas fee + value`, where:',
        ' - `gas` is the amount of gas needed for transaction to execute,',
        ' - `gas fee` is the gas fee,',
        ' - `value` is the amount of ether to send to the recipient.',
        '',
        'Version: viem@2.56.0',
      ].join('\n'),
    };
    const { message } = humanizeError(raw);
    expect(message).toContain('gas');
  });

  it('never shows a raw JS runtime-crash message as the primary text', () => {
    const raw = new Error("Cannot read properties of undefined (reading 'amount').");
    const { message, detail } = humanizeError(raw);
    expect(message).not.toBe(raw.message);
    expect(detail).toBe(raw.message);
  });

  it('prefers shortMessage over a multi-line message when both exist', () => {
    // Modeled on viem BaseError's composition (shortMessage + metaMessages
    // + a Version line joined by \n): a single-line shortMessage that
    // reads as a sentence, next to a multi-line .message that would be
    // rejected by the newline check if it were used instead.
    const shortMessage = 'That amount is not currently supported.';
    const raw = {
      shortMessage,
      message: [
        shortMessage,
        '',
        'This could be due to the following:',
        '- Unsupported currency for this invoice.',
        '',
        'Version: viem@2.56.0',
      ].join('\n'),
    };
    const { message } = humanizeError(raw);
    expect(message).toBe(shortMessage);
  });

  it('never lets a GENERIC message claim the fault is on our side', () => {
    const inputs: unknown[] = [
      '',
      new Error(''),
      new Error("Cannot read properties of undefined (reading 'amount')."),
      { nope: true },
    ];
    for (const input of inputs) {
      expect(humanizeError(input).message).not.toContain('our side');
    }
  });
});
