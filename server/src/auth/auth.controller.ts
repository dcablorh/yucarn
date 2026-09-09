import {
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { IsEthereumAddress, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Business } from '@prisma/client';
import { PrivyService } from './privy.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrivyAuthGuard } from './privy-auth.guard';
import { CurrentBusiness } from './current-business.decorator';

class RegisterBusinessDto {
  @IsEthereumAddress()
  walletAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly privy: PrivyService,
    private readonly prisma: PrismaService,
  ) {}

  /** Idempotent: creates the business on first call, updates the wallet after. */
  @Post('register')
  async register(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RegisterBusinessDto,
  ): Promise<Business> {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let userId: string;
    try {
      ({ userId } = await this.privy.verifyAccessToken(
        authorization.slice('Bearer '.length),
      ));
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const walletAddress = dto.walletAddress.toLowerCase();

    const existing = await this.prisma.business.findUnique({ where: { privyUserId: userId } });
    if (existing && existing.walletAddress !== walletAddress) {
      this.logger.warn(
        `Business ${existing.id} payout wallet changed from ${existing.walletAddress} to ${walletAddress}`,
      );
    }

    return this.prisma.business.upsert({
      where: { privyUserId: userId },
      create: {
        privyUserId: userId,
        walletAddress,
        name: dto.name,
      },
      update: { walletAddress, name: dto.name },
    });
  }

  @Get('me')
  @UseGuards(PrivyAuthGuard)
  me(@CurrentBusiness() business: Business): Business {
    return business;
  }
}
