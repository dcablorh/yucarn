import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateInvoiceDto {
  /** Decimal USDC string, e.g. "100" or "12.50". Never a float. */
  @Matches(/^\d+(\.\d{1,6})?$/, {
    message: 'amount must be a decimal with at most 6 decimal places',
  })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
