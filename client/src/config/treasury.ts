/**
 * UniPay Protocol Treasury Configuration
 * Canonical Treasury Chain: Base (EVM)
 * Fee Split: 90% UniPay Treasury, 10% Circle Protocol
 */

export const DEFAULT_TREASURY_CONFIG = {
  mainnet: ((import.meta.env.VITE_YUCARN_TREASURY_ADDRESS || import.meta.env.VITE_UNIPAY_TREASURY_ADDRESS) as `0x${string}`) || '0x127c1A164b00639FAA338E38F3150b12D313420A',
  testnet: ((import.meta.env.VITE_YUCARN_TESTNET_TREASURY_ADDRESS || import.meta.env.VITE_UNIPAY_TESTNET_TREASURY_ADDRESS) as `0x${string}`) || '0x127c1A164b00639FAA338E38F3150b12D313420A'
};

export function getTreasuryAddress(isTestnet: boolean = false): `0x${string}` {
  const saved = typeof window !== 'undefined' ? localStorage.getItem(isTestnet ? 'unipay_testnet_treasury' : 'unipay_treasury') : null;
  if (saved && saved.startsWith('0x') && saved.length === 42) {
    return saved as `0x${string}`;
  }
  return isTestnet ? DEFAULT_TREASURY_CONFIG.testnet : DEFAULT_TREASURY_CONFIG.mainnet;
}

export function setTreasuryAddress(address: string, isTestnet: boolean = false): void {
  if (typeof window !== 'undefined' && address.startsWith('0x') && address.length === 42) {
    localStorage.setItem(isTestnet ? 'unipay_testnet_treasury' : 'unipay_treasury', address);
  }
}
