import { PublicKey } from '@solana/web3.js';

export interface CCTPChainConfig {
  domain: number;
  tokenMessenger: `0x${string}`;
  tokenMessengerV2?: `0x${string}`;
  messageTransmitter: `0x${string}`;
  usdcAddress: `0x${string}`;
  isTestnet: boolean;
  bridgeChainName: string;
}

/**
 * Official Circle CCTP Domains & Contracts for Mainnets & Testnets
 * Extracted directly from Circle CCTPv2 Protocol Registry
 */
export const CCTP_CONFIGS: Record<number, CCTPChainConfig> = {
  // ===================== MAINNETS =====================
  // Ethereum Mainnet (Domain 0)
  1: {
    domain: 0,
    tokenMessenger: '0xbd3fa81b58ba92a82136038b25adec7066af3155',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    isTestnet: false,
    bridgeChainName: 'Ethereum'
  },
  // Avalanche C-Chain (Domain 1)
  43114: {
    domain: 1,
    tokenMessenger: '0x6b25532e1060ce10cc3b0a99e5683b91bfde6982',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    isTestnet: false,
    bridgeChainName: 'Avalanche'
  },
  // OP Mainnet (Domain 2)
  10: {
    domain: 2,
    tokenMessenger: '0x2b4069517957735be00cee0fadba24e1336f2421',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    isTestnet: false,
    bridgeChainName: 'Optimism'
  },
  // Arbitrum One (Domain 3)
  42161: {
    domain: 3,
    tokenMessenger: '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    isTestnet: false,
    bridgeChainName: 'Arbitrum'
  },
  // Base (Domain 6)
  8453: {
    domain: 6,
    tokenMessenger: '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    isTestnet: false,
    bridgeChainName: 'Base'
  },
  // Polygon PoS (Domain 7)
  137: {
    domain: 7,
    tokenMessenger: '0x9dae0c8d1ed7333b9565e12b45c8f3cd950b26f1',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    isTestnet: false,
    bridgeChainName: 'Polygon'
  },
  // Unichain (Domain 10)
  130: {
    domain: 10,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x078D782b760474a361dDA0AF3839290b0EF57AD6',
    isTestnet: false,
    bridgeChainName: 'Unichain'
  },
  // Linea (Domain 11)
  59144: {
    domain: 11,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff',
    isTestnet: false,
    bridgeChainName: 'Linea'
  },
  // Codex (Domain 12)
  81224: {
    domain: 12,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xd996633a415985DBd7D6D12f4A4343E31f5037cf',
    isTestnet: false,
    bridgeChainName: 'Codex'
  },
  // Sonic (Domain 13)
  146: {
    domain: 13,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x29219dd400f2Bf60E5a23d13Be72B486D4038894',
    isTestnet: false,
    bridgeChainName: 'Sonic'
  },
  // World Chain (Domain 14)
  480: {
    domain: 14,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1',
    isTestnet: false,
    bridgeChainName: 'World_Chain'
  },
  // Monad (Domain 15)
  143: {
    domain: 15,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    isTestnet: false,
    bridgeChainName: 'Monad'
  },
  // Sei (Domain 16)
  1329: {
    domain: 16,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392',
    isTestnet: false,
    bridgeChainName: 'Sei'
  },
  // XDC (Domain 18)
  50: {
    domain: 18,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1',
    isTestnet: false,
    bridgeChainName: 'XDC'
  },
  // HyperEVM (Domain 19)
  999: {
    domain: 19,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xb88339CB7199b77E23DB6E890353E22632Ba630f',
    isTestnet: false,
    bridgeChainName: 'HyperEVM'
  },
  // Ink (Domain 21)
  57073: {
    domain: 21,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x2D270e6886d130D724215A266106e6832161EAEd',
    isTestnet: false,
    bridgeChainName: 'Ink'
  },
  // Plume (Domain 22)
  98866: {
    domain: 22,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x222365EF19F7947e5484218551B56bb3965Aa7aF',
    isTestnet: false,
    bridgeChainName: 'Plume'
  },
  98865: {
    domain: 22,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x222365EF19F7947e5484218551B56bb3965Aa7aF',
    isTestnet: false,
    bridgeChainName: 'Plume'
  },
  // Cronos (Domain 25)
  25: {
    domain: 25,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xc21223249CA28397B4B6541dfFaEcC539BfF0c59',
    isTestnet: false,
    bridgeChainName: 'Cronos'
  },
  // Edge (Domain 28)
  2026: {
    domain: 28,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x06B6D4249aB84976725287fF66e6B165E0e50fB3',
    isTestnet: false,
    bridgeChainName: 'Edge'
  },
  // Injective (Domain 29)
  1776: {
    domain: 29,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xa00C59fF5a080D2b954d0c75e46E22a0c371235a',
    isTestnet: false,
    bridgeChainName: 'Injective'
  },
  // Morph (Domain 30)
  2818: {
    domain: 30,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xCfb1186F4e93D60E60a8bDd997427D1F33bc372B',
    isTestnet: false,
    bridgeChainName: 'Morph'
  },
  // Pharos (Domain 31)
  1672: {
    domain: 31,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815',
    isTestnet: false,
    bridgeChainName: 'Pharos'
  },
  84886: {
    domain: 31,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xC879C018dB60520F4355C26eD1a6D572cdAC1815',
    isTestnet: false,
    bridgeChainName: 'Pharos'
  },
  // Plasma (Domain 33)
  9745: {
    domain: 33,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x2d661C89D812261039AF9764eceaAee884f5F67F',
    isTestnet: false,
    bridgeChainName: 'Plasma'
  },
  // X Layer (Domain 37)
  196: {
    domain: 37,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0xB6CEceAB302E2E4948951eE7843FC24E92933061',
    isTestnet: false,
    bridgeChainName: 'X_Layer'
  },

  // ===================== TESTNETS & DEVNETS =====================
  // Ethereum Sepolia (Domain 0)
  11155111: {
    domain: 0,
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    isTestnet: true,
    bridgeChainName: 'Ethereum_Sepolia'
  },
  // Avalanche Fuji (Domain 1)
  43113: {
    domain: 1,
    tokenMessenger: '0xeb08f243E5d3FCFF26A9E38Ae5520A669f4019d0',
    messageTransmitter: '0xa9fB1b3009DCb79E2fe346c16a604B8Fa8aE0a79',
    usdcAddress: '0x5425890298aed601595a70ab815c96711a31bc65',
    isTestnet: true,
    bridgeChainName: 'Avalanche_Fuji'
  },
  // OP Sepolia (Domain 2)
  11155420: {
    domain: 2,
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    isTestnet: true,
    bridgeChainName: 'Optimism_Sepolia'
  },
  // Arbitrum Sepolia (Domain 3)
  421614: {
    domain: 3,
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    isTestnet: true,
    bridgeChainName: 'Arbitrum_Sepolia'
  },
  // Base Sepolia (Domain 6)
  84532: {
    domain: 6,
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    isTestnet: true,
    bridgeChainName: 'Base_Sepolia'
  },
  // Polygon Amoy (Domain 7)
  80002: {
    domain: 7,
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582',
    isTestnet: true,
    bridgeChainName: 'Polygon_Amoy_Testnet'
  },
  // Unichain Sepolia (Domain 10)
  1301: {
    domain: 10,
    tokenMessenger: '0x8ed94B8dAd2Dc5453862ea5e316A8e71AAed9782',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x31d0220469e10c4E71834a79b1f276d740d3768F',
    isTestnet: true,
    bridgeChainName: 'Unichain_Sepolia'
  },
  // Linea Sepolia (Domain 11)
  59141: {
    domain: 11,
    tokenMessenger: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
    usdcAddress: '0xfece4462d57bd51a6a552365a011b95f0e16d9b7',
    isTestnet: true,
    bridgeChainName: 'Linea_Sepolia'
  },
  // Codex Testnet (Domain 12)
  812242: {
    domain: 12,
    tokenMessenger: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
    usdcAddress: '0x6d7f141b6819C2c9CC2f818e6ad549E7Ca090F8f',
    isTestnet: true,
    bridgeChainName: 'Codex_Testnet'
  },
  // Sonic Testnet (Domain 13)
  14601: {
    domain: 13,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51',
    isTestnet: true,
    bridgeChainName: 'Sonic_Testnet'
  },
  64165: {
    domain: 13,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x0BA304580ee7c9a980CF72e55f5Ed2E9fd30Bc51',
    isTestnet: true,
    bridgeChainName: 'Sonic_Testnet'
  },
  // World Chain Sepolia (Domain 14)
  4801: {
    domain: 14,
    tokenMessenger: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    tokenMessengerV2: '0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa',
    messageTransmitter: '0xe737e5cebeeba77efe34d4aa090756590b1ce275',
    usdcAddress: '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88',
    isTestnet: true,
    bridgeChainName: 'World_Chain_Sepolia'
  },
  // Monad Testnet (Domain 15)
  10143: {
    domain: 15,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x534b2f3A21130d7a60830c2Df862319e593943A3',
    isTestnet: true,
    bridgeChainName: 'Monad_Testnet'
  },
  // Sei Testnet (Domain 16)
  1328: {
    domain: 16,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x4fCF1784B31630811181f670Aea7A7bEF803eaED',
    isTestnet: true,
    bridgeChainName: 'Sei_Testnet'
  },
  // XDC Apothem (Domain 18)
  51: {
    domain: 18,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0xb5AB69F7bBada22B28e79C8FFAECe55eF1c771D4',
    isTestnet: true,
    bridgeChainName: 'XDC_Apothem'
  },
  // HyperEVM Testnet (Domain 19)
  998: {
    domain: 19,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x2B3370eE501B4a559b57D449569354196457D8Ab',
    isTestnet: true,
    bridgeChainName: 'HyperEVM_Testnet'
  },
  // Ink Testnet (Domain 21)
  763373: {
    domain: 21,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0xFabab97dCE620294D2B0b0e46C68964e326300Ac',
    isTestnet: true,
    bridgeChainName: 'Ink_Testnet'
  },
  // Plume Testnet (Domain 22)
  98867: {
    domain: 22,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0xcB5f30e335672893c7eb944B374c196392C19D18',
    isTestnet: true,
    bridgeChainName: 'Plume_Testnet'
  },
  161221135: {
    domain: 22,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0xcB5f30e335672893c7eb944B374c196392C19D18',
    isTestnet: true,
    bridgeChainName: 'Plume_Testnet'
  },
  // Cronos Testnet (Domain 25)
  338: {
    domain: 25,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x01B11c5E048a1F1237a6bE6d4A9eF3f380F74C65',
    isTestnet: true,
    bridgeChainName: 'Cronos_Testnet'
  },
  // Arc Testnet (Domain 26)
  5042002: {
    domain: 26,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x3600000000000000000000000000000000000000',
    isTestnet: true,
    bridgeChainName: 'Arc_Testnet'
  },
  // Arc Mainnet (Domain 26 — currently testnet only, reserved)
  5042001: {
    domain: 26,
    tokenMessenger: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    tokenMessengerV2: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
    messageTransmitter: '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64',
    usdcAddress: '0x3600000000000000000000000000000000000000',
    isTestnet: false,
    bridgeChainName: 'Arc'
  },
  // Edge Testnet (Domain 28)
  33431: {
    domain: 28,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x2d9F7CAD728051AA35Ecdc472a14cf8cDF5CFD6B',
    isTestnet: true,
    bridgeChainName: 'Edge_Testnet'
  },
  202: {
    domain: 28,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x2d9F7CAD728051AA35Ecdc472a14cf8cDF5CFD6B',
    isTestnet: true,
    bridgeChainName: 'Edge_Testnet'
  },
  // Injective Testnet (Domain 29)
  1439: {
    domain: 29,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d',
    isTestnet: true,
    bridgeChainName: 'Injective_Testnet'
  },
  // Morph Testnet (Domain 30)
  2910: {
    domain: 30,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x7433b41C6c5e1d58D4Da99483609520255ab661B',
    isTestnet: true,
    bridgeChainName: 'Morph_Testnet'
  },
  2710: {
    domain: 30,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0x7433b41C6c5e1d58D4Da99483609520255ab661B',
    isTestnet: true,
    bridgeChainName: 'Morph_Testnet'
  },
  // Pharos Testnet (Domain 31)
  688689: {
    domain: 31,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0xcfC8330f4BCAB529c625D12781b1C19466A9Fc8B',
    isTestnet: true,
    bridgeChainName: 'Pharos_Testnet'
  },
  // Plasma Testnet (Domain 33)
  9746: {
    domain: 33,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0xE67Fb267022cBA8064Dd388CC2FED724F3120D9D',
    isTestnet: true,
    bridgeChainName: 'Plasma_Testnet'
  },
  // X Layer Testnet (Domain 37)
  1952: {
    domain: 37,
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275',
    usdcAddress: '0xDec90b78111Ba2fc6FC6d84d8B9ec159A2d4b9B3',
    isTestnet: true,
    bridgeChainName: 'X_Layer_Testnet'
  },
  // ===================== SOLANA =====================
  // Solana Mainnet (Domain 5)
  501: {
    domain: 5,
    tokenMessenger: '0x0000000000000000000000000000000000000000',
    tokenMessengerV2: '0x0000000000000000000000000000000000000000',
    messageTransmitter: '0x0000000000000000000000000000000000000000',
    usdcAddress: '0x0000000000000000000000000000000000000000',
    isTestnet: false,
    bridgeChainName: 'Solana'
  },
  // Solana Devnet (Domain 5)
  502: {
    domain: 5,
    tokenMessenger: '0x0000000000000000000000000000000000000000',
    tokenMessengerV2: '0x0000000000000000000000000000000000000000',
    messageTransmitter: '0x0000000000000000000000000000000000000000',
    usdcAddress: '0x0000000000000000000000000000000000000000',
    isTestnet: true,
    bridgeChainName: 'Solana'
  },
  // Holesky Testnet (Domain 0 fallback)
  17000: {
    domain: 0,
    tokenMessenger: '0x9f3B8679c73C2Fef8b59B4f3444d4e156fb70AA5',
    tokenMessengerV2: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
    messageTransmitter: '0x7865fAfC2db2093669d92c0F33AeEF291086BEFD',
    usdcAddress: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    isTestnet: true,
    bridgeChainName: 'Ethereum_Sepolia'
  }
};

