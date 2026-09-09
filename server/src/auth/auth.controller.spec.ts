import { Logger, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController.register', () => {
  const privy = { verifyAccessToken: jest.fn() };
  const prisma = { business: { findUnique: jest.fn(), upsert: jest.fn() } };

  let controller: AuthController;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new AuthController(privy as never, prisma as never);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does not warn when registering a brand-new business', async () => {
    privy.verifyAccessToken.mockResolvedValue({ userId: 'did:privy:new' });
    prisma.business.findUnique.mockResolvedValue(null);
    prisma.business.upsert.mockResolvedValue({
      id: 'biz_1',
      privyUserId: 'did:privy:new',
      walletAddress: '0x11111111111111111111111111111111111111',
      name: undefined,
    });

    await controller.register('Bearer good', {
      walletAddress: '0x11111111111111111111111111111111111111',
    });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when re-registering with the same wallet address', async () => {
    const wallet = '0x11111111111111111111111111111111111111';
    privy.verifyAccessToken.mockResolvedValue({ userId: 'did:privy:abc' });
    prisma.business.findUnique.mockResolvedValue({
      id: 'biz_1',
      privyUserId: 'did:privy:abc',
      walletAddress: wallet,
    });
    prisma.business.upsert.mockResolvedValue({
      id: 'biz_1',
      privyUserId: 'did:privy:abc',
      walletAddress: wallet,
      name: undefined,
    });

    await controller.register('Bearer good', { walletAddress: wallet });

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns exactly once with the old and new addresses when the wallet changes', async () => {
    const oldWallet = '0x11111111111111111111111111111111111111';
    const newWallet = '0x22222222222222222222222222222222222222';
    privy.verifyAccessToken.mockResolvedValue({ userId: 'did:privy:abc' });
    prisma.business.findUnique.mockResolvedValue({
      id: 'biz_1',
      privyUserId: 'did:privy:abc',
      walletAddress: oldWallet,
    });
    prisma.business.upsert.mockResolvedValue({
      id: 'biz_1',
      privyUserId: 'did:privy:abc',
      walletAddress: newWallet,
      name: undefined,
    });

    await controller.register('Bearer good', { walletAddress: newWallet });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).toContain('biz_1');
    expect(message).toContain(oldWallet);
    expect(message).toContain(newWallet);
  });

  it('does not warn when token verification fails', async () => {
    privy.verifyAccessToken.mockRejectedValue(new Error('bad token'));

    await expect(
      controller.register('Bearer nope', {
        walletAddress: '0x11111111111111111111111111111111111111',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.business.findUnique).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
