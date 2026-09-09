import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EnsStatus, type Business } from '@prisma/client';
import { EnsService } from './ens.service';
import { saltForRegistration } from './ens-calls';
import { RevertedTransactionError } from './sepolia-rpc.client';

const business = {
  id: 'biz_1',
  walletAddress: '0x1111111111111111111111111111111111111111',
} as unknown as Business;

/** The plaintext secret `encryption.decrypt` resolves to in every test. */
const SECRET = '0x' + '22'.repeat(32);

/**
 * Every method that returns a RegistrationView must never leak the
 * envelope or the plaintext secret. `calls` is the one legitimate
 * exception: a register call's calldata carries the secret on its way to
 * the browser that is about to sign it, so it is excluded here.
 */
function expectNoSecretLeak(result: unknown) {
  const view = { ...(result as Record<string, unknown>) };
  delete view.calls;
  const json = JSON.stringify(view);
  expect(json).not.toContain('v1.envelope');
  expect(json).not.toContain(SECRET);
}

function build(
  overrides: {
    registration?: Record<string, unknown> | null;
    blockNow?: number;
    committedAtBlock?: number;
  } = {},
) {
  const prisma = {
    ensRegistration: {
      findUnique: jest.fn().mockResolvedValue(overrides.registration ?? null),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'reg_1', ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...(overrides.registration ?? {}), ...data }),
        ),
    },
  };
  const encryption = {
    encrypt: jest.fn().mockReturnValue('v1.envelope'),
    decrypt: jest.fn().mockReturnValue(SECRET),
  };
  const rpc = {
    isAvailable: jest.fn().mockResolvedValue(true),
    getRegisterPrice: jest.fn().mockResolvedValue(8_000_021n),
    makeCommitment: jest.fn().mockResolvedValue('0x' + '44'.repeat(32)),
    getBlockTimestamp: jest
      .fn()
      .mockResolvedValue(overrides.blockNow ?? 1_800_000_100),
    getTransactionBlockTimestamp: jest
      .fn()
      .mockResolvedValue(overrides.committedAtBlock ?? 1_800_000_000),
    getDeployedProxyAddress: jest
      .fn()
      .mockResolvedValue('0x3333333333333333333333333333333333333333'),
    assertTransactionSucceeded: jest.fn().mockResolvedValue(undefined),
  };
  const service = new EnsService(
    prisma as never,
    encryption as never,
    rpc as never,
  );
  return { service, prisma, encryption, rpc };
}

describe('checkAvailability', () => {
  it('reports a free label with its price', async () => {
    const { service } = build();
    await expect(service.checkAvailability('unipaydemo')).resolves.toEqual({
      label: 'unipaydemo',
      available: true,
      priceBase: '8000021',
    });
  });

  it('does not price a taken label', async () => {
    // getRegisterPrice reverts NameNotAvailable for a taken name, so it
    // must not be called at all.
    const { service, rpc } = build();
    rpc.isAvailable.mockResolvedValue(false);
    const result = await service.checkAvailability('acme');
    expect(result).toEqual({
      label: 'acme',
      available: false,
      priceBase: null,
    });
    expect(rpc.getRegisterPrice).not.toHaveBeenCalled();
  });

  it('rejects an invalid label before touching the chain', async () => {
    const { service, rpc } = build();
    await expect(service.checkAvailability('ab')).rejects.toThrow();
    expect(rpc.isAvailable).not.toHaveBeenCalled();
  });
});

describe('createRegistration', () => {
  it('encrypts the secret and never returns it', async () => {
    const { service, encryption } = build();
    const result = await service.createRegistration(business, 'unipaydemo');

    expect(encryption.encrypt).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty('secretEnvelope');
    expectNoSecretLeak(result);
  });

  it('returns only the registry deployment call', async () => {
    // The subregistry address is not knowable until this lands, so mint,
    // approve and commit cannot be in the same batch.
    const { service } = build();
    const result = await service.createRegistration(business, 'unipaydemo');
    expect(result.calls).toHaveLength(1);
    expect(result.status).toBe(EnsStatus.DRAFT);
  });

  it('refuses a second registration for the same business', async () => {
    const { service } = build({
      registration: { id: 'reg_1', status: EnsStatus.REGISTERED },
    });
    await expect(service.createRegistration(business, 'other')).rejects.toThrow(
      /already/i,
    );
  });
});

