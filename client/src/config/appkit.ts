import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import {
  // Arbitrum
  arbitrum,
  arbitrumSepolia,
  // Avalanche
  avalanche,
  avalancheFuji,
  // Base
  base,
  baseSepolia,
  // Codex
  codex,
  codexTestnet,
  // Cronos
  cronos,
  cronosTestnet,
  // Edge / Edgeless
  edgeless,
  edgelessTestnet,
  // Ethereum
  mainnet,
  sepolia,
  holesky,
  // HyperEVM
  hyperliquid,
  hyperliquidEvmTestnet,
  // Injective
  injective,
  injectiveTestnet,
  // Ink
  ink,
  inkSepolia,
  // Linea
  linea,
  lineaSepolia,
  // Monad
  monad,
  monadTestnet,
  // Morph
  morph,
  morphSepolia,
  // OP Mainnet
  optimism,
  optimismSepolia,
  // Plasma
  plasma,
  plasmaTestnet,
  // Plume
  plume,
  plumeTestnet,
  // Polygon PoS
  polygon,
  polygonAmoy,
  // Sei
  sei,
  seiTestnet,
  // Sonic
  sonic,
  sonicTestnet,
  // Unichain
  unichain,
  unichainSepolia,
  // World Chain
  worldchain,
  worldchainSepolia,
  // XDC
  xdc,
  xdcTestnet,
  // X Layer
  xLayer,
  xLayerTestnet,
  defineChain
} from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { QueryClient } from '@tanstack/react-query';

// Pharos Testnet definition
export const pharosTestnet: AppKitNetwork = defineChain({
  id: 84886,
  name: 'Pharos Testnet',
  nativeCurrency: { name: 'Pharos', symbol: 'PHAROS', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.pharosnetwork.com'] } },
  blockExplorers: { default: { name: 'PharosScan', url: 'https://testnet-scan.pharosnetwork.com' } }
} as any);

// Arc Testnet definition
export const arcTestnet: AppKitNetwork = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } },
  blockExplorers: { default: { name: 'ArcScan', url: 'https://testnet.arcscan.app' } }
} as any);

import { SolanaAdapter } from '@reown/appkit-adapter-solana/react';
import { BitcoinAdapter } from '@reown/appkit-adapter-bitcoin';
import {
  solana,
  solanaDevnet,
  solanaTestnet,
  bitcoin,
  bitcoinTestnet
} from '@reown/appkit/networks';

// Solana & Bitcoin Adapters
export const solanaWeb3JsAdapter = new SolanaAdapter();
export const bitcoinAdapter = new BitcoinAdapter();

// Reown Project ID from dashboard.reown.com (or fallback test ID)
export const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || import.meta.env.VITE_PROJECT_ID || 'b56e18d47c72ab683b10814fe9495694';

// All Supported Networks (EVM, Solana, Bitcoin, Mainnets & Testnets)
export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  // EVM Primary Mainnets
  base,
  arbitrum,
  mainnet,
  optimism,
  polygon,
  avalanche,
  linea,
  unichain,
  sonic,
  ink,
  worldchain,
  xLayer,
  sei,
  cronos,
  injective,
  hyperliquid,
  monad,
  morph,
  plume,
  plasma,
  edgeless,
  codex,
  xdc,

  // EVM Testnets
  baseSepolia,
  arbitrumSepolia,
  sepolia,
  holesky,
  optimismSepolia,
  polygonAmoy,
  avalancheFuji,
  lineaSepolia,
  unichainSepolia,
  sonicTestnet,
  inkSepolia,
  worldchainSepolia,
  xLayerTestnet,
  seiTestnet,
  cronosTestnet,
  injectiveTestnet,
  hyperliquidEvmTestnet,
  monadTestnet,
  morphSepolia,
  plumeTestnet,
  plasmaTestnet,
  edgelessTestnet,
  codexTestnet,
  xdcTestnet,
  pharosTestnet,
  arcTestnet,

  // Non-EVM Multichain
  solana,
  solanaDevnet,
  solanaTestnet,
  bitcoin,
  bitcoinTestnet
];

// AppKit Metadata
export const metadata = {
  name: 'Yucarn Protocol',
  description: 'Universal Cross-Chain Payments for Every Chain',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://yucarn.xyz',
  icons: ['https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.svg']
};

// Wagmi Adapter for Reown
export const wagmiAdapter = new WagmiAdapter({
  networks: networks as any,
  projectId,
  ssr: false
});

// React Query Client with optimized fast caching
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
      gcTime: 300000,
      retry: 1
    }
  }
});

// Initialize Reown AppKit at module level with Multichain Adapters
export const modal = createAppKit({
  adapters: [wagmiAdapter, solanaWeb3JsAdapter, bitcoinAdapter],
  networks: networks as any,
  projectId,
  metadata,
  allWallets: 'SHOW',
  enableInjected: true,
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#C5F82A',
    '--w3m-border-radius-master': '20px',
    '--w3m-font-family': 'Inter, system-ui, sans-serif'
  },
  features: {
    analytics: false,
    email: false,
    socials: [],
    emailShowWallets: false
  }
});

// Helper to look up AppKit Network by chain ID
export function getAppKitNetwork(chainId: number): AppKitNetwork | undefined {
  return (networks as AppKitNetwork[]).find((n) => Number(n.id) === Number(chainId));
}

