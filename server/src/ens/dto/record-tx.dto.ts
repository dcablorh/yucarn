import { IsOptional, Matches } from 'class-validator';

const TX_HASH = /^0x[a-fA-F0-9]{64}$/;

export class RecordTxDto {
  @Matches(TX_HASH, { message: 'txHash must be a 32-byte hex hash' })
  txHash!: string;

  /** Present only when the records multicall was signed separately. */
  @IsOptional()
  @Matches(TX_HASH, { message: 'recordsTxHash must be a 32-byte hex hash' })
  recordsTxHash?: string;
}
