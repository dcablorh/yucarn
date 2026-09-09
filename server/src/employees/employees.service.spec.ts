import { EmployeesService } from './employees.service';

const input = {
  name: 'John Abiodun',
  walletAddress: '0xAbCdEf1111111111111111111111111111111111',
  prefChain: 'base-sepolia',
  prefAsset: 'USDC',
};

function build(existing: Record<string, unknown> | null = null) {
  const prisma = {
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'emp_1', ...data }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'emp_1', ...data }),
      ),
      delete: jest.fn().mockResolvedValue({ id: 'emp_1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: existing ? 1 : 0 }),
    },
  };
  return { service: new EmployeesService(prisma as never), prisma };
}

describe('create', () => {
  it('stores the address lowercased', async () => {
    const { service, prisma } = build();
    await service.create('biz_1', input);
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletAddress: '0xabcdef1111111111111111111111111111111111',
        }),
      }),
    );
  });

  it('trims the name', async () => {
    const { service, prisma } = build();
    await service.create('biz_1', { ...input, name: '  John Abiodun  ' });
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'John Abiodun' }),
      }),
    );
  });

  it('binds the employee to the calling business', async () => {
    const { service, prisma } = build();
    await service.create('biz_1', input);
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: 'biz_1' }),
      }),
    );
  });

  it('rejects invalid input before touching the database', async () => {
    const { service, prisma } = build();
    await expect(service.create('biz_1', { ...input, walletAddress: '0xabc' })).rejects.toThrow();
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it('never writes subname fields', async () => {
    // Subname issuance is a later plan. If this ever starts writing them,
    // that plan's migration assumptions break.
    const { service, prisma } = build();
    await service.create('biz_1', input);
    const { data } = prisma.employee.create.mock.calls[0][0];
    expect(data).not.toHaveProperty('subname');
    expect(data).not.toHaveProperty('subnameLabel');
    expect(data).not.toHaveProperty('subnameTxHash');
  });
});

describe('update', () => {
  it('refuses an employee belonging to another business', async () => {
    // findFirst returns null because the {id, businessId} pair does not match.
    const { service, prisma } = build(null);
    await expect(service.update('biz_1', 'emp_other', input)).rejects.toThrow();
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('scopes its ownership lookup by business, not by id alone', async () => {
    const { service, prisma } = build({ id: 'emp_1', businessId: 'biz_1' });
    await service.update('biz_1', 'emp_1', input);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 'emp_1', businessId: 'biz_1' },
    });
  });

  it('applies the same normalisation as create', async () => {
    const { service, prisma } = build({ id: 'emp_1', businessId: 'biz_1' });
    await service.update('biz_1', 'emp_1', input);
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletAddress: '0xabcdef1111111111111111111111111111111111',
        }),
      }),
    );
  });
});

describe('remove', () => {
  it('refuses an employee belonging to another business', async () => {
    // deleteMany matches nothing when the {id, businessId} pair does not
    // line up, so count is 0 and the service reports NotFound — no
    // separate ownership lookup is needed for a scoped delete.
    const { service, prisma } = build(null);
    await expect(service.remove('biz_1', 'emp_other')).rejects.toThrow();
    expect(prisma.employee.deleteMany).toHaveBeenCalledWith({
      where: { id: 'emp_other', businessId: 'biz_1' },
    });
  });

  it('deletes one owned employee in a single scoped statement', async () => {
    const { service, prisma } = build({ id: 'emp_1', businessId: 'biz_1' });
    await service.remove('biz_1', 'emp_1');
    expect(prisma.employee.deleteMany).toHaveBeenCalledWith({
      where: { id: 'emp_1', businessId: 'biz_1' },
    });
  });
});

describe('list', () => {
  it('lists only the calling business’s employees, oldest first', async () => {
    const { service, prisma } = build();
    await service.list('biz_1');
    expect(prisma.employee.findMany).toHaveBeenCalledWith({
      where: { businessId: 'biz_1' },
      orderBy: { createdAt: 'asc' },
    });
  });
});
