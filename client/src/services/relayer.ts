import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  arbitrumSepolia,
  baseSepolia,
  sepolia,
  optimismSepolia,
  polygonAmoy,
  avalancheFuji,
  base,
  arbitrum,
  mainnet,
  optimism,
  polygon,
  avalanche
} from 'viem/chains';
import { CCTP_CONFIGS, MESSAGE_TRANSMITTER_ABI } from '../config/cctp';
import { USDC_PERMIT_ABI } from '../utils/permit';

/**
 * Standard public RPC transports with reliable fallbacks
 */
const RPC_URLS: Record<number, string[]> = {
  // ===== Testnets =====
  421614:  ['https://sepolia-rollup.arbitrum.io/rpc', 'https://arbitrum-sepolia.blockpi.network/v1/rpc/public'],
  84532:   ['https://sepolia.base.org', 'https://base-sepolia.blockpi.network/v1/rpc/public'],
  11155111:['https://rpc.sepolia.org', 'https://1rpc.io/sepolia', 'https://ethereum-sepolia-rpc.publicnode.com'],
  11155420:['https://sepolia.optimism.io', 'https://optimism-sepolia.blockpi.network/v1/rpc/public'],
  80002:   ['https://rpc-amoy.polygon.technology', 'https://polygon-amoy.blockpi.network/v1/rpc/public'],
  43113:   ['https://api.avax-test.network/ext/bc/C/rpc'],
  1301:    ['https://sepolia.unichain.org', 'https://unichain-sepolia.drpc.org'],
  59141:   ['https://rpc.sepolia.linea.build', 'https://linea-sepolia.blockpi.network/v1/rpc/public'],
  10143:   ['https://testnet-rpc.monad.xyz', 'https://monad-testnet.drpc.org'],
  4801:    ['https://worldchain-sepolia.g.alchemy.com/public', 'https://worldchain-sepolia.drpc.org'],
  14601:   ['https://rpc.testnet.soniclabs.com'],
  64165:   ['https://rpc.testnet.soniclabs.com'],
  763373:  ['https://rpc-gel-sepolia.inkonchain.com'],
  1328:    ['https://evm-rpc-arctic-1.sei-apis.com'],
  51:      ['https://apothem.xdcscan.io/rpc'],
  998:     ['https://api.hyperliquid-testnet.xyz/evm'],
  161221135: ['https://testnet-rpc.plumenetwork.xyz'],
  98867:   ['https://testnet-rpc.plumenetwork.xyz'],
  338:     ['https://evm-t3.cronos.org'],
  202:     ['https://rpc.dev.cloudwalk.io'],
  33431:   ['https://testnet.edgeless.network/rpc'],
  1439:    ['https://testnet.sentry.tm.injective.network:8545'],
  2710:    ['https://rpc-quicknode-holesky.morphl2.io'],
  2910:    ['https://rpc-quicknode-holesky.morphl2.io'],
  688689:  ['https://testnet.pharosnetwork.xyz'],
  9746:    ['https://rpc.plasma-testnet.io'],
  1952:    ['https://testrpc.xlayer.tech'],
  812242:  ['https://rpc.codex.xyz/testnet'],
  5042002: ['https://rpc.testnet.arc.network'], // Arc Testnet

  // ===== Mainnets =====
  8453:  ['https://mainnet.base.org', 'https://base.llamarpc.com'],
  42161: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
  1:     ['https://eth.llamarpc.com', 'https://cloudflare-eth.com'],
  10:    ['https://mainnet.optimism.io', 'https://optimism.llamarpc.com'],
  137:   ['https://polygon-rpc.com', 'https://polygon.llamarpc.com'],
  43114: ['https://api.avax.network/ext/bc/C/rpc'],
  130:   ['https://mainnet.unichain.org'],
  59144: ['https://rpc.linea.build'],
  146:   ['https://rpc.soniclabs.com'],
  480:   ['https://worldchain-mainnet.g.alchemy.com/public'],
  57073: ['https://rpc-gel.inkonchain.com'],
  1329:  ['https://evm-rpc.sei-apis.com'],
};


