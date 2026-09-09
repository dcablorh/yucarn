import { InvoiceStatus } from '@prisma/client';
import { InvoiceExpiryService } from './invoice-expiry.service';

describe('InvoiceExpiryService.expireOnce', () => {
  const prisma = { invoice: { updateMany: jest.fn() } };
  const service = new InvoiceExpiryService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.invoice.updateMany.mockResolvedValue({ count: 3 });
  });

  it('expires only open invoices past their expiry', async () => {
    const now = new Date('2026-09-08T12:00:00Z');

    expect(await service.expireOnce(now)).toBe(3);

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PROCESSING, InvoiceStatus.UNDERPAID] },
        expiresAt: { lt: now },
      },
      data: { status: InvoiceStatus.EXPIRED, activeNonce: null },
    });
  });

  it('releases the active nonce so the slot is reusable', async () => {
    await service.expireOnce(new Date());
    const [{ data }] = prisma.invoice.updateMany.mock.calls[0];
    expect(data.activeNonce).toBeNull();
  });

  it('never expires an invoice that is already paid', async () => {
    await service.expireOnce(new Date());
    const [{ where }] = prisma.invoice.updateMany.mock.calls[0];
    expect(where.status.in).not.toContain(InvoiceStatus.PAID);
  });

  it('reports zero when nothing is due', async () => {
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.expireOnce(new Date())).toBe(0);
  });
});
