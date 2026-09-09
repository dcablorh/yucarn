import { PayrollBatchStatus, PayrollItemStatus } from '@prisma/client';
import { PayrollService } from './payroll.service';

const employee = {
  id: 'emp_1',
  name: 'Ada',
  walletAddress: '0x1111111111111111111111111111111111111111',
  prefChain: 'arc-testnet',
  prefAsset: 'USDC',
};

const draftBatch = {
  id: 'bat_1',
  businessId: 'biz_1',
  status: PayrollBatchStatus.DRAFT,
  totalBase: 100_000_000n,
  fundingChain: 'arc-testnet',
  items: [
    {
      id: 'itm_1',
      employeeId: 'emp_1',
      name: 'Ada',
      walletAddress: employee.walletAddress,
      amountBase: 100_000_000n,
      destChain: 'arc-testnet',
      destAsset: 'USDC',
      status: PayrollItemStatus.PENDING,
      payTxHash: null,
      failureReason: null,
    },
  ],
};

const executingBatch = {
  ...draftBatch,
  status: PayrollBatchStatus.EXECUTING,
};

type Outcome = 'confirmed' | 'rejected' | 'unknown';

function build(batch: unknown = draftBatch, outcome: Outcome = 'confirmed') {
  const prisma = {
    payrollBatch: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(batch),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'bat_1', items: [], ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...(batch as object), ...data }),
        ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    payrollItem: {
      update: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
  const employees = { list: jest.fn().mockResolvedValue([employee]) };
  const arc = {
    verifyUsdcTransfer: jest.fn().mockResolvedValue({ outcome }),
  };
  const service = new PayrollService(
    prisma as never,
    employees as never,
    arc as never,
  );
  return { service, prisma, employees, arc };
}

describe('create', () => {
  it('reads the roster from the calling business only', async () => {
    const { service, employees } = build();
    await service.create('biz_1', { emp_1: '100.00' });
    expect(employees.list).toHaveBeenCalledWith('biz_1');
  });

  it('stores the total and one item per payable employee', async () => {
    const { service, prisma } = build();
    await service.create('biz_1', { emp_1: '100.00' });
    const { data } = prisma.payrollBatch.create.mock.calls[0][0];
    expect(data.totalBase).toBe(100_000_000n);
    expect(data.items.create).toHaveLength(1);
  });

  it('surfaces unpayable employees rather than hiding them', async () => {
    const { service, employees } = build();
    employees.list.mockResolvedValue([
      { ...employee, prefChain: 'base-sepolia' },
    ]);
    await expect(
      service.create('biz_1', { emp_1: '100.00' }),
    ).rejects.toThrow();
  });
});

