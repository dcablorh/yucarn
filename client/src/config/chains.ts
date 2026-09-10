import { Chain } from '../types';

export const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  // Mainnets
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum One
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum Mainnet
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // OP Mainnet
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Polygon PoS
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', // Avalanche C-Chain
  130: '0x078D782b760474a361dDA0AF3839290b0EF57AD6', // Unichain
  59144: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', // Linea
  146: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894', // Sonic
  480: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1', // World Chain
  57073: '0x2D270e6886d130D724215A266106e6832161EAEd', // Ink
  25: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59', // Cronos
  81224: '0xd996633a415985DBd7D6D12f4A4343E31f5037cf', // Codex
  143: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603', // Monad
  1329: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392', // Sei
  50: '0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1', // XDC
  999: '0xb88339CB7199b77E23DB6E890353E22632Ba630f', // HyperEVM
  98866: '0x222365EF19F7947e5484218551B56bb3965Aa7aF', // Plume
  98865: '0x222365EF19F7947e5484218551B56bb3965Aa7aF', // Plume
  2026: '0x06B6D4249aB84976725287fF66e6B165E0e50fB3', // Edge
  1776: '0xa00C59fF5a080D2b954d0c75e46E22a0c371235a', // Injective
  2818: '0xCfb1186F4e93D60E60a8bDd997427D1F33bc372B', // Morph
  1672: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815', // Pharos
  84886: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815', // Pharos
  9745: '0x2d661C89D812261039AF9764eceaAee884f5F67F', // Plasma
  196: '0xB6CEceAB302E2E4948951eE7843FC24E92933061', // X Layer

  // Testnets
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia
  421614: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia
  11155111: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Sepolia
  11155420: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7', // OP Sepolia
  80002: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582', // Polygon Amoy
  43113: '0x5425890298aed601595a70ab815c96711a31bc65', // Avalanche Fuji
  1301: '0x31d0220469e10c4E71834a79b1f276d740d3768F', // Unichain Sepolia
  59141: '0xfece4462d57bd51a6a552365a011b95f0e16d9b7', // Linea Sepolia
  812242: '0x6d7f141b6819C2c9CC2f818e6ad549E7Ca090F8f', // Codex Testnet
  14601: '0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51', // Sonic Testnet
  64165: '0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51', // Sonic Testnet
  4801: '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88', // World Chain Sepolia
  10143: '0x534b2f3A21130d7a60830c2Df862319e593943A3', // Monad Testnet
  1328: '0x4fCF1784B31630811181f670Aea7A7bEF803eaED', // Sei Testnet
  51: '0xb5AB69F7bBada22B28e79C8FFAECe55eF1c771D4', // XDC Apothem
  998: '0x2B3370eE501B4a559b57D449569354196457D8Ab', // HyperEVM Testnet
  763373: '0xFabab97dCE620294D2B0b0e46C68964e326300Ac', // Ink Testnet
  98867: '0xcB5f30e335672893c7eb944B374c196392C19D18', // Plume Testnet
  161221135: '0xcB5f30e335672893c7eb944B374c196392C19D18', // Plume Testnet
  338: '0x01B11c5E048a1F1237a6bE6d4A9eF3f380F74C65', // Cronos Testnet
  33431: '0x2d9F7CAD728051AA35Ecdc472a14cf8cDF5CFD6B', // Edge Testnet
  202: '0x2d9F7CAD728051AA35Ecdc472a14cf8cDF5CFD6B', // Edge Testnet
  1439: '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d', // Injective Testnet
  2910: '0x7433b41C6c5e1d58D4Da99483609520255ab661B', // Morph Testnet
  2710: '0x7433b41C6c5e1d58D4Da99483609520255ab661B', // Morph Testnet
  688689: '0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B', // Pharos Testnet
  9746: '0xE67Fb267022cBA8064Dd388CC2FED724F3120D9D', // Plasma Testnet
  1952: '0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3', // X Layer Testnet
  5042002: '0x3600000000000000000000000000000000000000', // Arc Testnet
};

