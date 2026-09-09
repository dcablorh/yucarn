import { Injectable } from '@nestjs/common';
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import { sepolia } from 'viem/chains';
import { ENS, NO_REFERRER, REGISTRATION_DURATION_SECS } from '../config/ens';
import { loadConfiguration } from '../config/configuration';

const PROXY_DEPLOYED = parseAbiItem(
  'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
);

/**
 * Thrown when a transaction's receipt shows it reverted on-chain.
 * Distinguished from a generic Error so callers (EnsService) can translate
 * it into a clean, user-facing message instead of a bare 500.
 */
export class RevertedTransactionError extends Error {
  constructor(txHash: string) {
    super(`Transaction ${txHash} reverted on-chain`);
    this.name = 'RevertedTransactionError';
  }
}

/**
 * A reverted commit transaction never actually set a commitment on-chain,
 * so treating its block timestamp as `committedAt` would start a 24-hour
 * window for a commitment that was never made. Pulled out as a pure
 * function so this check is unit-testable without a live client.
 */
export function assertTransactionSucceeded(
  receipt: { status: string },
  txHash: string,
): void {
  if (receipt.status !== 'success') {
    throw new RevertedTransactionError(txHash);
  }
}

/**
 * Picks the ProxyDeployed log for this transaction and verifies its salt
 * matches the registration that is asking for it.
 *
 * VerifiableFactory places no restriction on who calls deployProxy with
 * whose salt, so filtering by tx hash alone is not enough: without this
 * check, business B could submit business A's deploy tx hash and silently
 * adopt A's registry as its own subregistry. The salt is deterministic
 * (saltForRegistration(registrationId)), so it is what ties a deployment
 * back to the registration that asked for it.
 *
 * Pulled out as a pure function so the mismatch case is unit-testable
 * without a live client.
 */
export function findMatchingProxyDeployedLog(
  logs: readonly {
    transactionHash: string | null;
    args: { proxyAddress?: string; salt?: bigint };
  }[],
  txHash: string,
  expectedSalt: bigint,
): string {
  const match = logs.find(
    (log) => log.transactionHash?.toLowerCase() === txHash.toLowerCase(),
  );
  if (!match?.args.proxyAddress) {
    throw new Error('No ProxyDeployed event found in that transaction');
  }
  if (match.args.salt !== expectedSalt) {
    throw new Error('That deployment does not belong to this registration');
  }
  return match.args.proxyAddress;
}

const REGISTRAR_ABI = [
  {
    type: 'function',
    name: 'isAvailable',
    stateMutability: 'view',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getRegisterPrice',
    stateMutability: 'view',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'duration', type: 'uint64' },
      { name: 'paymentToken', type: 'address' },
    ],
    outputs: [
      { name: 'base', type: 'uint256' },
      { name: 'premium', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'makeCommitment',
    stateMutability: 'pure',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'secret', type: 'bytes32' },
      { name: 'subregistry', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'duration', type: 'uint64' },
      { name: 'referrer', type: 'bytes32' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
] as const;

/**
 * Read-only access to Sepolia for ENS. Mirrors ArcRpcClient's shape.
 *
 * Nothing here signs. The one method that could have been computed locally
 * — makeCommitment — is deliberately an eth_call against the registrar's
 * own pure function instead: a commitment hash we derive ourselves and the
 * registrar disagrees with produces a register that reverts sixty seconds
 * later, with no way to tell which side was wrong.
 */
@Injectable()
export class SepoliaRpcClient {
  private readonly client: PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(loadConfiguration().sepoliaRpcUrl),
  });

  isAvailable(label: string): Promise<boolean> {
    return this.client.readContract({
      address: ENS.ethRegistrar,
      abi: REGISTRAR_ABI,
      functionName: 'isAvailable',
      args: [label],
    });
  }

  /**
   * Total cost in MockUSDC base units. Reverts NameNotAvailable for a taken
   * label, so callers must check isAvailable first.
   */
  async getRegisterPrice(label: string): Promise<bigint> {
    const [base, premium] = await this.client.readContract({
      address: ENS.ethRegistrar,
      abi: REGISTRAR_ABI,
      functionName: 'getRegisterPrice',
      args: [label, REGISTRATION_DURATION_SECS, ENS.mockUsdc as Address],
    });
    return base + premium;
  }

  makeCommitment(input: {
    label: string;
    owner: string;
    secret: string;
    subregistry: string;
  }): Promise<string> {
    return this.client.readContract({
      address: ENS.ethRegistrar,
      abi: REGISTRAR_ABI,
      functionName: 'makeCommitment',
      args: [
        input.label,
        input.owner as Address,
        input.secret as Hex,
        input.subregistry as Address,
        ENS.publicResolver as Address,
        REGISTRATION_DURATION_SECS,
        NO_REFERRER,
      ],
    });
  }

  async getBlockTimestamp(): Promise<number> {
    const block = await this.client.getBlock({ blockTag: 'latest' });
    return Number(block.timestamp);
  }

  /**
   * The block timestamp of the block a transaction landed in. Throws
   * RevertedTransactionError if the transaction itself reverted.
   */
  async getTransactionBlockTimestamp(txHash: string): Promise<number> {
    const receipt = await this.client.getTransactionReceipt({
      hash: txHash as Hex,
    });
    assertTransactionSucceeded(receipt, txHash);
    const block = await this.client.getBlock({
      blockNumber: receipt.blockNumber,
    });
    return Number(block.timestamp);
  }

  /**
   * Fetches a transaction's receipt purely to confirm it did not revert.
   * Throws RevertedTransactionError if it did.
   *
   * The register step has no timestamp to read and no event to decode, so
   * this is the whole of its on-chain verification — but a reverted
   * register that got recorded as REGISTERED is unrecoverable, so it gets
   * checked all the same. The unqualified call below is the module-level
   * pure helper, which is where the actual status check lives.
   */
  async assertTransactionSucceeded(txHash: string): Promise<void> {
    const receipt = await this.client.getTransactionReceipt({
      hash: txHash as Hex,
    });
    assertTransactionSucceeded(receipt, txHash);
  }

  /**
   * The proxy address from a deployProxy receipt, verified against the
   * salt this registration expects (see findMatchingProxyDeployedLog).
   *
   * VerifiableFactory exposes no address predictor, so the event is the
   * only way to learn where the registry landed.
   */
  async getDeployedProxyAddress(
    txHash: string,
    expectedSalt: bigint,
  ): Promise<string> {
    const receipt = await this.client.getTransactionReceipt({
      hash: txHash as Hex,
    });
    const logs = await this.client.getLogs({
      address: ENS.verifiableFactory as Address,
      event: PROXY_DEPLOYED,
      blockHash: receipt.blockHash,
    });

    return findMatchingProxyDeployedLog(logs, txHash, expectedSalt);
  }
}
