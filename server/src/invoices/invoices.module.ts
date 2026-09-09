import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoiceExpiryService } from './invoice-expiry.service';
import { InvoicesController } from './invoices.controller';
import { PublicInvoicesController } from './public-invoices.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InvoicesController, PublicInvoicesController],
  providers: [InvoicesService, InvoiceExpiryService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
