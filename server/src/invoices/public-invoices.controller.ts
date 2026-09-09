import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InvoicesService, type PublicInvoice } from './invoices.service';
import { ReportPaymentDto } from './dto/report-payment.dto';

/**
 * Unauthenticated. A customer paying an invoice has no UniPay account.
 *
 * POST /payments is the integration contract for the consumer checkout app
 * (see spec §12). Nothing in this system depends on it being called.
 */
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get(':id')
  get(@Param('id') id: string): Promise<PublicInvoice> {
    return this.invoices.getPublic(id);
  }

  @Post(':id/payments')
  reportPayment(
    @Param('id') id: string,
    @Body() dto: ReportPaymentDto,
  ): Promise<PublicInvoice> {
    return this.invoices.reportPayment(id, dto.sourceTxHash);
  }
}
