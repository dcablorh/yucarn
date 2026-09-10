import { Connection } from '@solana/web3.js';
import { resolve as resolveSolanaDomain } from '@bonfida/spl-name-service/domain';

export interface ResolvedENS {
  query: string;
  address: string | null;
  displayName: string;
  handle: string;
  avatar?: string;
  isValid: boolean;
  error?: string;
  chainSpecificAddress?: string;
  chainType?: 'evm' | 'sui' | 'solana';
}

// In-memory cache to avoid duplicate network roundtrips
const ensCache = new Map<string, ResolvedENS>();

const SOLANA_RPCS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana.publicnode.com'
];

/**
 * Checks whether an address is a zero / null / system burn address.
 */
export function isZeroAddress(address?: string | null): boolean {
  if (!address) return true;
  const clean = address.trim().toLowerCase();
  if (clean === '0x' + '0'.repeat(40) || clean === '0'.repeat(40)) return true;
  if (clean === '0x' + '0'.repeat(64) || clean === '0'.repeat(64)) return true;
  if (clean === '11111111111111111111111111111111') return true;
  return false;
}

/**
 * Normalizes avatar URLs (handles ipfs://, euc.li, and metadata endpoints)
 */
function normalizeAvatarUrl(avatar?: string): string | undefined {
  if (!avatar) return undefined;
  if (avatar.startsWith('ipfs://')) {
    return avatar.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  return avatar;
}

/**
 * Resolves a Solana Name Service (SNS, .sol) name via on-chain RPC lookup.
 */
async function resolveSNS(name: string): Promise<ResolvedENS> {
  const normalizedName = name.toLowerCase().endsWith('.sol') ? name.toLowerCase() : `${name.toLowerCase()}.sol`;

  for (const rpc of SOLANA_RPCS) {
    try {
      const connection = new Connection(rpc, 'confirmed');
      const owner = await resolveSolanaDomain(connection, normalizedName);
      if (owner) {
        const address = owner.toBase58();
        if (!isZeroAddress(address)) {
          const namePart = normalizedName.split('.')[0];
          const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          return {
            query: name,
            address,
            displayName: capitalized,
            handle: normalizedName,
            isValid: true,
            chainSpecificAddress: address,
            chainType: 'solana'
          };
        }
      }
    } catch {
      // Continue to next RPC fallback
    }
  }

  return {
    query: name,
    address: null,
    displayName: name,
    handle: normalizedName,
    isValid: false,
    chainType: 'solana',
    error: `"${normalizedName}" is available or not registered on Solana Name Service (SNS).`
  };
}

/**
 * Resolves a SuiNS (.sui) name via the official Sui Mainnet GraphQL API.
 */
async function resolveSuiNS(name: string): Promise<ResolvedENS> {
  const normalizedName = name.toLowerCase().endsWith('.sui') ? name.toLowerCase() : `${name.toLowerCase()}.sui`;
  
  try {
    const query = `
      query ResolveSuiNS($name: String!) {
        nameRecord(name: $name) {
          domain
          target {
            address
          }
        }
      }
    `;

    const res = await fetch('https://graphql.mainnet.sui.io/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { name: normalizedName }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const record = data?.data?.nameRecord;
      
      if (record) {
        const resolvedAddress = record.target?.address;
        const namePart = normalizedName.split('.')[0];
        const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);

        if (resolvedAddress && !isZeroAddress(resolvedAddress) && /^0x[a-fA-F0-9]{64}$/.test(resolvedAddress)) {
          return {
            query: name,
            address: resolvedAddress,
            displayName: capitalized,
            handle: normalizedName,
            isValid: true,
            chainSpecificAddress: resolvedAddress,
            chainType: 'sui'
          };
        } else {
          return {
            query: name,
            address: null,
            displayName: capitalized,
            handle: normalizedName,
            isValid: false,
            chainType: 'sui',
            error: `"${normalizedName}" is registered but has no Sui target address set.`
          };
        }
      }
    }
  } catch (err) {
    console.warn('SuiNS GraphQL resolution error:', err);
  }

  return {
    query: name,
    address: null,
    displayName: name,
    handle: normalizedName,
    isValid: false,
    chainType: 'sui',
    error: `"${normalizedName}" is available or not registered on SuiNS.`
  };
}

/**
 * Resolves an ENS / SuiNS / SNS / DNS name or EVM / Sui / Solana address.
 */
