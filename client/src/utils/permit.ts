import { erc20Abi } from 'viem';

export function parseSignature(signatureHex: `0x${string}`): { r: `0x${string}`; s: `0x${string}`; v: number } {
  const clean = signatureHex.startsWith('0x') ? signatureHex.slice(2) : signatureHex;
  const r = `0x${clean.slice(0, 64)}` as `0x${string}`;
  const s = `0x${clean.slice(64, 128)}` as `0x${string}`;
  let v = parseInt(clean.slice(128, 130), 16);
  if (v < 27) v += 27;
  return { r, s, v };
}

/**
 * Standard ABI fragments for EIP-2612 and FiatTokenV2 (USDC)
 */
export const USDC_PERMIT_ABI = [
  ...erc20Abi,
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'DOMAIN_SEPARATOR',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'version',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'permit',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  }
] as const;

export interface UsdcPermitParams {
  owner: `0x${string}`;
  spender: `0x${string}`;
  value: bigint;
  deadline?: bigint;
  chainId: number;
  usdcAddress: `0x${string}`;
}

export interface SignedPermitResult {
  owner: `0x${string}`;
  spender: `0x${string}`;
  value: bigint;
  deadline: bigint;
  v: number;
  r: `0x${string}`;
  s: `0x${string}`;
  signature: `0x${string}`;
}

/**
 * Check if the deployed USDC contract supports EIP-2612 permit on this chain
 * Dynamically tests for nonces() and DOMAIN_SEPARATOR() rather than assuming.
 */
export async function isPermitSupported(
  publicClient: any,
  usdcAddress?: `0x${string}`,
  sampleOwner?: `0x${string}`
): Promise<boolean> {
  if (!publicClient || !usdcAddress) return false;
  try {
    const testAddress = sampleOwner || '0x0000000000000000000000000000000000000001';
    await Promise.all([
      publicClient.readContract({
        address: usdcAddress,
        abi: USDC_PERMIT_ABI,
        functionName: 'nonces',
        args: [testAddress]
      }),
      publicClient.readContract({
        address: usdcAddress,
        abi: USDC_PERMIT_ABI,
        functionName: 'DOMAIN_SEPARATOR'
      })
    ]);
    return true;
  } catch (e) {
    console.debug('EIP-2612 permit check notice (permit not supported or reverted):', e);
    return false;
  }
}

/**
 * Dynamically resolves the EIP-712 domain for the target USDC contract.
 * Checks contract token name and version dynamically (handling version '1' vs '2').
 */
export async function getUsdcDomain(
  publicClient: any,
  chainId: number,
  usdcAddress: `0x${string}`
): Promise<{
  name: string;
  version: string;
  chainId: number;
  verifyingContract: `0x${string}`;
}> {
  let name = 'USD Coin';
  let version = '2';

  try {
    const fetchedName = await publicClient.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: 'name'
    });
    if (fetchedName) {
      name = fetchedName;
    }
  } catch (e) {
    console.debug('Could not read USDC name dynamically, using default:', name);
  }

  try {
    const fetchedVersion = await publicClient.readContract({
      address: usdcAddress,
      abi: USDC_PERMIT_ABI,
      functionName: 'version'
    });
    if (fetchedVersion) {
      version = fetchedVersion;
    }
  } catch (e) {
    // Many L2 USDC contracts (Base, Arbitrum, Optimism) use version '2', older deployments use '1'
    console.debug('Could not read USDC version dynamically, using standard version:', version);
  }

  return {
    name,
    version,
    chainId,
    verifyingContract: usdcAddress
  };
}

/**
 * Reads the current permit nonce for an owner on-chain
 */
export async function getUsdcNonce(
  publicClient: any,
  usdcAddress: `0x${string}`,
  owner: `0x${string}`
): Promise<bigint> {
  const nonce = await publicClient.readContract({
    address: usdcAddress,
    abi: USDC_PERMIT_ABI,
    functionName: 'nonces',
    args: [owner]
  });
  return nonce as bigint;
}

/**
 * Solicits an off-chain EIP-712 permit signature from the user's wallet.
 * Returns the parsed v, r, s components and full signature.
 */
export async function signUsdcPermit(
  walletClient: any,
  publicClient: any,
  params: UsdcPermitParams
): Promise<SignedPermitResult> {
  const { owner, spender, value, chainId, usdcAddress } = params;
  
  // 20-minute deadline
  const deadline = params.deadline || BigInt(Math.floor(Date.now() / 1000) + 1200);

  const domain = await getUsdcDomain(publicClient, chainId, usdcAddress);
  const nonce = await getUsdcNonce(publicClient, usdcAddress, owner);

  const types = {
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' }
    ]
  } as const;

  const signature = await walletClient.signTypedData({
    account: owner,
    domain,
    types,
    primaryType: 'Permit',
    message: {
      owner,
      spender,
      value,
      nonce,
      deadline
    }
  });

  const parsed = parseSignature(signature);

  return {
    owner,
    spender,
    value,
    deadline,
    v: Number(parsed.v || 27),
    r: parsed.r,
    s: parsed.s,
    signature
  };
}
