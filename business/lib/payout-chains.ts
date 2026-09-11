/**
 * Mirrors server/src/config/payout-chains.ts. Only the key and label are
 * here — the CCTP domain is a server concern and the browser has no use
 * for it.
 *
 * If the server's table gains a chain, this one has to gain it too; the
 * server rejects anything it does not know, so the failure is a clear
 * 400 rather than a silent mismatch.
 */
export const PAYOUT_CHAINS = [
  { key: 'arc-testnet', label: 'Arc Testnet' },
  { key: 'ethereum-sepolia', label: 'Ethereum Sepolia' },
  { key: 'avalanche-fuji', label: 'Avalanche Fuji' },
  { key: 'op-sepolia', label: 'OP Sepolia' },
  { key: 'arbitrum-sepolia', label: 'Arbitrum Sepolia' },
  { key: 'base-sepolia', label: 'Base Sepolia' },
  { key: 'polygon-amoy', label: 'Polygon Amoy' },
  { key: 'unichain-sepolia', label: 'Unichain Sepolia' },
  { key: 'linea-sepolia', label: 'Linea Sepolia' },
] as const;

export function payoutChainLabel(key: string): string {
  return PAYOUT_CHAINS.find((chain) => chain.key === key)?.label ?? key;
}