/**
 * Converts an address to 32-byte hex for CCTP mintRecipient.
 * - EVM addresses (0x + 20 bytes): left-pad with zeros to 32 bytes.
 * - Solana addresses (Base58 public keys, 32 bytes / 44 chars): decoded to raw 32-byte hex.
 * - Already 32-byte hex strings: returned as-is.
 */
export function addressToBytes32(address: string): `0x${string}` {
  const trimmed = address.trim();

  // Already a full 32-byte hex string (0x + 64 hex chars)
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed.toLowerCase() as `0x${string}`;
  }

  // EVM address: 0x + 20 bytes (40 hex chars)
  if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    const clean = trimmed.toLowerCase().replace(/^0x/, '');
    return `0x${clean.padStart(64, '0')}` as `0x${string}`;
  }

  // Solana Base58 address (32-byte public key)
  try {
    const pubkey = new PublicKey(trimmed);
    const bytes = pubkey.toBytes();
    if (bytes.length === 32) {
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
      return `0x${hex}` as `0x${string}`;
    }
  } catch {
    // Not a valid Solana pubkey, continue to fallback
  }

  // Fallback: treat as raw hex and pad to 32 bytes
  const clean = trimmed.toLowerCase().replace(/^0x/, '');
  return `0x${clean.padStart(64, '0')}` as `0x${string}`;
}

