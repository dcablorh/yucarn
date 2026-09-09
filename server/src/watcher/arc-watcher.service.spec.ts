import { InvoiceStatus } from '@prisma/client';
import { ArcWatcherService } from './arc-watcher.service';

describe('ArcWatcherService.pollOnce', () => {
  const prisma = {
    watcherCursor: { findUnique: jest.fn(), upsert: jest.fn() },
    invoice: { findMany: jest.fn(), updateMany: jest.fn() },
  };
  const rpc = { getBlockNumber: jest.fn(), getTransferLogs: jest.fn() };

  const service = new ArcWatcherService(prisma as never, rpc as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.watcherCursor.upsert.mockResolvedValue({});
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
  });

  it('does nothing when there are no open invoices', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    rpc.getBlockNumber.mockResolvedValue(100n);

    expect(await service.pollOnce()).toBe(0);
    expect(rpc.getTransferLogs).not.toHaveBeenCalled();
  });

  it('marks a matched invoice PAID and clears its active nonce', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 100_000_417n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);
    rpc.getTransferLogs.mockResolvedValue([
      { to: '0xmerchant', valueBase: 100_000_417n, txHash: '0xtx', blockNumber: 55n },
    ]);

    expect(await service.pollOnce()).toBe(1);

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'inv_a',
        // The write gate matches the fetch filter (OPEN_STATUSES), so it
        // includes UNDERPAID alongside PENDING/PROCESSING — see the
        // "credits a matched UNDERPAID invoice" test below for why a
        // narrower gate here would silently drop a real payment.
        status: {
          in: [InvoiceStatus.PENDING, InvoiceStatus.PROCESSING, InvoiceStatus.UNDERPAID],
        },
      },
      data: expect.objectContaining({
        status: InvoiceStatus.PAID,
        destTxHash: '0xtx',
        activeNonce: null,
      }),
    });
  });

  it('credits a matched UNDERPAID invoice (the write gate must match the fetch filter)', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_b', recipient: '0xmerchant', payableBase: 100_000_417n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);
    rpc.getTransferLogs.mockResolvedValue([
      { to: '0xmerchant', valueBase: 100_000_417n, txHash: '0xtx2', blockNumber: 55n },
    ]);

    expect(await service.pollOnce()).toBe(1);

    const [{ where }] = prisma.invoice.updateMany.mock.calls[0];
    expect(where.status.in).toContain(InvoiceStatus.UNDERPAID);
  });

  it('advances the cursor past the scanned range, held back by CONFIRMATIONS', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 1n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);
    rpc.getTransferLogs.mockResolvedValue([]);

    await service.pollOnce();

    // head=60, CONFIRMATIONS=2 -> confirmed head is 58, not 60.
    expect(prisma.watcherCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { lastBlock: 58n } }),
    );
  });

  it('does not advance the cursor when the scan throws', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 1n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);
    rpc.getTransferLogs.mockRejectedValue(new Error('RPC down'));

    await expect(service.pollOnce()).rejects.toThrow('RPC down');
    expect(prisma.watcherCursor.upsert).not.toHaveBeenCalled();
  });

  it('is a no-op when no new blocks have been produced', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 1n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 60n });
    rpc.getBlockNumber.mockResolvedValue(60n);

    expect(await service.pollOnce()).toBe(0);
    expect(rpc.getTransferLogs).not.toHaveBeenCalled();
  });

  it('caps a single scan to the maximum block span', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 1n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 0n });
    rpc.getBlockNumber.mockResolvedValue(100_000n);
    rpc.getTransferLogs.mockResolvedValue([]);

    await service.pollOnce();

    const [, toBlock] = rpc.getTransferLogs.mock.calls[0];
    expect(toBlock).toBe(2000n);
  });

  it('advances the cursor to the confirmed head even when idle (no open invoices)', async () => {
    // Without this, a merchant with no open invoices leaves the cursor
    // pinned during the idle period, forcing it to catch up at
    // MAX_BLOCK_SPAN blocks/tick once an invoice reopens.
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);

    expect(await service.pollOnce()).toBe(0);
    expect(rpc.getTransferLogs).not.toHaveBeenCalled();
    expect(prisma.watcherCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { lastBlock: 58n } }),
    );
  });

  it('does not move the idle cursor backwards', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 58n });
    rpc.getBlockNumber.mockResolvedValue(59n); // confirmed head would be 57

    expect(await service.pollOnce()).toBe(0);
    expect(prisma.watcherCursor.upsert).not.toHaveBeenCalled();
  });

  it('never scans into the unconfirmed window near the chain head', async () => {
    // A transfer that only exists within CONFIRMATIONS blocks of head is
    // not yet credited: PAID is terminal, and a reorg could still remove
    // that block. The RPC call's toBlock must stay CONFIRMATIONS behind.
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 100_000_417n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);
    rpc.getTransferLogs.mockResolvedValue([]);

    await service.pollOnce();

    const [fromBlock, toBlock] = rpc.getTransferLogs.mock.calls[0];
    expect(fromBlock).toBe(51n);
    expect(toBlock).toBe(58n); // 60 - CONFIRMATIONS(2), never 59 or 60
  });
});
