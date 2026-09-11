import { encodeFunctionData, type Address, type Hex } from 'viem';
import { ARC_USDC_ADDRESS } from './chains';
import type { InvoiceStatus } from './api';

/**
 * The only two USDC functions the payment page needs. Written out rather
 * than pulled from a package so the ABI travels with the code that uses it.
 */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

/**
 * Calldata for an exact-amount USDC transfer to the invoice's recipient.
 *
 * The amount must be payableBase, never amountBase: the sub-cent tail is the
 * invoice's amount nonce, and it is the only thing that tells the Arc watcher
 * which invoice an incoming transfer belongs to. Rounding it away produces a
 * transfer that matches nothing and credits no one.
 */
export function encodeUsdcTransfer(recipient: Address, payableBase: bigint): Hex {
  if (payableBase <= 0n) {
    throw new Error('Payment amount must be greater than zero');
  }
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [recipient, payableBase],
  });
}

/** Where an exact-amount transfer has to be sent for this invoice. */
export function buildPaymentTransaction(recipient: Address, payableBase: bigint) {
  return { to: ARC_USDC_ADDRESS as Address, data: encodeUsdcTransfer(recipient, payableBase) };
}

/**
 * Whether the pay button should be live.
 *
 * PROCESSING is payable on purpose: it means someone reported a transfer that
 * has not settled yet, and a report is advisory — the server never treats it
 * as proof. UNDERPAID is payable because the server still allows
 * UNDERPAID -> PAID, so a customer who sent too little can top it up.
 */
export function isPayable(status: InvoiceStatus | string): boolean {
  return status === 'PENDING' || status === 'PROCESSING' || status === 'UNDERPAID';
}