describe('getDeployCalls', () => {
  const draft = {
    id: 'reg_1',
    businessId: 'biz_1',
    label: 'unipaydemo',
    name: 'unipaydemo.eth',
    status: EnsStatus.DRAFT,
    ownerAddress: business.walletAddress,
    priceBase: 8_000_021n,
    secretEnvelope: 'v1.envelope',
    durationSecs: 31_536_000,
  };

  it('returns exactly one call for a DRAFT registration', async () => {
    const { service } = build({ registration: draft });
    const result = await service.getDeployCalls('biz_1');
    expect(result.calls).toHaveLength(1);
    expect(result.status).toBe(EnsStatus.DRAFT);
  });

  it('is deterministic: re-deriving the call does not change the registration', async () => {
    // A reload before step 1 is signed should be able to call this
    // endlessly without side effects -- it must never touch the database.
    const { service, prisma } = build({ registration: draft });
    await service.getDeployCalls('biz_1');
    expect(prisma.ensRegistration.update).not.toHaveBeenCalled();
  });

  it('refuses when the registration has moved past DRAFT', async () => {
    const { service } = build({
      registration: { id: 'reg_1', status: EnsStatus.REGISTRY_DEPLOYED },
    });
    await expect(service.getDeployCalls('biz_1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('never leaks the envelope or the plaintext secret', async () => {
    const { service } = build({ registration: draft });
    const result = await service.getDeployCalls('biz_1');
    expectNoSecretLeak(result);
  });
});

describe('recordDeployment', () => {
  const draft = {
    id: 'reg_1',
    businessId: 'biz_1',
    label: 'unipaydemo',
    name: 'unipaydemo.eth',
    status: EnsStatus.DRAFT,
    ownerAddress: business.walletAddress,
    priceBase: 8_000_021n,
    secretEnvelope: 'v1.envelope',
    durationSecs: 31_536_000,
  };

  it('stores the proxy address and returns mint, approve and commit', async () => {
    const { service, prisma } = build({ registration: draft });

    const result = await service.recordDeployment(
      'biz_1',
      '0x' + 'ab'.repeat(32),
    );

    expect(prisma.ensRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subregistry: '0x3333333333333333333333333333333333333333',
          status: EnsStatus.REGISTRY_DEPLOYED,
        }),
      }),
    );
    expect(result.calls).toHaveLength(3);
    expectNoSecretLeak(result);
  });

  it("verifies the deployment against this registration's own salt", async () => {
    // The factory has no notion of ownership of a deployProxy call, so the
    // salt (deterministic from the registration id) is what proves this
    // deployment belongs to this registration and not someone else's.
    const { service, rpc } = build({ registration: draft });
    await service.recordDeployment('biz_1', '0x' + 'ab'.repeat(32));
    expect(rpc.getDeployedProxyAddress).toHaveBeenCalledWith(
      '0x' + 'ab'.repeat(32),
      saltForRegistration('reg_1'),
    );
  });

  it.each([EnsStatus.COMMITTED, EnsStatus.REGISTERED])(
    'refuses a %s registration, which must not be walked backwards',
    async (status) => {
      const { service } = build({ registration: { id: 'reg_1', status } });
      await expect(
        service.recordDeployment('biz_1', '0x' + 'ab'.repeat(32)),
      ).rejects.toThrow(BadRequestException);
    },
  );

  it('re-derives the commit calls for a REGISTRY_DEPLOYED row re-posting its own deploy hash', async () => {
    // The mint/approve/commit calls only ever existed in page memory, and
    // this is the only endpoint that can rebuild them. Refusing here would
    // strand every merchant who reloaded after step 1 -- and with them the
    // 24-hour expiry branch, which resets a row to exactly this state.
    const { service, prisma } = build({
      registration: {
        ...draft,
        status: EnsStatus.REGISTRY_DEPLOYED,
        subregistry: '0x3333333333333333333333333333333333333333',
        deployTxHash: '0x' + 'ab'.repeat(32),
      },
    });

    const result = await service.recordDeployment(
      'biz_1',
      '0x' + 'ab'.repeat(32),
    );

    expect(result.calls).toHaveLength(3);
    // Idempotent: the same deployment yields the same subregistry and the
    // same status, so replaying it changes nothing.
    expect(prisma.ensRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subregistry: '0x3333333333333333333333333333333333333333',
          deployTxHash: '0x' + 'ab'.repeat(32),
          status: EnsStatus.REGISTRY_DEPLOYED,
        }),
      }),
    );
    expectNoSecretLeak(result);
  });

  it('never leaks the secret when makeCommitment fails', async () => {
    // Mirrors what viem actually does on an RPC/contract error: it embeds
    // the request body and the decoded call args -- including the
    // plaintext secret argument -- directly into the error message.
    const { service, rpc } = build({ registration: draft });
    const leakyError = new Error(
      `HTTP request failed. Request body: {"data":"...${SECRET.slice(2)}..."} ` +
        `Function: makeCommitment(..., secret: ${SECRET}, ...)`,
    );
    rpc.makeCommitment.mockRejectedValue(leakyError);

    let thrown: unknown;
    try {
      await service.recordDeployment('biz_1', '0x' + 'ab'.repeat(32));
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    const message = (thrown as Error).message;
    expect(message).not.toContain(SECRET);
    expect(message).not.toContain(SECRET.slice(2));
    // The original error must not survive as `cause` either -- that is
    // exactly what Nest's default exception filter would log.
    expect((thrown as { cause?: unknown }).cause).toBeUndefined();
  });
});

