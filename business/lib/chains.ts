import { arcTestnet } from 'viem/chains';

export { arcTestnet };

export const ARC_CHAIN_KEY = 'arc-testnet';
export const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';
/** Arc's USDC ERC-20 view (6 decimals). Native gas is the same funds at 18. */
export const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;
export const USDC_DECIMALS = 6;
