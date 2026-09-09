import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';

const business = {
  id: 'biz_1',
  walletAddress: '0xmerchant',
  privyUserId: 'did:privy:a',
} as never;

describe('InvoicesService', () => {
  const prisma = {
    invoice: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  };
  const service = new InvoicesService(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('adds a nonce to the requested amount and stores both', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.create.mockImplementation(({ data }) =>
      Promise.resolve(data),
    );

    const invoice = await service.create(business, {
      amount: '100',
      description: 'Coffee',
    });

    expect(invoice.amountBase).toBe(100_000_000n);
    expect(invoice.payableBase).toBe(100_000_000n + BigInt(invoice.nonce));
    expect(invoice.payableBase).toBeGreaterThan(invoice.amountBase);
    expect(invoice.activeNonce).toBe(invoice.nonce);
    expect(invoice.status).toBe(InvoiceStatus.PENDING);
    expect(invoice.recipient).toBe('0xmerchant');
  });

  it('generates a 12-character URL-safe invoice id', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.create.mockImplementation(({ data }) =>
      Promise.resolve(data),
    );

    const invoice = await service.create(business, { amount: '1' });

    expect(invoice.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('never reuses a nonce held by an open invoice', async () => {
    const taken = Array.from({ length: 9998 }, (_, i) => ({
      activeNonce: i + 1,
    }));
    prisma.invoice.findMany.mockResolvedValue(taken);
    prisma.invoice.create.mockImplementation(({ data }) =>
      Promise.resolve(data),
    );

    const invoice = await service.create(business, { amount: '5' });

    expect(invoice.nonce).toBe(9999);
  });

  it('rejects a non-positive amount', async () => {
    await expect(service.create(business, { amount: '0' })).rejects.toThrow(
      /greater than zero/,
    );
    await expect(service.create(business, { amount: '0' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an amount with more than six decimal places', async () => {
    await expect(
      service.create(business, { amount: '1.0000001' }),
    ).rejects.toThrow(/decimal/);
  });

  it('rejects an amount that is not a whole number of cents', async () => {
    // 10.0001 lands one of the sub-cent digits the nonce needs to stay
    // unique (spec §10) — see BLOCKING FIX 1: without this, two invoices
    // (e.g. "10.00" + nonce 1500 and "10.001" + nonce 500) could land on
    // the same payable amount and the watcher would credit the wrong one.
    await expect(service.create(business, { amount: '10.0001' })).rejects.toThrow(
      /cent/,
    );
    await expect(service.create(business, { amount: '10.0001' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts an amount that is exactly a whole number of cents', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.create.mockImplementation(({ data }) => Promise.resolve(data));

    const invoice = await service.create(business, { amount: '10.01' });

    expect(invoice.amountBase).toBe(10_010_000n);
  });

  it('maps an exhausted nonce space to a 409 Conflict', async () => {
    const taken = Array.from({ length: 9999 }, (_, i) => ({ activeNonce: i + 1 }));
    prisma.invoice.findMany.mockResolvedValue(taken);

    await expect(service.create(business, { amount: '5' })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses to return another business’s invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv_1',
      businessId: 'biz_OTHER',
    });
    await expect(service.getOwned('biz_1', 'inv_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('omits internal fields from the public view', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv_1',
      businessId: 'biz_1',
      amountBase: 100_000_000n,
      payableBase: 100_000_417n,
      nonce: 417,
      activeNonce: 417,
      recipient: '0xmerchant',
      destChain: 'arc-testnet',
      asset: 'USDC',
      status: InvoiceStatus.PENDING,
      description: 'Coffee',
      expiresAt: new Date(),
      business: { name: 'Acme' },
    });

    const view = await service.getPublic('inv_1');

    expect(view).not.toHaveProperty('nonce');
    expect(view).not.toHaveProperty('activeNonce');
    expect(view).not.toHaveProperty('businessId');
    expect(view.payableBase).toBe(100_000_417n);
    expect(view.businessName).toBe('Acme');
  });
});
