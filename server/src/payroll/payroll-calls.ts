import { encodeFunctionData, type Address, type Hex } from 'viem';
import { ARC_CHAIN_ID, ARC_CHAIN_KEY, ARC_USDC_ADDRESS } from '../config/chains';

/** What the browser is handed. The server builds these; it never signs them. */
export interface UnsignedCall {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

export class UnsupportedRouteError extends Error {
  constructor(destChain: string) {
    super(
      `Yucarn cannot pay out on ${destChain} yet — only ${ARC_CHAIN_KEY} is supported`,
    );
    this.name = 'UnsupportedRouteError';
  }
}

const ERC20_ABI = [
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
] as const;

export interface RoutableItem {
  walletAddress: string;
  amountBase: bigint;
  destChain: string;
}

/**
 * One unsigned USDC transfer per item.
 *
 * §5.2's cross-chain branch — one approve for the batch plus a
 * depositForBurn per item — is not built here. When it is, it slots in as
 * a second branch on destChain; nothing above this function has to change,
 * because destChain already travels on every item.
 *
 * Note the call goes to the USDC contract, not to the employee. Sending to
 * the employee would move Arc's native gas asset instead of the token.
 */
export function buildPayrollCalls(items: RoutableItem[]): UnsignedCall[] {
  return items.map((item) => {
    if (item.destChain !== ARC_CHAIN_KEY) {
      throw new UnsupportedRouteError(item.destChain);
    }
    if (item.amountBase <= 0n) {
      throw new Error('Every payment must be greater than zero');
    }

    const data: Hex = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [item.walletAddress as Address, item.amountBase],
    });

    return { to: ARC_USDC_ADDRESS, data, value: '0', chainId: ARC_CHAIN_ID };
  });
}