describe('recordCommit', () => {
  const deployed = {
    id: 'reg_1',
    status: EnsStatus.REGISTRY_DEPLOYED,
    subregistry: '0x3333333333333333333333333333333333333333',
    priceBase: 8_000_021n,
  };

  it('takes committedAt from the block, not the request', async () => {
    const { service, prisma, rpc } = build({
      registration: deployed,
      committedAtBlock: 1_777_777_777,
    });

    const result = await service.recordCommit('biz_1', '0x' + 'cd'.repeat(32));

    expect(rpc.getTransactionBlockTimestamp).toHaveBeenCalled();
    expect(prisma.ensRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ committedAt: 1_777_777_777 }),
      }),
    );
    expectNoSecretLeak(result);
  });

  it('refuses when the registration is not awaiting a commitment', async () => {
    const { service } = build({
      registration: { id: 'reg_1', status: EnsStatus.DRAFT },
    });
    await expect(
      service.recordCommit('biz_1', '0x' + 'cd'.repeat(32)),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuses a commit transaction that reverted on-chain, and does not stamp the row', async () => {
    const { service, prisma, rpc } = build({ registration: deployed });
    rpc.getTransactionBlockTimestamp.mockRejectedValue(
      new RevertedTransactionError('0x' + 'cd'.repeat(32)),
    );

    await expect(
      service.recordCommit('biz_1', '0x' + 'cd'.repeat(32)),
    ).rejects.toThrow(/reverted/i);
    expect(prisma.ensRegistration.update).not.toHaveBeenCalled();
  });
});

describe('getRegisterCalls', () => {
  const committed = {
    id: 'reg_1',
    businessId: 'biz_1',
    label: 'unipaydemo',
    name: 'unipaydemo.eth',
    status: EnsStatus.COMMITTED,
    ownerAddress: business.walletAddress,
    subregistry: '0x3333333333333333333333333333333333333333',
    priceBase: 8_000_021n,
    secretEnvelope: 'v1.envelope',
    committedAt: 1_800_000_000,
    durationSecs: 31_536_000,
  };

  it('refuses before sixty seconds have passed on chain', async () => {
    const { service } = build({
      registration: committed,
      blockNow: 1_800_000_030,
    });
    await expect(service.getRegisterCalls('biz_1')).rejects.toThrow(
      /not ready|wait/i,
    );
  });

  it('returns register and records once ready, without leaking the secret outside the call', async () => {
    const { service } = build({
      registration: committed,
      blockNow: 1_800_000_070,
    });
    const result = await service.getRegisterCalls('biz_1');
    expect(result.calls).toHaveLength(2);
    expectNoSecretLeak(result);
  });

  it('refuses a commitment past MAX_COMMITMENT_AGE and marks it for re-commit', async () => {
    const { service, prisma, encryption } = build({
      registration: committed,
      blockNow: 1_800_090_000,
    });
    await expect(service.getRegisterCalls('biz_1')).rejects.toThrow(/expired/i);
    // The name was never at risk; only the commitment died. The row goes
    // back to a state the merchant can restart from.
    expect(prisma.ensRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EnsStatus.REGISTRY_DEPLOYED,
          committedAt: null,
        }),
      }),
    );
    // The secret must never be decrypted on a path that ends in refusal.
    expect(encryption.decrypt).not.toHaveBeenCalled();
  });

  it('decrypts the secret only when it is actually needed', async () => {
    const { service, encryption } = build({
      registration: committed,
      blockNow: 1_800_000_030,
    });
    await expect(service.getRegisterCalls('biz_1')).rejects.toThrow();
    expect(encryption.decrypt).not.toHaveBeenCalled();
  });
});