describe('getCalls', () => {
  it('returns one call per item, with the item ids in the same order', async () => {
    const { service } = build();
    const result = await service.getCalls('biz_1', 'bat_1');
    expect(result.calls).toHaveLength(1);
    expect(result.itemIds).toEqual(['itm_1']);
  });

  it('refuses a batch belonging to another business', async () => {
    // Asserting the call shape (not just "it throws") is what actually
    // proves the lookup is scoped by businessId and not by id alone --
    // the exact cross-tenant bug this plan exists to prevent.
    const { service, prisma } = build(null);
    await expect(service.getCalls('biz_1', 'bat_other')).rejects.toThrow();
    expect(prisma.payrollBatch.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bat_other', businessId: 'biz_1' },
      }),
    );
  });

  it('refuses a batch that already executed', async () => {
    const { service } = build({
      ...draftBatch,
      status: PayrollBatchStatus.COMPLETED,
    });
    await expect(service.getCalls('biz_1', 'bat_1')).rejects.toThrow(
      /already/i,
    );
  });

  it('claims the batch as EXECUTING before handing the calls out', async () => {
    // Nothing else records that a run is in flight. Without this, a report
    // that fails to come back leaves a DRAFT batch with PENDING items and a
    // live "Pay everyone" button -- the whole team paid twice.
    const { service, prisma } = build();
    await service.getCalls('biz_1', 'bat_1');
    expect(prisma.payrollBatch.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'bat_1',
        businessId: 'biz_1',
        status: {
          in: [
            PayrollBatchStatus.DRAFT,
            PayrollBatchStatus.PARTIAL,
            PayrollBatchStatus.FAILED,
          ],
        },
      },
      data: { status: PayrollBatchStatus.EXECUTING },
    });
  });

  it('scopes the claiming update by businessId, not by id alone', async () => {
    // The conditional update is a write. Scoped by id alone it would let
    // one business lock another's run.
    const { service, prisma } = build();
    await service.getCalls('biz_1', 'bat_1');
    const { where } = prisma.payrollBatch.updateMany.mock.calls[0][0];
    expect(where.businessId).toBe('biz_1');
  });

  it('refuses a second getCalls on a batch that is already EXECUTING', async () => {
    const { service } = build(executingBatch);
    await expect(service.getCalls('biz_1', 'bat_1')).rejects.toThrow(
      /already being paid/i,
    );
  });

  it('refuses when the conditional update affects no rows, so two callers cannot both proceed', async () => {
    // Two tabs can both read a DRAFT batch. Only the database can decide
    // which of them gets to send it, and it decides by row count.
    const { service, prisma } = build();
    prisma.payrollBatch.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.getCalls('biz_1', 'bat_1')).rejects.toThrow(
      /already being paid/i,
    );
  });

  it('allows a retry of a PARTIAL run, for the items still pending only', async () => {
    // This is what makes an unverifiable payment recoverable.
    const partial = {
      ...draftBatch,
      status: PayrollBatchStatus.PARTIAL,
      items: [
        {
          ...draftBatch.items[0],
          id: 'itm_paid',
          status: PayrollItemStatus.PAID,
        },
        draftBatch.items[0],
      ],
    };
    const { service } = build(partial);
    const result = await service.getCalls('biz_1', 'bat_1');
    expect(result.itemIds).toEqual(['itm_1']);
  });

  it('allows a retry of a FAILED run', async () => {
    const { service } = build({
      ...draftBatch,
      status: PayrollBatchStatus.FAILED,
    });
    await expect(service.getCalls('biz_1', 'bat_1')).resolves.toBeDefined();
  });

  it('never re-pays a pending item that already carries a hash -- it re-checks it', async () => {
    // The item's transfer may well have landed; that is what an unverified
    // hash MEANS. Sending a second transfer to settle it is the double
    // payment this path exists to prevent.
    const unverified = {
      ...draftBatch,
      status: PayrollBatchStatus.PARTIAL,
      items: [{ ...draftBatch.items[0], payTxHash: `0x${'ab'.repeat(32)}` }],
    };
    const { service, arc, prisma } = build(unverified, 'confirmed');

    await expect(service.getCalls('biz_1', 'bat_1')).rejects.toThrow(
      /already been settled/i,
    );

    expect(arc.verifyUsdcTransfer).toHaveBeenCalledWith(
      `0x${'ab'.repeat(32)}`,
      employee.walletAddress,
      100_000_000n,
    );
    expect(prisma.payrollItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayrollItemStatus.PAID }),
      }),
    );
    expect(prisma.payrollBatch.updateMany).not.toHaveBeenCalled();
  });

  it('holds back a still-unverifiable item rather than paying it again', async () => {
    const unverified = {
      ...draftBatch,
      status: PayrollBatchStatus.PARTIAL,
      items: [{ ...draftBatch.items[0], payTxHash: `0x${'ab'.repeat(32)}` }],
    };
    const { service, prisma } = build(unverified, 'unknown');

    await expect(service.getCalls('biz_1', 'bat_1')).rejects.toThrow(
      /still cannot confirm/i,
    );
    expect(prisma.payrollBatch.updateMany).not.toHaveBeenCalled();
  });
});

describe('abandonExecution', () => {
  it('releases an EXECUTING run the merchant says was never signed', async () => {
    const { service, prisma } = build(executingBatch);
    await service.abandonExecution('biz_1', 'bat_1');
    expect(prisma.payrollBatch.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'bat_1',
        businessId: 'biz_1',
        status: PayrollBatchStatus.EXECUTING,
      },
      data: { status: PayrollBatchStatus.DRAFT },
    });
  });

  it('releases to PARTIAL, not DRAFT, when money already went out', async () => {
    const mixed = {
      ...executingBatch,
      items: [
        { ...draftBatch.items[0], status: PayrollItemStatus.PAID },
        { ...draftBatch.items[0], id: 'itm_2' },
      ],
    };
    const { service, prisma } = build(mixed);
    await service.abandonExecution('biz_1', 'bat_1');
    expect(prisma.payrollBatch.updateMany.mock.calls[0][0].data).toEqual({
      status: PayrollBatchStatus.PARTIAL,
    });
  });

  it('refuses to touch a run that is not EXECUTING', async () => {
    const { service, prisma } = build();
    await expect(service.abandonExecution('biz_1', 'bat_1')).rejects.toThrow(
      /not being paid/i,
    );
    expect(prisma.payrollBatch.updateMany).not.toHaveBeenCalled();
  });
});