/**
 * Zero bytes32 placeholder for any destination caller
 */
export const ZERO_BYTES32: `0x${string}` = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * ABI for Circle CCTP TokenMessenger depositForBurn (Supports V1 & V2 with Upfront Fees / maxFee)
 */
export const TOKEN_MESSENGER_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' }
    ],
    outputs: [{ name: '_nonce', type: 'uint64' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'depositForBurnWithCaller',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' }
    ],
    outputs: [{ name: '_nonce', type: 'uint64' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'depositForBurn',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' }
    ],
    outputs: [{ name: '_nonce', type: 'uint64' }],
    stateMutability: 'nonpayable'
  }
] as const;

/**
 * CCTP V2 6-parameter depositForBurn ABI for chains using CCTPv2 contracts.
 * Use when tokenMessengerV2 address is the active contract.
 * destinationCaller = ZERO_BYTES32 (any caller allowed)
 * maxFee = 0 (no upfront fee cap)
 */
export const TOKEN_MESSENGER_V2_ABI = [
  {
    type: 'function',
    name: 'depositForBurn',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
      { name: 'destinationCaller', type: 'bytes32' },
      { name: 'maxFee', type: 'uint256' },
      { name: 'minFinalityThreshold', type: 'uint32' }
    ],
    outputs: [{ name: '_nonce', type: 'uint64' }],
    stateMutability: 'nonpayable'
  }
] as const;

