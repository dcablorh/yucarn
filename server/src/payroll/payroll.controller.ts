import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Business } from '@prisma/client';
import { PayrollService } from './payroll.service';
import { CreateBatchDto } from './dto/create-batch.dto';
import { ReportExecutionDto } from './dto/report-execution.dto';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { CurrentBusiness } from '../auth/current-business.decorator';

/**
 * A batch id appears in three paths. That is safe because the service
 * resolves it as {id, businessId} — an id belonging to another business
 * does not resolve, and returns the same 404 as one that never existed.
 *
 * Every response is data. No route returns signing material, and none
 * signs anything: /calls hands back unsigned calls for the browser.
 */
@Controller('payroll')
@UseGuards(PrivyAuthGuard)
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get()
  list(@CurrentBusiness() business: Business) {
    return this.payroll.list(business.id);
  }

  @Post()
  create(@CurrentBusiness() business: Business, @Body() dto: CreateBatchDto) {
    return this.payroll.create(business.id, dto.amounts);
  }

  @Get(':id')
  get(@CurrentBusiness() business: Business, @Param('id') id: string) {
    return this.payroll.get(business.id, id);
  }

  @Post(':id/calls')
  calls(@CurrentBusiness() business: Business, @Param('id') id: string) {
    return this.payroll.getCalls(business.id, id);
  }

  /**
   * The way back out of a locked run: the merchant states that nothing was
   * signed. Not automatic — see `PayrollService.abandonExecution`.
   */
  @Post(':id/abandon')
  abandon(@CurrentBusiness() business: Business, @Param('id') id: string) {
    return this.payroll.abandonExecution(business.id, id);
  }

  @Post(':id/executed')
  executed(
    @CurrentBusiness() business: Business,
    @Param('id') id: string,
    @Body() dto: ReportExecutionDto,
  ) {
    return this.payroll.reportExecution(business.id, id, dto.results);
  }
}
