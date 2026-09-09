import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Shape only. The real rules live in validateEmployeeInput, which the
 * service applies — this keeps an oversized body from reaching it.
 */
export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(42)
  @MaxLength(42)
  walletAddress!: string;

  @IsString()
  @MaxLength(40)
  prefChain!: string;

  @IsString()
  @MaxLength(16)
  prefAsset!: string;
}
