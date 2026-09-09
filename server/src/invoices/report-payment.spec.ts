import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';

/** reportPayment is unauthenticated (spec §10), so findUnique/update always
 * join the business name — mirror that in every mock. */
const withBusiness = (invoice: Record<string, unknown>) => ({
  business: { name: 'Acme' },
  ...invoice,
});

describe('InvoicesService.reportPayment', () => {
  const prisma = {
    invoice: { findUnique: jest.fn(), update: jest.fn() },
  };
  const service = new InvoicesService(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('moves a pending invoice to PROCESSING and records the source hash', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      withBusiness({ id: 'inv_1', status: InvoiceStatus.PENDING }),
    );
    prisma.invoice.update.mockImplementation(({ data }) =>
      Promise.resolve(withBusiness({ id: 'inv_1', ...data })),
    );

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(result.status).toBe(InvoiceStatus.PROCESSING);
    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv_1' },
        data: expect.objectContaining({
          status: InvoiceStatus.PROCESSING,
          sourceTxHash: '0xdeadbeef',
        }),
      }),
    );
  });

  it('cannot mark an invoice PAID', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      withBusiness({ id: 'inv_1', status: InvoiceStatus.PENDING }),
    );
    prisma.invoice.update.mockImplementation(({ data }) =>
      Promise.resolve(withBusiness({ id: 'inv_1', ...data })),
    );

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(result.status).not.toBe(InvoiceStatus.PAID);
  });

  it('is idempotent when already processing', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      withBusiness({
        id: 'inv_1',
        status: InvoiceStatus.PROCESSING,
        sourceTxHash: '0xdeadbeef',
      }),
    );

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(result.status).toBe(InvoiceStatus.PROCESSING);
  });

  it('leaves an already-paid invoice untouched', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      withBusiness({ id: 'inv_1', status: InvoiceStatus.PAID }),
    );

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(result.status).toBe(InvoiceStatus.PAID);
  });

  it('omits internal fields from the response (nonce, activeNonce, businessId, tx hashes)', async () => {
    prisma.invoice.findUnique.mockResolvedValue(
      withBusiness({
        id: 'inv_1',
        status: InvoiceStatus.PENDING,
        businessId: 'biz_1',
        nonce: 417,
        activeNonce: 417,
        destTxHash: null,
      }),
    );
    prisma.invoice.update.mockImplementation(({ data }) =>
      Promise.resolve(
        withBusiness({
          id: 'inv_1',
          businessId: 'biz_1',
          nonce: 417,
          activeNonce: 417,
          destTxHash: null,
          ...data,
        }),
      ),
    );

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(result).not.toHaveProperty('businessId');
    expect(result).not.toHaveProperty('nonce');
    expect(result).not.toHaveProperty('activeNonce');
    expect(result).not.toHaveProperty('sourceTxHash');
    expect(result).not.toHaveProperty('destTxHash');
  });
});