export const SUPPORTED_CHAINS: Chain[] = [
  // ==================== POPULAR MAINNETS ====================
  {
    id: 'base',
    name: 'Base',
    subtitle: 'Ethereum Layer 2',
    type: 'evm',
    chainId: 8453,
    icon: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.svg',
    color: '#0052FF',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://basescan.org/',
    isPopular: true
  },
  {
    id: 'sui',
    name: 'Sui',
    subtitle: 'High-speed Layer 1',
    type: 'sui',
    icon: 'https://cryptologos.cc/logos/sui-sui-logo.svg',
    color: '#4DA2FF',
    nativeCurrency: 'SUI',
    explorerUrl: 'https://suiscan.xyz/',
    isPopular: true
  },
  {
    id: 'solana',
    name: 'Solana',
    subtitle: 'High-throughput Layer 1',
    type: 'solana',
    chainId: 501,
    icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg',
    color: '#14F195',
    nativeCurrency: 'SOL',
    explorerUrl: 'https://solscan.io/',
    isPopular: true
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    subtitle: 'Ethereum Layer 2',
    type: 'evm',
    chainId: 42161,
    icon: 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg',
    color: '#28A0F0',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://arbiscan.io/',
    isPopular: true
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    subtitle: 'Mainnet Layer 1',
    type: 'evm',
    chainId: 1,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#627EEA',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://etherscan.io/',
    isPopular: true
  },
  {
    id: 'optimism',
    name: 'OP Mainnet',
    subtitle: 'Ethereum Layer 2',
    type: 'evm',
    chainId: 10,
    icon: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg',
    color: '#FF0420',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://optimistic.etherscan.io/',
    isPopular: true
  },
  {
    id: 'polygon',
    name: 'Polygon PoS',
    subtitle: 'EVM Sidechain',
    type: 'evm',
    chainId: 137,
    icon: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
    color: '#8247E5',
    nativeCurrency: 'POL',
    explorerUrl: 'https://polygonscan.com/',
    isPopular: true
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    subtitle: 'Avalanche C-Chain',
    type: 'evm',
    chainId: 43114,
    icon: 'https://cryptologos.cc/logos/avalanche-avax-logo.svg',
    color: '#E84142',
    nativeCurrency: 'AVAX',
    explorerUrl: 'https://snowtrace.io/',
    isPopular: true
  },
  {
    id: 'unichain',
    name: 'Unichain',
    subtitle: 'Uniswap DeFi L2',
    type: 'evm',
    chainId: 130,
    icon: 'https://raw.githubusercontent.com/Uniswap/brand-assets/main/SVG/Uniswap_Logo_Pink.svg',
    color: '#FF007A',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://uniscan.xyz/',
    isPopular: true
  },
  {
    id: 'sonic',
    name: 'Sonic',
    subtitle: 'Ultra-fast EVM L1',
    type: 'evm',
    chainId: 146,
    icon: 'https://cryptologos.cc/logos/fantom-ftm-logo.svg',
    color: '#1969FF',
    nativeCurrency: 'S',
    explorerUrl: 'https://sonicscan.org/',
    isPopular: true
  },
  {
    id: 'ink',
    name: 'Ink',
    subtitle: 'Kraken Optimistic L2',
    type: 'evm',
    chainId: 57073,
    icon: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.svg',
    color: '#7B2BF9',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://explorer.inkonchain.com/'
  },
  {
    id: 'linea',
    name: 'Linea',
    subtitle: 'ConsenSys zkEVM',
    type: 'evm',
    chainId: 59144,
    icon: 'https://cryptologos.cc/logos/linea-logo.svg',
    color: '#61DFFF',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://lineascan.build/'
  },
  {
    id: 'worldchain',
    name: 'World Chain',
    subtitle: 'Worldcoin Superchain L2',
    type: 'evm',
    chainId: 480,
    icon: 'https://cryptologos.cc/logos/worldcoin-org-wld-logo.svg',
    color: '#000000',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://worldscan.org/'
  },
  {
    id: 'monad',
    name: 'Monad',
    subtitle: 'Parallelized EVM L1',
    type: 'evm',
    chainId: 143,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#836EF9',
    nativeCurrency: 'MON',
    explorerUrl: 'https://monadexplorer.com/'
  },
  {
    id: 'hyperevm',
    name: 'HyperEVM',
    subtitle: 'Hyperliquid EVM L1',
    type: 'evm',
    chainId: 999,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#50D2C2',
    nativeCurrency: 'HYPE',
    explorerUrl: 'https://hyperliquid.cloud/'
  },
  {
    id: 'sei',
    name: 'Sei Network',
    subtitle: 'Parallelized EVM / Cosmos L1',
    type: 'evm',
    chainId: 1329,
    icon: 'https://cryptologos.cc/logos/sei-sei-logo.svg',
    color: '#9B1C2E',
    nativeCurrency: 'SEI',
    explorerUrl: 'https://seitrace.com/'
  },
  {
    id: 'xlayer',
    name: 'X Layer',
    subtitle: 'OKX Polygon CDK zkEVM',
    type: 'evm',
    chainId: 196,
    icon: 'https://cryptologos.cc/logos/okb-okb-logo.svg',
    color: '#000000',
    nativeCurrency: 'OKB',
    explorerUrl: 'https://www.oklink.com/xlayer/'
  },
  {
    id: 'cronos',
    name: 'Cronos',
    subtitle: 'Crypto.com EVM Chain',
    type: 'evm',
    chainId: 25,
    icon: 'https://cryptologos.cc/logos/cronos-cro-logo.svg',
    color: '#002D74',
    nativeCurrency: 'CRO',
    explorerUrl: 'https://cronoscan.com/'
  },
  {
    id: 'injective',
    name: 'Injective',
    subtitle: 'Interoperable DeFi L1',
    type: 'evm',
    chainId: 1776,
    icon: 'https://cryptologos.cc/logos/injective-inj-logo.svg',
    color: '#00F3E7',
    nativeCurrency: 'INJ',
    explorerUrl: 'https://explorer.injective.network/'
  },
  {
    id: 'morph',
    name: 'Morph',
    subtitle: 'Consumer zkEVM Layer 2',
    type: 'evm',
    chainId: 2818,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#34D399',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://explorer.morphl2.io/'
  },
  {
    id: 'plume',
    name: 'Plume',
    subtitle: 'RWA Modular Layer 2',
    type: 'evm',
    chainId: 98865,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#F97316',
    nativeCurrency: 'PLUME',
    explorerUrl: 'https://phoenix-explorer.plumenetwork.xyz/'
  },
  {
    id: 'plasma',
    name: 'Plasma',
    subtitle: 'Scalable EVM Subnet',
    type: 'evm',
    chainId: 9745,
    icon: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
    color: '#A855F7',
    nativeCurrency: 'PLAS',
    explorerUrl: 'https://plasmascan.io/'
  },
  {
    id: 'edgeless',
    name: 'Edge (Edgeless)',
    subtitle: 'Zero-fee DeFi L2',
    type: 'evm',
    chainId: 2026,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#06B6D4',
    nativeCurrency: 'EDG',
    explorerUrl: 'https://explorer.edgeless.network/'
  },
  {
    id: 'codex',
    name: 'Codex',
    subtitle: 'High-throughput EVM Chain',
    type: 'evm',
    chainId: 81224,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#3B82F6',
    nativeCurrency: 'CDX',
    explorerUrl: 'https://scan.codex.xyz/'
  },
  {
    id: 'xdc',
    name: 'XDC Network',
    subtitle: 'Enterprise Hybrid Blockchain',
    type: 'evm',
    chainId: 50,
    icon: 'https://cryptologos.cc/logos/xdc-network-xdc-logo.svg',
    color: '#2157A7',
    nativeCurrency: 'XDC',
    explorerUrl: 'https://xdcscan.io/'
  },

  // ==================== TESTNETS ====================
  {
    id: 'base-sepolia',
    name: 'Base Sepolia',
    subtitle: 'Base Testnet',
    type: 'evm',
    chainId: 84532,
    icon: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.svg',
    color: '#0052FF',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia.basescan.org/',
    isTestnet: true
  },
  {
    id: 'arbitrum-sepolia',
    name: 'Arbitrum Sepolia',
    subtitle: 'Arbitrum Testnet',
    type: 'evm',
    chainId: 421614,
    icon: 'https://cryptologos.cc/logos/arbitrum-arb-logo.svg',
    color: '#28A0F0',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia.arbiscan.io/',
    isTestnet: true
  },
  {
    id: 'sepolia',
    name: 'Sepolia',
    subtitle: 'Ethereum Testnet',
    type: 'evm',
    chainId: 11155111,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#627EEA',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia.etherscan.io/',
    isTestnet: true
  },
  {
    id: 'holesky',
    name: 'Holesky',
    subtitle: 'Ethereum Testnet',
    type: 'evm',
    chainId: 17000,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#627EEA',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://holesky.etherscan.io/',
    isTestnet: true
  },
  {
    id: 'optimism-sepolia',
    name: 'OP Sepolia',
    subtitle: 'Optimism Testnet',
    type: 'evm',
    chainId: 11155420,
    icon: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.svg',
    color: '#FF0420',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia-optimism.etherscan.io/',
    isTestnet: true
  },
  {
    id: 'polygon-amoy',
    name: 'Polygon Amoy',
    subtitle: 'Polygon Testnet',
    type: 'evm',
    chainId: 80002,
    icon: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
    color: '#8247E5',
    nativeCurrency: 'POL',
    explorerUrl: 'https://amoy.polygonscan.com/',
    isTestnet: true
  },
  {
    id: 'avalanche-fuji',
    name: 'Avalanche Fuji',
    subtitle: 'Avalanche Testnet',
    type: 'evm',
    chainId: 43113,
    icon: 'https://cryptologos.cc/logos/avalanche-avax-logo.svg',
    color: '#E84142',
    nativeCurrency: 'AVAX',
    explorerUrl: 'https://testnet.snowtrace.io/',
    isTestnet: true
  },
  {
    id: 'unichain-sepolia',
    name: 'Unichain Sepolia',
    subtitle: 'Unichain Testnet',
    type: 'evm',
    chainId: 1301,
    icon: 'https://raw.githubusercontent.com/Uniswap/brand-assets/main/SVG/Uniswap_Logo_Pink.svg',
    color: '#FF007A',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia.uniscan.xyz/',
    isTestnet: true
  },
  {
    id: 'sonic-testnet',
    name: 'Sonic Testnet',
    subtitle: 'Sonic Testnet',
    type: 'evm',
    chainId: 64165,
    icon: 'https://cryptologos.cc/logos/fantom-ftm-logo.svg',
    color: '#1969FF',
    nativeCurrency: 'S',
    explorerUrl: 'https://testnet.sonicscan.org/',
    isTestnet: true
  },
  {
    id: 'ink-sepolia',
    name: 'Ink Sepolia',
    subtitle: 'Ink Testnet',
    type: 'evm',
    chainId: 763373,
    icon: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.svg',
    color: '#7B2BF9',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://explorer.sepolia.inkonchain.com/',
    isTestnet: true
  },
  {
    id: 'linea-sepolia',
    name: 'Linea Sepolia',
    subtitle: 'Linea Testnet',
    type: 'evm',
    chainId: 59141,
    icon: 'https://cryptologos.cc/logos/linea-logo.svg',
    color: '#61DFFF',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://sepolia.lineascan.build/',
    isTestnet: true
  },
  {
    id: 'monad-testnet',
    name: 'Monad Testnet',
    subtitle: 'Monad Testnet',
    type: 'evm',
    chainId: 10143,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#836EF9',
    nativeCurrency: 'MON',
    explorerUrl: 'https://testnet.monadexplorer.com/',
    isTestnet: true
  },
  {
    id: 'hyperevm-testnet',
    name: 'HyperEVM Testnet',
    subtitle: 'Hyperliquid EVM Testnet',
    type: 'evm',
    chainId: 998,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#50D2C2',
    nativeCurrency: 'HYPE',
    explorerUrl: 'https://testnet.hyperliquid.cloud/',
    isTestnet: true
  },
  {
    id: 'worldchain-sepolia',
    name: 'World Chain Sepolia',
    subtitle: 'World Chain Testnet',
    type: 'evm',
    chainId: 4801,
    icon: 'https://cryptologos.cc/logos/worldcoin-org-wld-logo.svg',
    color: '#000000',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://worldchain-sepolia.explorer.alchemy.com/',
    isTestnet: true
  },
  {
    id: 'xlayer-testnet',
    name: 'X Layer Testnet',
    subtitle: 'X1 Testnet',
    type: 'evm',
    chainId: 1952,
    icon: 'https://cryptologos.cc/logos/okb-okb-logo.svg',
    color: '#000000',
    nativeCurrency: 'OKB',
    explorerUrl: 'https://www.oklink.com/x1-test/',
    isTestnet: true
  },
  {
    id: 'pharos-testnet',
    name: 'Pharos Testnet',
    subtitle: 'Pharos Testnet',
    type: 'evm',
    chainId: 84886,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#6366F1',
    nativeCurrency: 'PHAROS',
    explorerUrl: 'https://testnet-scan.pharosnetwork.com/',
    isTestnet: true
  },
  {
    id: 'sei-testnet',
    name: 'Sei Testnet',
    subtitle: 'Sei Atlantic-2 Testnet',
    type: 'evm',
    chainId: 1328,
    icon: 'https://cryptologos.cc/logos/sei-sei-logo.svg',
    color: '#9B1C2E',
    nativeCurrency: 'SEI',
    explorerUrl: 'https://seitrace.com/?chain=atlantic-2',
    isTestnet: true
  },
  {
    id: 'cronos-testnet',
    name: 'Cronos Testnet',
    subtitle: 'Cronos Testnet',
    type: 'evm',
    chainId: 338,
    icon: 'https://cryptologos.cc/logos/cronos-cro-logo.svg',
    color: '#002D74',
    nativeCurrency: 'CRO',
    explorerUrl: 'https://cronos.org/explorer/testnet3/',
    isTestnet: true
  },
  {
    id: 'injective-testnet',
    name: 'Injective Testnet',
    subtitle: 'Injective Testnet',
    type: 'evm',
    chainId: 1439,
    icon: 'https://cryptologos.cc/logos/injective-inj-logo.svg',
    color: '#00F3E7',
    nativeCurrency: 'INJ',
    explorerUrl: 'https://testnet.explorer.injective.network/',
    isTestnet: true
  },
  {
    id: 'morph-sepolia',
    name: 'Morph Sepolia',
    subtitle: 'Morph Testnet',
    type: 'evm',
    chainId: 2710,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#34D399',
    nativeCurrency: 'ETH',
    explorerUrl: 'https://explorer-holesky.morphl2.io/',
    isTestnet: true
  },
  {
    id: 'plume-testnet',
    name: 'Plume Testnet',
    subtitle: 'Plume Testnet',
    type: 'evm',
    chainId: 161221135,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#F97316',
    nativeCurrency: 'PLUME',
    explorerUrl: 'https://plume-testnet.explorer.caldera.xyz/',
    isTestnet: true
  },
  {
    id: 'plasma-testnet',
    name: 'Plasma Testnet',
    subtitle: 'Plasma Testnet',
    type: 'evm',
    chainId: 9746,
    icon: 'https://cryptologos.cc/logos/polygon-matic-logo.svg',
    color: '#A855F7',
    nativeCurrency: 'PLAS',
    explorerUrl: 'https://testnet.plasmascan.io/',
    isTestnet: true
  },
  {
    id: 'edgeless-testnet',
    name: 'Edgeless Testnet',
    subtitle: 'Edge Testnet',
    type: 'evm',
    chainId: 202,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#06B6D4',
    nativeCurrency: 'EDG',
    explorerUrl: 'https://testnet.explorer.edgeless.network/',
    isTestnet: true
  },
  {
    id: 'codex-testnet',
    name: 'Codex Testnet',
    subtitle: 'Codex Testnet',
    type: 'evm',
    chainId: 812242,
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg',
    color: '#3B82F6',
    nativeCurrency: 'CDX',
    explorerUrl: 'https://testnet-scan.codex.xyz/',
    isTestnet: true
  },
  {
    id: 'xdc-testnet',
    name: 'XDC Apothem',
    subtitle: 'XDC Testnet',
    type: 'evm',
    chainId: 51,
    icon: 'https://cryptologos.cc/logos/xdc-network-xdc-logo.svg',
    color: '#2157A7',
    nativeCurrency: 'XDC',
    explorerUrl: 'https://apothem.xdcscan.io/',
    isTestnet: true
  },
  {
    id: 'solana-devnet',
    name: 'Solana Devnet',
    subtitle: 'Solana Testnet',
    type: 'solana',
    chainId: 502,
    icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg',
    color: '#14F195',
    nativeCurrency: 'SOL',
    explorerUrl: 'https://solscan.io?cluster=devnet',
    isTestnet: true
  },
  {
    id: 'arc-testnet',
    name: 'Arc Testnet',
    subtitle: 'Arc Blockchain Testnet',
    type: 'evm',
    chainId: 5042002,
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg',
    color: '#2775CA',
    nativeCurrency: 'USDC',
    explorerUrl: 'https://testnet.arcscan.app',
    isTestnet: true
  }
];

