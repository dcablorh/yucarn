import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { EnsStatus, type Business, type EnsRegistration } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../crypto/encryption.service';
import {
  RevertedTransactionError,
  SepoliaRpcClient,
} from './sepolia-rpc.client';
import { validateLabel, InvalidLabelError } from './ens-label';
import { assessCommitment } from './commitment-window';
import { REGISTRATION_DURATION_SECS, ENS } from '../config/ens';
import {
  buildCommitCalls,
  buildDeployRegistryCall,
  buildRecordsCall,
  buildRegisterCall,
  saltForRegistration,
} from './ens-calls';

/**
 * What the browser is allowed to see. The commit secret is deliberately
 * absent, and this projection is the only shape any ENS endpoint returns.
 */
export interface RegistrationView {
  id: string;
  label: string;
  name: string;
  status: EnsStatus;
  ownerAddress: string;
  subregistry: string | null;
  priceBase: string;
  readyAtSecs: number | null;
  expiresAtSecs: number | null;
  deployTxHash: string | null;
  commitTxHash: string | null;
  registerTxHash: string | null;
  recordsTxHash: string | null;
}

@Injectable()
export class EnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly rpc: SepoliaRpcClient,
  ) {}

  private view(row: EnsRegistration, blockNowSecs?: number): RegistrationView {
    const window =
      row.committedAt !== null
        ? assessCommitment(row.committedAt, blockNowSecs ?? 0)
        : null;

    return {
      id: row.id,
      label: row.label,
      name: row.name,
      status: row.status,
      ownerAddress: row.ownerAddress,
      subregistry: row.subregistry,
      priceBase: row.priceBase.toString(),
      readyAtSecs: window?.readyAtSecs ?? null,
      expiresAtSecs: window?.expiresAtSecs ?? null,
      deployTxHash: row.deployTxHash,
      commitTxHash: row.commitTxHash,
      registerTxHash: row.registerTxHash,
      recordsTxHash: row.recordsTxHash,
    };
  }

  private async require(businessId: string): Promise<EnsRegistration> {
    const row = await this.prisma.ensRegistration.findUnique({
      where: { businessId },
    });
    if (!row) throw new NotFoundException('No ENS registration in progress');
    return row;
  }

  async checkAvailability(label: string) {
    try {
      validateLabel(label);
    } catch (cause) {
      if (cause instanceof InvalidLabelError)
        throw new BadRequestException(cause.message);
      throw cause;
    }

    const available = await this.rpc.isAvailable(label);
    // Pricing a taken label reverts NameNotAvailable, so this call is
    // gated rather than run alongside the availability check.
    const priceBase = available
      ? (await this.rpc.getRegisterPrice(label)).toString()
      : null;

    return { label, available, priceBase };
  }

  async createRegistration(business: Business, label: string) {
    try {
      validateLabel(label);
    } catch (cause) {
      if (cause instanceof InvalidLabelError)
        throw new BadRequestException(cause.message);
      throw cause;
    }

    const existing = await this.prisma.ensRegistration.findUnique({
      where: { businessId: business.id },
    });
    if (existing) {
      throw new ConflictException(
        'This business already has an ENS registration',
      );
    }

    if (!(await this.rpc.isAvailable(label))) {
      throw new ConflictException(`${label}.eth is already taken`);
    }
    const priceBase = await this.rpc.getRegisterPrice(label);

    // 32 random bytes, encrypted before they touch the database and never
    // returned to anyone. This is the one genuinely sensitive value the
    // feature persists.
    const secret = `0x${randomBytes(32).toString('hex')}`;

    const row = await this.prisma.ensRegistration.create({
      data: {
        businessId: business.id,
        label,
        name: `${label}.eth`,
        status: EnsStatus.DRAFT,
        ownerAddress: business.walletAddress,
        priceBase,
        secretEnvelope: this.encryption.encrypt(secret),
        durationSecs: Number(REGISTRATION_DURATION_SECS),
      },
    });

    return {
      ...this.view(row),
      calls: [
        buildDeployRegistryCall(
          business.walletAddress,
          saltForRegistration(row.id),
        ),
      ],
    };
  }

  /**
   * Re-derives the deploy call for a registration that is still DRAFT.
   *
   * The unsigned call lives in page memory, not the database, so a reload
   * before the merchant even signs step 1 arrives with nothing to sign and
   * no row field to recover it from. Rebuilding it is safe because it is
   * deterministic: the same registration id always yields the same salt
   * (`saltForRegistration`), which always yields the same deployProxy
   * calldata — there is nothing here that could double-deploy or drift
   * from what the first attempt would have sent.
   */
  async getDeployCalls(businessId: string) {
    const row = await this.require(businessId);
    if (row.status !== EnsStatus.DRAFT) {
      throw new BadRequestException(
        'This registration is not awaiting a registry deployment',
      );
    }

    return {
      ...this.view(row),
      calls: [
        buildDeployRegistryCall(row.ownerAddress, saltForRegistration(row.id)),
      ],
    };
  }

  /**
   * Step 1 landed. Read the registry address out of the ProxyDeployed
   * event — the factory has no predictor, so this is the only source —
   * then hand back the batch that can now be built against it.
   *
   * Deliberately idempotent for a row that is already REGISTRY_DEPLOYED.
   * The mint/approve/commit calls live in page memory, not the database,
   * so a reload after step 1 arrives with nothing to sign and this is the
   * only endpoint that can re-derive them; refusing here would strand
   * every reloaded REGISTRY_DEPLOYED row, and with it the re-commit path
   * that getRegisterCalls's 24-hour expiry branch resets a row onto.
   *
   * Re-deriving is safe: getDeployedProxyAddress checks the ProxyDeployed
   * log's salt against saltForRegistration(row.id), so the same
   * deployTxHash always yields the same subregistry for this registration
   * and nobody else's, and the write below sets the same values it set the
   * first time. Anything past REGISTRY_DEPLOYED is still refused — a
   * COMMITTED or REGISTERED row must not be walked backwards.
   */
  async recordDeployment(businessId: string, txHash: string) {
    const row = await this.require(businessId);
    if (
      row.status !== EnsStatus.DRAFT &&
      row.status !== EnsStatus.REGISTRY_DEPLOYED
    ) {
      throw new BadRequestException(
        'This registration is not awaiting a registry deployment',
      );
    }

    // saltForRegistration(row.id) ties this deployment back to this
    // registration specifically; without it, one business could post
    // another's deploy tx hash and adopt the other's registry as its own.
    const subregistry = await this.rpc.getDeployedProxyAddress(
      txHash,
      saltForRegistration(row.id),
    );

    let commitment: string;
    try {
      commitment = await this.rpc.makeCommitment({
        label: row.label,
        owner: row.ownerAddress,
        secret: this.encryption.decrypt(row.secretEnvelope),
        subregistry,
      });
    } catch {
      // Never rethrow the original error, and never pass it as `cause`:
      // viem's RPC/contract errors embed the request body — the
      // makeCommitment calldata, which carries the plaintext secret as an
      // argument — and the decoded call args in their message. Nest's
      // default exception filter logs the message and stack of any
      // non-HttpException, so surfacing that error as-is would write the
      // secret to the server log on the first RPC hiccup (a 429 or
      // timeout is routine on a public testnet endpoint). Do not
      // "helpfully" restore the cause later.
      throw new ServiceUnavailableException(
        'Could not reach Sepolia to compute the commitment',
      );
    }

    const updated = await this.prisma.ensRegistration.update({
      where: { businessId },
      data: {
        subregistry,
        resolver: ENS.publicResolver,
        deployTxHash: txHash,
        status: EnsStatus.REGISTRY_DEPLOYED,
      },
    });

    return {
      ...this.view(updated),
      calls: buildCommitCalls({
        ownerAddress: row.ownerAddress,
        commitment,
        priceBase: row.priceBase,
      }),
    };
  }

  async recordCommit(
    businessId: string,
    txHash: string,
  ): Promise<RegistrationView> {
    const row = await this.require(businessId);
    if (row.status !== EnsStatus.REGISTRY_DEPLOYED) {
      throw new BadRequestException(
        'This registration is not awaiting a commitment',
      );
    }

    // From the block, never from the request. The registrar compares
    // against block.timestamp, so any other clock can disagree with the
    // chain and let us offer a register call that then reverts.
    let committedAt: number;
    try {
      committedAt = await this.rpc.getTransactionBlockTimestamp(txHash);
    } catch (cause) {
      if (cause instanceof RevertedTransactionError) {
        throw new BadRequestException(
          'That commit transaction reverted on-chain',
        );
      }
      throw cause;
    }

    const updated = await this.prisma.ensRegistration.update({
      where: { businessId },
      data: { commitTxHash: txHash, committedAt, status: EnsStatus.COMMITTED },
    });

    return this.view(updated, await this.rpc.getBlockTimestamp());
  }

  async getRegistration(businessId: string): Promise<RegistrationView | null> {
    const row = await this.prisma.ensRegistration.findUnique({
      where: { businessId },
    });
    if (!row) return null;
    return this.view(row, await this.rpc.getBlockTimestamp());
  }

  async getRegisterCalls(businessId: string) {
    const row = await this.require(businessId);
    if (
      row.status !== EnsStatus.COMMITTED ||
      row.committedAt === null ||
      !row.subregistry
    ) {
      throw new BadRequestException('This registration has no live commitment');
    }

    const blockNow = await this.rpc.getBlockTimestamp();
    const { state } = assessCommitment(row.committedAt, blockNow);

    if (state === 'expired') {
      // The name was never at risk — only the commitment died. Reset to
      // the last good state so the merchant can commit again.
      await this.prisma.ensRegistration.update({
        where: { businessId },
        data: {
          status: EnsStatus.REGISTRY_DEPLOYED,
          committedAt: null,
          commitTxHash: null,
        },
      });
      throw new BadRequestException(
        'That commitment expired after 24 hours. Commit again to continue — the name is still yours to claim.',
      );
    }

    if (state === 'too-new') {
      throw new BadRequestException(
        'The commitment is not ready yet. Wait for the countdown to finish.',
      );
    }

    // Decrypted only here, only after the window check passed, and only
    // into the register call the browser is about to sign.
    const secret = this.encryption.decrypt(row.secretEnvelope);

    return {
      ...this.view(row, blockNow),
      calls: [
        buildRegisterCall({
          label: row.label,
          ownerAddress: row.ownerAddress,
          secret,
          subregistry: row.subregistry,
          priceBase: row.priceBase,
        }),
        buildRecordsCall({
          name: row.name,
          payoutAddress: row.ownerAddress,
          label: row.label,
        }),
      ],
    };
  }

  /**
   * Step 3 landed. The receipt is checked before the row is stamped, for
   * the same reason recordCommit checks it: REGISTERED is a terminal
   * state with no exit — createRegistration refuses a second row — so a
   * register that reverted would leave the dashboard permanently
   * advertising a name the merchant does not own. Taking the client's
   * word here is the one place a wrong hash can never be corrected.
   */
  async recordRegistered(
    businessId: string,
    txHash: string,
    recordsTxHash: string | null,
  ): Promise<RegistrationView> {
    const row = await this.require(businessId);
    if (row.status !== EnsStatus.COMMITTED) {
      throw new BadRequestException(
        'This registration has no live commitment to register from',
      );
    }

    try {
      await this.rpc.assertTransactionSucceeded(txHash);
    } catch (cause) {
      if (cause instanceof RevertedTransactionError) {
        throw new BadRequestException(
          'That register transaction reverted on-chain',
        );
      }
      throw cause;
    }

    const updated = await this.prisma.ensRegistration.update({
      where: { businessId },
      data: {
        registerTxHash: txHash,
        recordsTxHash,
        status: EnsStatus.REGISTERED,
      },
    });
    return this.view(updated);
  }
}
