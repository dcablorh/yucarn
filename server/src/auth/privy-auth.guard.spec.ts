import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrivyAuthGuard } from './privy-auth.guard';

function contextWithHeader(authorization?: string): ExecutionContext {
  const request: Record<string, unknown> = { headers: authorization ? { authorization } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PrivyAuthGuard', () => {
  const business = { id: 'biz_1', privyUserId: 'did:privy:abc', walletAddress: '0xabc' };

  const privy = { verifyAccessToken: jest.fn() };
  const prisma = { business: { findUnique: jest.fn(), create: jest.fn() } };

  const guard = new PrivyAuthGuard(privy as never, prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('rejects a request with no Authorization header', async () => {
    await expect(guard.canActivate(contextWithHeader())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token Privy refuses', async () => {
    privy.verifyAccessToken.mockRejectedValue(new Error('bad token'));
    await expect(guard.canActivate(contextWithHeader('Bearer nope'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the existing business to the request', async () => {
    privy.verifyAccessToken.mockResolvedValue({ userId: 'did:privy:abc' });
    prisma.business.findUnique.mockResolvedValue(business);

    const context = contextWithHeader('Bearer good');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().business).toEqual(business);
    expect(prisma.business.create).not.toHaveBeenCalled();
  });

  it('rejects a first-time user until they register a wallet', async () => {
    privy.verifyAccessToken.mockResolvedValue({ userId: 'did:privy:new' });
    prisma.business.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(contextWithHeader('Bearer good'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
