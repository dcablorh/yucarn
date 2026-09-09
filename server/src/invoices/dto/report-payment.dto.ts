import { Matches } from 'class-validator';

export class ReportPaymentDto {
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'sourceTxHash must be a 32-byte hex hash' })
  sourceTxHash!: string;
}