export async function resolveENS(input: string, destinationChainId?: string): Promise<ResolvedENS> {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      query: input,
      address: null,
      displayName: '',
      handle: '',
      isValid: false
    };
  }

  const cacheKey = `${trimmed.toLowerCase()}_${destinationChainId || 'default'}`;
  if (ensCache.has(cacheKey)) {
    return ensCache.get(cacheKey)!;
  }

  // 1. Raw Sui 32-byte Address (66 chars including '0x', or 64 hex characters)
  const isSuiAddress = /^0x[a-fA-F0-9]{64}$/.test(trimmed) || (/^[a-fA-F0-9]{64}$/.test(trimmed) && trimmed.length === 64);
  if (isSuiAddress) {
    const formattedSuiAddress = trimmed.startsWith('0x') ? trimmed.toLowerCase() : `0x${trimmed.toLowerCase()}`;
    
    if (isZeroAddress(formattedSuiAddress)) {
      return {
        query: trimmed,
        address: null,
        displayName: trimmed,
        handle: trimmed,
        isValid: false,
        chainType: 'sui',
        error: 'Zero address is invalid and cannot be used as a recipient.'
      };
    }

    // Reverse SuiNS lookup
    try {
      const query = `
        query ResolveSuiAddress($address: SuiAddress!) {
          address(address: $address) {
            address
            defaultNameRecord {
              domain
            }
          }
        }
      `;
      const res = await fetch('https://graphql.mainnet.sui.io/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { address: formattedSuiAddress }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const defaultDomain = data?.data?.address?.defaultNameRecord?.domain;
        if (defaultDomain) {
          const namePart = defaultDomain.split('.')[0];
          const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          const result: ResolvedENS = {
            query: trimmed,
            address: formattedSuiAddress,
            displayName: capitalized,
            handle: defaultDomain,
            isValid: true,
            chainSpecificAddress: formattedSuiAddress,
            chainType: 'sui'
          };
          ensCache.set(cacheKey, result);
          return result;
        }
      }
    } catch {
      // Graceful fallback to address display
    }

    const suiAddressResult: ResolvedENS = {
      query: trimmed,
      address: formattedSuiAddress,
      displayName: `${formattedSuiAddress.slice(0, 6)}...${formattedSuiAddress.slice(-4)}`,
      handle: `${formattedSuiAddress.slice(0, 6)}...${formattedSuiAddress.slice(-4)}`,
      isValid: true,
      chainSpecificAddress: formattedSuiAddress,
      chainType: 'sui'
    };
    ensCache.set(cacheKey, suiAddressResult);
    return suiAddressResult;
  }

  // 2. SuiNS (.sui) Names
  if (trimmed.toLowerCase().endsWith('.sui') || destinationChainId?.toLowerCase() === 'sui') {
    if (trimmed.toLowerCase().endsWith('.sui')) {
      const result = await resolveSuiNS(trimmed);
      if (result.isValid) {
        ensCache.set(cacheKey, result);
      }
      return result;
    }
  }

  // 3. Raw Solana Base58 Address (32 to 44 base58 characters, no '0x' prefix)
  const isSolanaAddress = !trimmed.startsWith('0x') && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed);
  if (isSolanaAddress) {
    if (isZeroAddress(trimmed)) {
      return {
        query: trimmed,
        address: null,
        displayName: trimmed,
        handle: trimmed,
        isValid: false,
        chainType: 'solana',
        error: 'System address (1111...1111) cannot be used as a recipient.'
      };
    }

    const solanaAddressResult: ResolvedENS = {
      query: trimmed,
      address: trimmed,
      displayName: `${trimmed.slice(0, 5)}...${trimmed.slice(-4)}`,
      handle: `${trimmed.slice(0, 5)}...${trimmed.slice(-4)}`,
      isValid: true,
      chainSpecificAddress: trimmed,
      chainType: 'solana'
    };
    ensCache.set(cacheKey, solanaAddressResult);
    return solanaAddressResult;
  }

  // 4. SNS (.sol) Names — MUST use Solana Name Service; must NOT fall through to ENSv2
  if (trimmed.toLowerCase().endsWith('.sol') || (destinationChainId?.toLowerCase() === 'solana' || destinationChainId?.toLowerCase() === 'solana-devnet')) {
    if (trimmed.toLowerCase().endsWith('.sol') || !isSolanaAddress) {
      const result = await resolveSNS(trimmed.toLowerCase().endsWith('.sol') ? trimmed : trimmed);
      if (result.isValid) {
        ensCache.set(cacheKey, result);
        return result;
      }
      if (trimmed.toLowerCase().endsWith('.sol')) {
        return result;
      }
    }
  }

  // 5. Raw EVM Address - Immediate valid resolution with optional reverse ENS lookup
  const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(trimmed);
  if (isEvmAddress) {
    if (isZeroAddress(trimmed)) {
      return {
        query: trimmed,
        address: null,
        displayName: trimmed,
        handle: trimmed,
        isValid: false,
        chainType: 'evm',
        error: 'Zero address (0x0000...0000) cannot be used as a payment recipient.'
      };
    }

    try {
      const res = await fetch(`https://api.ensideas.com/ens/resolve/${trimmed.toLowerCase()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.name) {
          const namePart = data.name.split('.')[0];
          const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          const avatarUrl = normalizeAvatarUrl(data.avatar);

          const result: ResolvedENS = {
            query: trimmed,
            address: data.address || trimmed,
            displayName: capitalized,
            handle: data.name,
            avatar: avatarUrl,
            isValid: true,
            chainType: 'evm'
          };
          ensCache.set(cacheKey, result);
          return result;
        }
      }
    } catch {
      // Non-blocking fallback
    }

    const addressResult: ResolvedENS = {
      query: trimmed,
      address: trimmed,
      displayName: `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`,
      handle: `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`,
      avatar: undefined,
      isValid: true,
      chainType: 'evm'
    };
    ensCache.set(cacheKey, addressResult);
    return addressResult;
  }

  // 6. DNS & Dot-separated names (e.g. vitalik.eth, caleb.eth, myname.base.eth)
  const nameToQuery = trimmed.includes('.') ? trimmed.toLowerCase() : `${trimmed.toLowerCase()}.eth`;

  // 7. Primary Resolver: ENSv2 Universal Resolver & Enstate Node Indexer
  try {
    const res = await fetch(`https://enstate.rs/n/${encodeURIComponent(nameToQuery)}`);
    if (res.ok) {
      const data = await res.json();
      
      if (data && (data.address || (data.chains && Object.keys(data.chains).length > 0) || data.records)) {
        let resolvedAddress: string | null = data.address;
        const targetChainKey = destinationChainId?.toLowerCase();

        if (targetChainKey) {
          if (targetChainKey === 'solana' && (data.chains?.sol || data.records?.['sol'] || data.records?.['coin.501'])) {
            resolvedAddress = data.chains?.sol || data.records?.['sol'] || data.records?.['coin.501'];
          } else if (targetChainKey === 'sui' && (data.chains?.sui || data.records?.['sui'] || data.records?.['coin.784'])) {
            resolvedAddress = data.chains?.sui || data.records?.['sui'] || data.records?.['coin.784'];
          } else if (data.chains && data.chains[targetChainKey]) {
            resolvedAddress = data.chains[targetChainKey];
          } else if (data.records && data.records[`coin.${targetChainKey}`]) {
            resolvedAddress = data.records[`coin.${targetChainKey}`];
          } else if (data.chains && data.chains.eth) {
            resolvedAddress = data.chains.eth;
          }
        } else if (data.chains && data.chains.eth) {
          resolvedAddress = data.chains.eth;
        }

        // Must NOT be a zero/burn address
        if (isZeroAddress(resolvedAddress)) {
          resolvedAddress = null;
        }

        const isResolvedValid = Boolean(
          resolvedAddress && (
            /^0x[a-fA-F0-9]{40}$/.test(resolvedAddress) ||
            /^0x[a-fA-F0-9]{64}$/.test(resolvedAddress) ||
            (!resolvedAddress.startsWith('0x') && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(resolvedAddress))
          )
        );

        if (isResolvedValid && resolvedAddress) {
          const namePart = (data.display || data.name || nameToQuery).split('.')[0];
          const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          const avatarUrl = normalizeAvatarUrl(data.avatar || (data.records && data.records.avatar));
          const chainType = resolvedAddress.startsWith('0x')
            ? (resolvedAddress.length === 66 ? 'sui' : 'evm')
            : 'solana';

          const result: ResolvedENS = {
            query: trimmed,
            address: resolvedAddress,
            displayName: capitalized,
            handle: data.name || nameToQuery,
            avatar: avatarUrl,
            isValid: true,
            chainSpecificAddress: resolvedAddress,
            chainType
          };

          ensCache.set(cacheKey, result);
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('Primary ENSv2 resolution error:', err);
  }

  // 8. Secondary Resolver: Ensideas Universal Resolver API
  try {
    const res = await fetch(`https://api.ensideas.com/ens/resolve/${encodeURIComponent(nameToQuery)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.address && !isZeroAddress(data.address) && /^0x[a-fA-F0-9]{40}$/.test(data.address)) {
        const namePart = (data.displayName || data.name || nameToQuery).split('.')[0];
        const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
        const avatarUrl = normalizeAvatarUrl(data.avatar);

        const result: ResolvedENS = {
          query: trimmed,
          address: data.address,
          displayName: capitalized,
          handle: data.name || nameToQuery,
          avatar: avatarUrl,
          isValid: true,
          chainType: 'evm'
        };

        ensCache.set(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Secondary ENS resolution fallback error:', err);
  }

  // 9. Unregistered / Available or unresolvable name
  const isEth = nameToQuery.endsWith('.eth');
  const notFoundResult: ResolvedENS = {
    query: trimmed,
    address: null,
    displayName: trimmed,
    handle: nameToQuery,
    isValid: false,
    chainType: 'evm',
    error: isEth
      ? `"${nameToQuery}" is available or not registered. You can register it at app.ens.domains.`
      : `"${nameToQuery}" is available or has no on-chain address configured.`
  };
  return notFoundResult;
}