/**
 * CCTP V2 Fast Transfer finality threshold constant.
 * minFinalityThreshold <= 1000 means Fast Transfer.
 * minFinalityThreshold >= 2000 means Standard Transfer.
 */
export const FINALITY_FAST: number = 1000;
export const FINALITY_STANDARD: number = 2000;

/**
 * Source chain domains that support CCTP Fast Transfer.
 * Based on official Circle CCTP documentation:
 * https://developers.circle.com/cctp/concepts/supported-chains-and-domains
 */
const FAST_TRANSFER_SUPPORTED_DOMAINS = new Set([
  0,  // Ethereum
  2,  // OP Mainnet
  3,  // Arbitrum
  5,  // Solana
  6,  // Base
  10, // Unichain
  11, // Linea
  12, // Codex
  14, // World Chain
  21, // Ink
  22, // Plume
  25, // Starknet
  28, // EDGE
  30, // Morph
  37, // X Layer
]);

/**
 * Returns true if the given source domain supports CCTP Fast Transfer.
 * Chains NOT in this set (e.g., Avalanche, Polygon, Monad, Arc) must use Standard Transfer.
 */
export function isFastTransferSupported(sourceDomain: number): boolean {
  return FAST_TRANSFER_SUPPORTED_DOMAINS.has(sourceDomain);
}

