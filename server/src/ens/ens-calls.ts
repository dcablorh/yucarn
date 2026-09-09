import {
  encodeFunctionData,
  keccak256,
  namehash,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import {
  ALL_ROLES,
  ENS,
  NO_REFERRER,
  REGISTRATION_DURATION_SECS,
  SEPOLIA_CHAIN_ID,
} from '../config/ens';

/**
 * What every ENS endpoint hands the browser. The server builds these; it
 * never signs them. `value` is a decimal string because these cross the
 * wire as JSON and BigInt does not survive that trip.
 */
export interface UnsignedCall {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

const call = (to: string, data: Hex): UnsignedCall => ({
  to,
  data,
  value: '0',
  chainId: SEPOLIA_CHAIN_ID,
});

// These ABIs are hand-written rather than imported from a package: the
// ENSv2 contracts are still in beta, no npm package publishes their ABI
// yet, and pulling in a full contracts package for five selectors would
// be a much larger dependency than the four fragments we actually call.
// Each fragment below was checked against the deployed Sepolia bytecode
// before this file was written (see src/config/ens.ts's header comment).

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'deployProxy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'implementation', type: 'address' },
      { name: 'salt', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const;

const USER_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'initialize',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'rootAccount', type: 'address' },
      { name: 'roleBitmap', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

const REGISTRAR_ABI = [
  {
    type: 'function',
    name: 'commit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'secret', type: 'bytes32' },
      { name: 'subregistry', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'duration', type: 'uint64' },
      { name: 'paymentToken', type: 'address' },
      { name: 'referrer', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const RESOLVER_ABI = [
  {
    type: 'function',
    name: 'setAddr',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'a', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setText',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'multicall',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ type: 'bytes[]' }],
  },
] as const;

/**
 * CREATE2 salt for the business's registry proxy.
 *
 * Derived from the registration id rather than randomly, so a retry after a
 * failed or lost deployment targets the same address instead of stranding
 * the previous one. The factory exposes no address predictor, so the
 * address itself is still only knowable from the ProxyDeployed event.
 */
export function saltForRegistration(registrationId: string): bigint {
  return BigInt(keccak256(toHex(registrationId)));
}

export function buildDeployRegistryCall(
  ownerAddress: string,
  salt: bigint,
): UnsignedCall {
  const initData = encodeFunctionData({
    abi: USER_REGISTRY_ABI,
    functionName: 'initialize',
    // The business is the root account of its own registry and holds every
    // role in it. Nothing here grants UniPay any authority over the name.
    args: [ownerAddress as Address, ALL_ROLES],
  });

  return call(
    ENS.verifiableFactory,
    encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: 'deployProxy',
      args: [ENS.userRegistryImpl as Address, salt, initData],
    }),
  );
}

/**
 * Mint the fee, approve the registrar, commit. Batchable as one
 * wallet_sendCalls: none of the three needs a previous one's return value.
 *
 * MockUSDC is an open faucet on this testnet, so the mint costs nothing but
 * gas. Exactly the price is minted — leaving a stray balance behind would
 * be untidy and would mask a pricing bug.
 */
export function buildCommitCalls(input: {
  ownerAddress: string;
  commitment: string;
  priceBase: bigint;
}): UnsignedCall[] {
  return [
    call(
      ENS.mockUsdc,
      encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [input.ownerAddress as Address, input.priceBase],
      }),
    ),
    call(
      ENS.mockUsdc,
      encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ENS.ethRegistrar as Address, input.priceBase],
      }),
    ),
    call(
      ENS.ethRegistrar,
      encodeFunctionData({
        abi: REGISTRAR_ABI,
        functionName: 'commit',
        args: [input.commitment as Hex],
      }),
    ),
  ];
}

export function buildRegisterCall(input: {
  label: string;
  ownerAddress: string;
  secret: string;
  subregistry: string;
  priceBase: bigint;
}): UnsignedCall {
  return call(
    ENS.ethRegistrar,
    encodeFunctionData({
      abi: REGISTRAR_ABI,
      functionName: 'register',
      args: [
        input.label,
        input.ownerAddress as Address,
        input.secret as Hex,
        input.subregistry as Address,
        ENS.publicResolver as Address,
        REGISTRATION_DURATION_SECS,
        ENS.mockUsdc as Address,
        NO_REFERRER,
      ],
    }),
  );
}

/**
 * Spec §3.5's five records, written as one resolver multicall.
 *
 * An address alone never implies a chain, so the destination chain and
 * asset are always explicit alongside it.
 */
export function buildRecordsCall(input: {
  name: string;
  payoutAddress: string;
  label: string;
}): UnsignedCall {
  const node = namehash(input.name);

  const texts: [string, string][] = [
    ['unipay.address', input.payoutAddress],
    ['unipay.chain', 'arc-testnet'],
    ['unipay.asset', 'USDC'],
    ['unipay.label', input.label],
  ];

  const inner: Hex[] = [
    encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: 'setAddr',
      args: [node, input.payoutAddress as Address],
    }),
    ...texts.map(([key, value]) =>
      encodeFunctionData({
        abi: RESOLVER_ABI,
        functionName: 'setText',
        args: [node, key, value],
      }),
    ),
  ];

  return call(
    ENS.publicResolver,
    encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: 'multicall',
      args: [inner],
    }),
  );
}