export const DEFAULT_MAINNET_SOURCE = SUPPORTED_CHAINS.find(c => c.id === 'base') || SUPPORTED_CHAINS[0];
export const DEFAULT_MAINNET_DEST = SUPPORTED_CHAINS.find(c => c.id === 'base') || SUPPORTED_CHAINS[0];
export const DEFAULT_TESTNET_SOURCE = SUPPORTED_CHAINS.find(c => c.id === 'base-sepolia') || SUPPORTED_CHAINS.find(c => c.isTestnet)!;
export const DEFAULT_TESTNET_DEST = SUPPORTED_CHAINS.find(c => c.id === 'base-sepolia') || SUPPORTED_CHAINS.find(c => c.isTestnet)!;

export const DEFAULT_SOURCE_CHAIN = DEFAULT_TESTNET_SOURCE;
export const DEFAULT_DEST_CHAIN = DEFAULT_TESTNET_DEST;

/**
 * Validates whether a transaction hash/signature is legitimate and not a placeholder
 */
export function isValidTxHash(txHash?: string | null): boolean {
  if (!txHash || typeof txHash !== 'string') return false;
  const trimmed = txHash.trim();
  if (trimmed.length < 32) return false;
  if (
    trimmed.startsWith('solana-') ||
    trimmed.startsWith('exec_') ||
    trimmed.toLowerCase().includes('mock') ||
    trimmed === '0x0000000000000000000000000000000000000000000000000000000000000000'
  ) {
    return false;
  }
  // EVM standard hash (0x + 64 hex chars)
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return true;
  // 64-char hex string without 0x prefix
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return true;
  // Base-58 string for Solana & Sui transaction signatures (40-90 chars)
  if (/^[1-9A-HJ-NP-za-km-z]{40,90}$/.test(trimmed)) return true;
  return false;
}

/**
 * Safely constructs a block explorer transaction URL without double slashes
 */
export function getExplorerTxUrl(chain?: { explorerUrl?: string }, txHash?: string): string {
  if (!chain?.explorerUrl || !isValidTxHash(txHash)) return '';
  const trimmed = txHash!.trim();
  const cleanBase = chain.explorerUrl.replace(/\/+$/, '');
  if (cleanBase.includes('?')) {
    const [base, query] = cleanBase.split('?');
    return `${base}/tx/${trimmed}?${query}`;
  }
  return `${cleanBase}/tx/${trimmed}`;
}

/**
 * Safely constructs a block explorer address URL without double slashes
 */
export function getExplorerAddressUrl(chain?: { explorerUrl?: string }, address?: string): string {
  if (!chain?.explorerUrl || !address) return '';
  const cleanBase = chain.explorerUrl.replace(/\/+$/, '');
  if (cleanBase.includes('?')) {
    const [base, query] = cleanBase.split('?');
    return `${base}/address/${address}?${query}`;
  }
  return `${cleanBase}/address/${address}`;
}

