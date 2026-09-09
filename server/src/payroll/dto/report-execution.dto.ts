import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsString, Matches, ValidateNested } from 'class-validator';

export class ExecutionResultDto {
  @IsString()
  itemId!: string;

  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'txHash must be a 32-byte hex hash' })
  txHash!: string;
}

export class ReportExecutionDto {
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ExecutionResultDto)
  results!: ExecutionResultDto[];
}