// Extended chain definitions for chains not in viem/chains by default
const EXTENDED_CHAINS: Record<number, any> = {
  1301:  { id: 1301,    name: 'Unichain Sepolia',      network: 'unichain-sepolia',   nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://sepolia.unichain.org'] } } },
  59141: { id: 59141,   name: 'Linea Sepolia',         network: 'linea-sepolia',      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.sepolia.linea.build'] } } },
  10143: { id: 10143,   name: 'Monad Testnet',         network: 'monad-testnet',      nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 }, rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } } },
  4801:  { id: 4801,    name: 'World Chain Sepolia',   network: 'worldchain-sepolia', nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://worldchain-sepolia.g.alchemy.com/public'] } } },
  14601: { id: 14601,   name: 'Sonic Testnet',         network: 'sonic-testnet',      nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },   rpcUrls: { default: { http: ['https://rpc.testnet.soniclabs.com'] } } },
  763373:{ id: 763373,  name: 'Ink Testnet',           network: 'ink-testnet',        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc-gel-sepolia.inkonchain.com'] } } },
  1328:  { id: 1328,    name: 'Sei Testnet',           network: 'sei-testnet',        nativeCurrency: { name: 'Sei', symbol: 'SEI', decimals: 18 },    rpcUrls: { default: { http: ['https://evm-rpc-arctic-1.sei-apis.com'] } } },
  51:    { id: 51,      name: 'XDC Apothem',           network: 'xdc-apothem',        nativeCurrency: { name: 'XDC', symbol: 'XDC', decimals: 18 },    rpcUrls: { default: { http: ['https://apothem.xdcscan.io/rpc'] } } },
  998:   { id: 998,     name: 'HyperEVM Testnet',      network: 'hyperevm-testnet',   nativeCurrency: { name: 'HYPE', symbol: 'HYPE', decimals: 18 },  rpcUrls: { default: { http: ['https://api.hyperliquid-testnet.xyz/evm'] } } },
  98867: { id: 98867,   name: 'Plume Testnet',         network: 'plume-testnet',      nativeCurrency: { name: 'PLUME', symbol: 'PLUME', decimals: 18 },rpcUrls: { default: { http: ['https://testnet-rpc.plumenetwork.xyz'] } } },
  338:   { id: 338,     name: 'Cronos Testnet',        network: 'cronos-testnet',     nativeCurrency: { name: 'CRO', symbol: 'CRO', decimals: 18 },    rpcUrls: { default: { http: ['https://evm-t3.cronos.org'] } } },
  2710:  { id: 2710,    name: 'Morph Holesky',         network: 'morph-holesky',      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc-quicknode-holesky.morphl2.io'] } } },
  688689:{ id: 688689,  name: 'Pharos Testnet',        network: 'pharos-testnet',     nativeCurrency: { name: 'PHAROS', symbol: 'PHAROS', decimals: 18 }, rpcUrls: { default: { http: ['https://testnet.pharosnetwork.xyz'] } } },
  5042002:{ id: 5042002, name: 'Arc Testnet',          network: 'arc-testnet',        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },   rpcUrls: { default: { http: ['https://rpc.testnet.arc.network'] } } },

  // Mainnets not in default viem
  130:   { id: 130,    name: 'Unichain',      network: 'unichain',     nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://mainnet.unichain.org'] } } },
  59144: { id: 59144,  name: 'Linea',         network: 'linea',        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc.linea.build'] } } },
  146:   { id: 146,    name: 'Sonic',         network: 'sonic',        nativeCurrency: { name: 'Sonic', symbol: 'S', decimals: 18 },   rpcUrls: { default: { http: ['https://rpc.soniclabs.com'] } } },
  480:   { id: 480,    name: 'World Chain',   network: 'worldchain',   nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://worldchain-mainnet.g.alchemy.com/public'] } } },
  57073: { id: 57073,  name: 'Ink',           network: 'ink',          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: ['https://rpc-gel.inkonchain.com'] } } },
  1329:  { id: 1329,   name: 'Sei',           network: 'sei',          nativeCurrency: { name: 'Sei', symbol: 'SEI', decimals: 18 },   rpcUrls: { default: { http: ['https://evm-rpc.sei-apis.com'] } } },
};

const CHAIN_MAP: Record<number, any> = {
  421614: arbitrumSepolia,
  84532:  baseSepolia,
  11155111: sepolia,
  11155420: optimismSepolia,
  80002:  polygonAmoy,
  43113:  avalancheFuji,
  8453:   base,
  42161:  arbitrum,
  1:      mainnet,
  10:     optimism,
  137:    polygon,
  43114:  avalanche,
  ...EXTENDED_CHAINS,
};

export interface RelayResult {
  success: boolean;
  txHash?: `0x${string}`;
  error?: string;
}

export class RelayerService {
  /**
   * Get configured relayer private key (from Vite env or local key)
   */
  private getRelayerPrivateKey(): `0x${string}` | null {
    const envKey = (import.meta as any).env?.VITE_RELAYER_PRIVATE_KEY;
    if (envKey && envKey.startsWith('0x') && envKey.length === 66) {
      return envKey as `0x${string}`;
    }
    return null;
  }

  /**
   * Check if an automated background relayer is active
   */
  public hasActiveRelayer(): boolean {
    return Boolean(this.getRelayerPrivateKey());
  }

  /**
   * Automatically submit receiveMessage on destination chain
   */
  public async relayDestinationMint(
    destChainId: number,
    message: `0x${string}`,
    attestation: `0x${string}`
  ): Promise<RelayResult> {
    const privateKey = this.getRelayerPrivateKey();
    const destCCTP = CCTP_CONFIGS[destChainId];
    const chain = CHAIN_MAP[destChainId];
    const rpcList = RPC_URLS[destChainId] || [];

    if (!destCCTP || !chain || rpcList.length === 0) {
      return {
        success: false,
        error: `Unsupported destination chain ${destChainId} for automated relayer`
      };
    }

    if (!privateKey) {
      return {
        success: false,
        error: 'No relayer key configured'
      };
    }

    const account = privateKeyToAccount(privateKey);

    for (const rpc of rpcList) {
      try {
        const publicClient = createPublicClient({
          chain,
          transport: http(rpc, { timeout: 15_000 })
        });

        const walletClient = createWalletClient({
          account,
          chain,
          transport: http(rpc, { timeout: 15_000 })
        });

        const txHash = await walletClient.writeContract({
          address: destCCTP.messageTransmitter,
          abi: MESSAGE_TRANSMITTER_ABI,
          functionName: 'receiveMessage',
          args: [message, attestation],
          chain: chain as any
        });

        if (txHash) {
          try {
            await publicClient.waitForTransactionReceipt({
              hash: txHash,
              confirmations: 1,
              timeout: 45_000
            });
          } catch (waitErr) {
            console.warn('Relayer receipt wait notice:', waitErr);
          }

          return {
            success: true,
            txHash
          };
        }
      } catch (err: any) {
        console.warn(`Relayer failed via RPC ${rpc}:`, err?.message || err);
        // If message is already received
        if (err?.message?.includes('Nonce already used') || err?.message?.includes('execution reverted')) {
          return {
            success: true,
            error: 'Message already received on destination'
          };
        }
      }
    }

    return {
      success: false,
      error: 'Relayer was unable to complete destination transaction across available RPCs'
    };
  }

  /**
   * Submit EIP-2612 permit on-chain on behalf of user (gasless for the user)
   */
  public async submitPermit(
    chainId: number,
    usdcAddress: `0x${string}`,
    owner: `0x${string}`,
    spender: `0x${string}`,
    value: bigint,
    deadline: bigint,
    v: number,
    r: `0x${string}`,
    s: `0x${string}`
  ): Promise<RelayResult> {
    const privateKey = this.getRelayerPrivateKey();
    const chain = CHAIN_MAP[chainId];
    const rpcList = RPC_URLS[chainId] || [];

    if (!chain || rpcList.length === 0) {
      return {
        success: false,
        error: `Unsupported chain ${chainId} for permit submission`
      };
    }

    if (!privateKey) {
      return {
        success: false,
        error: 'No relayer key configured'
      };
    }

    const account = privateKeyToAccount(privateKey);

    for (const rpc of rpcList) {
      try {
        const publicClient = createPublicClient({
          chain,
          transport: http(rpc, { timeout: 15_000 })
        });

        const walletClient = createWalletClient({
          account,
          chain,
          transport: http(rpc, { timeout: 15_000 })
        });

        const txHash = await walletClient.writeContract({
          address: usdcAddress,
          abi: USDC_PERMIT_ABI,
          functionName: 'permit',
          args: [owner, spender, value, deadline, v, r, s],
          chain: chain as any
        });

        if (txHash) {
          try {
            await publicClient.waitForTransactionReceipt({
              hash: txHash,
              confirmations: 1,
              timeout: 30_000
            });
          } catch (waitErr) {
            console.warn('Permit receipt wait notice:', waitErr);
          }

          return {
            success: true,
            txHash
          };
        }
      } catch (err: any) {
        console.warn(`Permit submission failed via RPC ${rpc}:`, err?.message || err);
      }
    }

    return {
      success: false,
      error: 'Unable to broadcast permit across available RPCs'
    };
  }
}

export const relayerService = new RelayerService();