/**
 * Determines if a chain config is using a CCTP V2 contract (6-param depositForBurn).
 * V2 contracts have a distinct address from V1 on Ethereum/Avalanche/Polygon.
 * For most newer chains, tokenMessenger IS the V2 contract.
 */
export function isCCTPV2Contract(config: CCTPChainConfig): boolean {
  if (!config.tokenMessengerV2) return false;
  // If tokenMessenger and tokenMessengerV2 are the same, it's a V2-only chain
  if (config.tokenMessenger.toLowerCase() === config.tokenMessengerV2.toLowerCase()) return true;
  // On classic chains (Ethereum, Avalanche, etc.), V1 and V2 differ — use V2 when available
  return Boolean(config.tokenMessengerV2);
}

/**
 * Estimates Circle CCTP Upfront Fees based on source & destination domain
 * For fast cross-chain transfers (e.g. L2 to L2 or L1 to L2), Circle CCTPv2 upfront fees are calculated
 * so the exact net amount reaches the recipient.
 */
export function estimateCCTPUpfrontFee(
  sourceDomain?: number,
  destDomain?: number,
  speed: 'FAST' | 'STANDARD' = 'FAST'
): number {
  if (sourceDomain === undefined || destDomain === undefined || sourceDomain === destDomain) {
    return 0.00; // Same chain or local transfer
  }

  // Standard transfer — no upfront relay fee (user pays destination gas themselves)
  if (speed === 'STANDARD') return 0.00;

  // Fast transfer mode upfront relay fee estimate in USDC
  if (sourceDomain === 0 || destDomain === 0) {
    return 0.25;
  }
  // High-speed L2 to L2 corridors (Base, Arbitrum, Optimism, Unichain, Linea, Polygon)
  return 0.10;
}

/**
 * ABI for Circle CCTP MessageTransmitter receiveMessage
 */
export const MESSAGE_TRANSMITTER_ABI = [
  {
    type: 'function',
    name: 'receiveMessage',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' }
    ],
    outputs: [{ name: 'success', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'usedNonces',
    inputs: [{ name: 'nonce', type: 'bytes32' }],
    outputs: [{ name: 'isUsed', type: 'uint256' }],
    stateMutability: 'view'
  }
] as const;

/**
 * UniPay Protocol Treasury Address on Canonical Base Chain
 */
export const UNIPAY_TREASURY_ADDRESS: `0x${string}` = '0x91F5c3127aB60c1dFEf925b6a715a31e87498c4A';

/**
 * Circle CCTP Iris Attestation API Endpoints
 */
export const IRIS_API_MAINNET = 'https://iris-api.circle.com';
export const IRIS_API_TESTNET = 'https://iris-api-sandbox.circle.com';

