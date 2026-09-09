/**
 * Where payroll can send USDC.
 *
 * Testnets only and EVM only, per spec §5.6: funding is Arc testnet, so
 * every destination must be a testnet too. A CCTP testnet reuses its
 * mainnet domain id, which is why these numbers look like mainnet's.
 *
 * Arc's domain 26 agrees with ARC_CCTP_DOMAIN in ./chains.ts — that
 * agreement is the check that this table is keyed the same way the
 * settlement path already is.
 *
 * NOTHING IN THIS PLAN USES `domain`. Payroll does, and payroll must
 * verify every one of these against the destination's MessageTransmitter
 * `localDomain()` before its first burn. A wrong domain mints on the
 * wrong chain, silently.
 */
export interface PayoutChain {
  key: string;
  label: string;
  domain: number;
  chainId: number;
}

export const PAYOUT_CHAINS: readonly PayoutChain[] = [
  { key: 'arc-testnet', label: 'Arc Testnet', domain: 26, chainId: 5042002 },
  { key: 'ethereum-sepolia', label: 'Ethereum Sepolia', domain: 0, chainId: 11155111 },
  { key: 'avalanche-fuji', label: 'Avalanche Fuji', domain: 1, chainId: 43113 },
  { key: 'op-sepolia', label: 'OP Sepolia', domain: 2, chainId: 11155420 },
  { key: 'arbitrum-sepolia', label: 'Arbitrum Sepolia', domain: 3, chainId: 421614 },
  { key: 'base-sepolia', label: 'Base Sepolia', domain: 6, chainId: 84532 },
  { key: 'polygon-amoy', label: 'Polygon Amoy', domain: 7, chainId: 80002 },
  { key: 'unichain-sepolia', label: 'Unichain Sepolia', domain: 10, chainId: 1301 },
  { key: 'linea-sepolia', label: 'Linea Sepolia', domain: 11, chainId: 59141 },
] as const;

/** The only asset UniPay moves. */
export const SUPPORTED_ASSETS = ['USDC'] as const;

export function payoutChain(key: string): PayoutChain | undefined {
  return PAYOUT_CHAINS.find((chain) => chain.key === key);
}

export function isPayoutChain(key: string): boolean {
  return payoutChain(key) !== undefined;
}
