import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrivyService } from './privy.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivyAuthGuard implements CanActivate {
  constructor(
    private readonly privy: PrivyService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let userId: string;
    try {
      ({ userId } = await this.privy.verifyAccessToken(header.slice('Bearer '.length)));
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const business = await this.prisma.business.findUnique({ where: { privyUserId: userId } });
    if (!business) {
      throw new UnauthorizedException('No business registered for this account');
    }

    request.business = business;
    return true;
  }
}