describe('recordRegistered', () => {
  const committed = {
    id: 'reg_1',
    businessId: 'biz_1',
    label: 'unipaydemo',
    name: 'unipaydemo.eth',
    status: EnsStatus.COMMITTED,
    ownerAddress: business.walletAddress,
    subregistry: '0x3333333333333333333333333333333333333333',
    priceBase: 8_000_021n,
    secretEnvelope: 'v1.envelope',
    committedAt: 1_800_000_000,
    durationSecs: 31_536_000,
  };

  it('refuses when there is no live commitment to register from', async () => {
    const { service } = build({
      registration: { id: 'reg_1', status: EnsStatus.REGISTRY_DEPLOYED },
    });
    await expect(
      service.recordRegistered('biz_1', '0x' + 'ef'.repeat(32), null),
    ).rejects.toThrow(BadRequestException);
  });

  it('marks the registration REGISTERED and never leaks the secret', async () => {
    const { service, prisma } = build({ registration: committed });

    const result = await service.recordRegistered(
      'biz_1',
      '0x' + 'ef'.repeat(32),
      '0x' + 'aa'.repeat(32),
    );

    expect(result.status).toBe(EnsStatus.REGISTERED);
    expect(prisma.ensRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registerTxHash: '0x' + 'ef'.repeat(32),
          recordsTxHash: '0x' + 'aa'.repeat(32),
          status: EnsStatus.REGISTERED,
        }),
      }),
    );
    expectNoSecretLeak(result);
  });

  it('verifies the register receipt before it will stamp REGISTERED', async () => {
    const { service, rpc } = build({ registration: committed });
    await service.recordRegistered('biz_1', '0x' + 'ef'.repeat(32), null);
    expect(rpc.assertTransactionSucceeded).toHaveBeenCalledWith(
      '0x' + 'ef'.repeat(32),
    );
  });

  it('refuses a register transaction that reverted, leaving the row COMMITTED', async () => {
    // REGISTERED has no exit -- createRegistration refuses a second row --
    // so a reverted register recorded as REGISTERED would permanently
    // advertise a name the merchant does not own.
    const { service, prisma, rpc } = build({ registration: committed });
    rpc.assertTransactionSucceeded.mockRejectedValue(
      new RevertedTransactionError('0x' + 'ef'.repeat(32)),
    );

    await expect(
      service.recordRegistered('biz_1', '0x' + 'ef'.repeat(32), null),
    ).rejects.toThrow(/reverted/i);
    expect(prisma.ensRegistration.update).not.toHaveBeenCalled();
  });
});

describe('getRegistration', () => {
  it('returns null when there is no registration', async () => {
    const { service } = build({ registration: null });
    await expect(service.getRegistration('biz_1')).resolves.toBeNull();
  });

  it('returns a view with no secret leak', async () => {
    const { service } = build({
      registration: {
        id: 'reg_1',
        businessId: 'biz_1',
        label: 'unipaydemo',
        name: 'unipaydemo.eth',
        status: EnsStatus.COMMITTED,
        ownerAddress: business.walletAddress,
        subregistry: '0x3333333333333333333333333333333333333333',
        priceBase: 8_000_021n,
        secretEnvelope: 'v1.envelope',
        committedAt: 1_800_000_000,
        durationSecs: 31_536_000,
      },
    });

    const result = await service.getRegistration('biz_1');
    expect(result?.status).toBe(EnsStatus.COMMITTED);
    expectNoSecretLeak(result);
  });
});