describe('reportExecution', () => {
  const hash = `0x${'ab'.repeat(32)}`;

  it("verifies every reported hash against this item's wallet and amount before marking it paid", async () => {
    const { service, arc, prisma } = build(executingBatch);
    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_1', txHash: hash },
    ]);

    // A successful transaction alone is not proof of what it paid --
    // verification must be pinned to this item's own address and amount,
    // not just "some Arc transaction succeeded".
    expect(arc.verifyUsdcTransfer).toHaveBeenCalledWith(
      hash,
      employee.walletAddress,
      100_000_000n,
    );
    expect(prisma.payrollItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'itm_1' },
        data: expect.objectContaining({ status: PayrollItemStatus.PAID }),
      }),
    );
  });

  it('marks an item FAILED when the chain gives a checkable negative', async () => {
    // A client-reported hash is a claim, not proof.
    const { service, prisma } = build(executingBatch, 'rejected');
    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_1', txHash: hash },
    ]);

    expect(prisma.payrollItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayrollItemStatus.FAILED }),
      }),
    );
  });

  it('leaves an unverifiable item PENDING, with its hash, rather than calling it failed', async () => {
    // A 429 from a public RPC endpoint is not evidence that a transfer
    // failed. Recording it as one tells the merchant to pay that employee
    // a second time.
    const { service, prisma } = build(executingBatch, 'unknown');
    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_1', txHash: hash },
    ]);

    const { data } = prisma.payrollItem.update.mock.calls[0][0];
    expect(data.status).toBe(PayrollItemStatus.PENDING);
    expect(data.payTxHash).toBe(hash);
    expect(data.failureReason).toMatch(/could not be reached/i);
  });

  it('leaves a run with an unverifiable item in a state the merchant can act on', async () => {
    const { service, prisma } = build(executingBatch, 'unknown');
    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_1', txHash: hash },
    ]);
    expect(prisma.payrollBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayrollBatchStatus.PARTIAL }),
      }),
    );
  });

  it('ignores an item id that does not belong to this batch', async () => {
    const { service, prisma } = build(executingBatch);
    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_other', txHash: hash },
    ]);
    expect(prisma.payrollItem.update).not.toHaveBeenCalled();
  });

  it('leaves an already-PAID item untouched on a replay, and never overwrites its payTxHash', async () => {
    // PAID is terminal. A retried or re-posted report must not be able to
    // regress a paid item to FAILED and stomp its real payTxHash with a
    // bogus one -- that would invite paying the same person twice.
    const realHash = '0x' + 'cd'.repeat(32);
    const alreadyPaid = {
      ...draftBatch,
      status: PayrollBatchStatus.COMPLETED,
      items: [
        {
          ...draftBatch.items[0],
          status: PayrollItemStatus.PAID,
          payTxHash: realHash,
        },
      ],
    };
    const { service, prisma, arc } = build(alreadyPaid);

    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_1', txHash: hash },
    ]);

    expect(arc.verifyUsdcTransfer).not.toHaveBeenCalled();
    expect(prisma.payrollItem.update).not.toHaveBeenCalled();
  });

  it('marks the batch COMPLETED when every item is paid', async () => {
    const { service, prisma } = build(executingBatch);
    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_1', txHash: hash },
    ]);
    expect(prisma.payrollBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayrollBatchStatus.COMPLETED }),
      }),
    );
  });

  it('marks the batch PARTIAL when some items failed', async () => {
    const twoItems = {
      ...executingBatch,
      items: [
        executingBatch.items[0],
        { ...executingBatch.items[0], id: 'itm_2' },
      ],
    };
    const { service, prisma } = build(twoItems);
    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_1', txHash: hash },
    ]);
    expect(prisma.payrollBatch.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayrollBatchStatus.PARTIAL }),
      }),
    );
  });

  it('refuses a report for a run that was never sent to a wallet', async () => {
    // {results: []} against a fresh DRAFT batch used to mark it FAILED
    // with an executedAt, after which getCalls refused it forever and its
    // PENDING items could never be paid.
    const { service, prisma } = build(draftBatch);
    await expect(service.reportExecution('biz_1', 'bat_1', [])).rejects.toThrow(
      /not been sent to your wallet/i,
    );
    expect(prisma.payrollBatch.update).not.toHaveBeenCalled();
  });

  it('refuses an empty report outright', async () => {
    const { service, prisma } = build(executingBatch);
    await expect(service.reportExecution('biz_1', 'bat_1', [])).rejects.toThrow(
      /at least one payment/i,
    );
    expect(prisma.payrollBatch.update).not.toHaveBeenCalled();
  });

  it('refuses a hash already recorded against another run, before writing anything', async () => {
    // Two monthly runs pay the same person the same salary, so September's
    // hash verifies perfectly against October's item.
    const { service, prisma } = build(executingBatch);
    prisma.payrollItem.findFirst.mockResolvedValue({ payTxHash: hash });

    await expect(
      service.reportExecution('biz_1', 'bat_1', [
        { itemId: 'itm_1', txHash: hash },
      ]),
    ).rejects.toThrow(/already recorded against another payroll run/i);

    expect(prisma.payrollItem.update).not.toHaveBeenCalled();
    expect(prisma.payrollBatch.update).not.toHaveBeenCalled();
  });

  it('looks for a clashing hash outside this batch only, since an atomic batch shares one hash', async () => {
    const { service, prisma } = build(executingBatch);
    await service.reportExecution('biz_1', 'bat_1', [
      { itemId: 'itm_1', txHash: hash },
    ]);
    expect(prisma.payrollItem.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { payTxHash: { in: [hash] }, batchId: { not: 'bat_1' } },
      }),
    );
  });
});
