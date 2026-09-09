import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Business, Invoice } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { CurrentBusiness } from '../auth/current-business.decorator';

@Controller('invoices')
@UseGuards(PrivyAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateInvoiceDto,
  ): Promise<Invoice> {
    return this.invoices.create(business, dto);
  }

  @Get()
  list(@CurrentBusiness() business: Business): Promise<Invoice[]> {
    return this.invoices.listForBusiness(business.id);
  }

  @Get(':id')
  get(
    @CurrentBusiness() business: Business,
    @Param('id') id: string,
  ): Promise<Invoice> {
    return this.invoices.getOwned(business.id, id);
  }
}
