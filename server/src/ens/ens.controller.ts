import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { Business } from '@prisma/client';
import { EnsService } from './ens.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RecordTxDto } from './dto/record-tx.dto';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { CurrentBusiness } from '../auth/current-business.decorator';

/**
 * Server-prepares / browser-signs throughout. Every response body is either
 * a RegistrationView or that view plus unsigned {to, data, value, chainId}
 * calls. No route returns signing material, and none ever will.
 *
 * A business has at most one registration, so the routes address it as
 * "me" rather than by id — there is no id a merchant could pass that would
 * reach another business's row.
 */
@Controller('ens')
@UseGuards(PrivyAuthGuard)
export class EnsController {
  constructor(private readonly ens: EnsService) {}

  @Get('availability')
  availability(@Query('label') label: string) {
    return this.ens.checkAvailability(label ?? '');
  }

  @Post('registrations')
  create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateRegistrationDto,
  ) {
    return this.ens.createRegistration(business, dto.label);
  }

  @Get('registrations/me')
  get(@CurrentBusiness() business: Business) {
    return this.ens.getRegistration(business.id);
  }

  @Post('registrations/me/deploy-calls')
  deployCalls(@CurrentBusiness() business: Business) {
    return this.ens.getDeployCalls(business.id);
  }

  @Post('registrations/me/deployed')
  deployed(@CurrentBusiness() business: Business, @Body() dto: RecordTxDto) {
    return this.ens.recordDeployment(business.id, dto.txHash);
  }

  @Post('registrations/me/committed')
  committed(@CurrentBusiness() business: Business, @Body() dto: RecordTxDto) {
    return this.ens.recordCommit(business.id, dto.txHash);
  }

  @Post('registrations/me/register-calls')
  registerCalls(@CurrentBusiness() business: Business) {
    return this.ens.getRegisterCalls(business.id);
  }

  @Post('registrations/me/registered')
  registered(@CurrentBusiness() business: Business, @Body() dto: RecordTxDto) {
    return this.ens.recordRegistered(
      business.id,
      dto.txHash,
      dto.recordsTxHash ?? null,
    );
  }
}
