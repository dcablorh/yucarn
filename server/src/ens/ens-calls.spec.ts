import {
  decodeFunctionData,
  getAddress,
  namehash,
  type Hex,
} from 'viem';
import {
  buildDeployRegistryCall,
  buildCommitCalls,
  buildRegisterCall,
  buildRecordsCall,
  saltForRegistration,
} from './ens-calls';
import {
  ENS,
  NO_REFERRER,
  REGISTRATION_DURATION_SECS,
  SEPOLIA_CHAIN_ID,
} from '../config/ens';

const OWNER = '0x1111111111111111111111111111111111111111';
const SECRET = '0x' + '22'.repeat(32);
const SUBREGISTRY = '0x3333333333333333333333333333333333333333';

/**
 * Deliberately restated here rather than imported from ens-calls.
 *
 * These fragments are the contract's declared argument order, transcribed
 * from the deployed Sepolia signatures. Decoding the built calldata
 * against an independent copy is what makes the positional assertions
 * below mean anything: importing the same array the builder encodes with
 * would agree with any ordering, including a wrong one.
 */
const REGISTER_ABI = [
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

describe('buildDeployRegistryCall', () => {
  it('calls the factory with the UserRegistry implementation', () => {
    const call = buildDeployRegistryCall(OWNER, 42n);
    expect(call.to).toBe(ENS.verifiableFactory);
    expect(call.chainId).toBe(SEPOLIA_CHAIN_ID);
    expect(call.value).toBe('0');
    // deployProxy(address,uint256,bytes)
    expect(call.data.startsWith('0x5d84121a')).toBe(true);
    // The initialise calldata for the proxy embeds initialize(address,uint256).
    expect(call.data).toContain('cd6dc687');
    expect(call.data.toLowerCase()).toContain(OWNER.slice(2).toLowerCase());
  });
});

describe('buildCommitCalls', () => {
  it('returns mint, approve and commit in that order', () => {
    const calls = buildCommitCalls({
      ownerAddress: OWNER,
      commitment: '0x' + '44'.repeat(32),
      priceBase: 8_000_021n,
    });

    expect(calls).toHaveLength(3);
    expect(calls[0].to).toBe(ENS.mockUsdc); // mint
    expect(calls[1].to).toBe(ENS.mockUsdc); // approve
    expect(calls[2].to).toBe(ENS.ethRegistrar); // commit
    expect(calls[0].data.startsWith('0x40c10f19')).toBe(true); // mint(address,uint256)
    expect(calls[1].data.startsWith('0x095ea7b3')).toBe(true); // approve(address,uint256)
    expect(calls[2].data.startsWith('0xf14fcbc8')).toBe(true); // commit(bytes32)
  });

  it('approves the registrar, not the owner', () => {
    const calls = buildCommitCalls({
      ownerAddress: OWNER,
      commitment: '0x' + '44'.repeat(32),
      priceBase: 8_000_021n,
    });
    expect(calls[1].data.toLowerCase()).toContain(
      ENS.ethRegistrar.slice(2).toLowerCase(),
    );
  });

  it('mints exactly the price, so no stray balance is created', () => {
    const calls = buildCommitCalls({
      ownerAddress: OWNER,
      commitment: '0x' + '44'.repeat(32),
      priceBase: 8_000_021n,
    });
    // 8000021 = 0x7a1215
    expect(calls[0].data.endsWith('7a1215')).toBe(true);
  });
});

describe('buildRegisterCall', () => {
  it('calls the registrar with the eight-argument register', () => {
    const call = buildRegisterCall({
      label: 'unipaydemo',
      ownerAddress: OWNER,
      secret: SECRET,
      subregistry: SUBREGISTRY,
      priceBase: 8_000_021n,
    });
    expect(call.to).toBe(ENS.ethRegistrar);
    // register(string,address,bytes32,address,address,uint64,address,bytes32)
    expect(call.data.startsWith('0xcff3e7c2')).toBe(true);
    expect(call.data.toLowerCase()).toContain(
      SUBREGISTRY.slice(2).toLowerCase(),
    );
  });

  it('puts every argument in its declared position', () => {
    // `resolver` and `subregistry` are adjacent, same-typed address
    // arguments: swapping them compiles, keeps the selector identical,
    // and still contains both addresses somewhere in the calldata -- so
    // "contains SUBREGISTRY" cannot catch it. The result would be a name
    // whose registry is the resolver contract, discovered only on a live
    // registration that cannot be undone. Decode and pin the positions.
    const call = buildRegisterCall({
      label: 'unipaydemo',
      ownerAddress: OWNER,
      secret: SECRET,
      subregistry: SUBREGISTRY,
      priceBase: 8_000_021n,
    });

    const { functionName, args } = decodeFunctionData({
      abi: REGISTER_ABI,
      data: call.data as Hex,
    });

    expect(functionName).toBe('register');
    expect(args).toEqual([
      'unipaydemo',
      getAddress(OWNER),
      SECRET,
      getAddress(SUBREGISTRY),
      getAddress(ENS.publicResolver),
      REGISTRATION_DURATION_SECS,
      getAddress(ENS.mockUsdc),
      NO_REFERRER,
    ]);
    // Stated separately from the tuple so a failure names the swap.
    expect(args[3]).toBe(getAddress(SUBREGISTRY));
    expect(args[4]).toBe(getAddress(ENS.publicResolver));
    expect(args[3]).not.toBe(args[4]);
  });
});

describe('buildRecordsCall', () => {
  it('writes addr and four text records in one resolver multicall', () => {
    const call = buildRecordsCall({
      name: 'unipaydemo.eth',
      payoutAddress: OWNER,
      label: 'Unipay Demo',
    });
    expect(call.to).toBe(ENS.publicResolver);
    expect(call.data.startsWith('0xac9650d8')).toBe(true); // multicall(bytes[])
    // setAddr(bytes32,address) once, setText(bytes32,string,string) four times.
    expect(call.data.split('d5fa2b00').length - 1).toBe(1);
    expect(call.data.split('10f13a8c').length - 1).toBe(4);
  });

  it('writes the exact record keys and values, in their declared positions', () => {
    // setText(node, key, value) takes two adjacent same-typed strings, so
    // a key/value swap is invisible to a selector count. These five
    // records are the whole point of the name -- a resolver that answers
    // "arc-testnet" -> "unipay.chain" resolves to nothing a payer can use.
    const call = buildRecordsCall({
      name: 'unipaydemo.eth',
      payoutAddress: OWNER,
      label: 'unipaydemo',
    });
    const node = namehash('unipaydemo.eth');

    const outer = decodeFunctionData({
      abi: RESOLVER_ABI,
      data: call.data as Hex,
    });
    expect(outer.functionName).toBe('multicall');
    const inner = outer.args[0] as readonly Hex[];
    expect(inner).toHaveLength(5);

    const decoded = inner.map((data) =>
      decodeFunctionData({ abi: RESOLVER_ABI, data }),
    );

    expect(decoded[0].functionName).toBe('setAddr');
    expect(decoded[0].args).toEqual([node, getAddress(OWNER)]);

    expect(decoded.slice(1).map((d) => d.functionName)).toEqual([
      'setText',
      'setText',
      'setText',
      'setText',
    ]);
    expect(decoded.slice(1).map((d) => d.args)).toEqual([
      [node, 'unipay.address', OWNER],
      [node, 'unipay.chain', 'arc-testnet'],
      [node, 'unipay.asset', 'USDC'],
      [node, 'unipay.label', 'unipaydemo'],
    ]);
    // Named explicitly: key is argument 1, value is argument 2, and the
    // chain record says arc-testnet because settlement stays on Arc.
    const textArgs = (index: number) =>
      decoded[index].args as readonly [Hex, string, string];
    expect(textArgs(2)[1]).toBe('unipay.chain');
    expect(textArgs(2)[2]).toBe('arc-testnet');
    expect(textArgs(3)[1]).toBe('unipay.asset');
    expect(textArgs(3)[2]).toBe('USDC');
  });
});

describe('saltForRegistration', () => {
  it('is deterministic, so a retry redeploys to the same address', () => {
    expect(saltForRegistration('reg_abc')).toBe(saltForRegistration('reg_abc'));
  });

  it('differs between registrations', () => {
    expect(saltForRegistration('reg_abc')).not.toBe(
      saltForRegistration('reg_def'),
    );
  });
});
