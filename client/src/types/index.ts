export interface Chain {
  id: string;
  name: string;
  subtitle: string;
  type: 'evm' | 'sui' | 'solana';
  chainId?: number;
  icon: string;
  color: string;
  nativeCurrency: string;
  explorerUrl: string;
  isPopular?: boolean;
  isTestnet?: boolean;
}

export interface RecipientInfo {
  query: string;
  displayName: string;
  handle?: string;
  address: string;
  avatar?: string;
  isValid: boolean;
  chainType?: 'evm' | 'sui' | 'solana';
}

export interface PaymentAsset {
  id: string;
  symbol: string;
  name: string;
  decimals: number;
  address?: string;
  icon: string;
  isNative?: boolean;
  chainId?: number;
  balance?: number;
  formattedBalance?: string;
}

export interface TransferQuote {
  amount: number; // Raw entered amount
  targetAmount: number; // Exact net amount recipient should receive
  protocolFee: number; // Flat $0.20 fee
  unipayShare: number; // $0.18 (90% to UniPay Treasury)
  circleShare: number; // $0.02 (10% to Circle)
  unipayFee: number; // $0.20
  circleFee: number; // $0.02
  cctpUpfrontFee: number; // Circle CCTP Fast Transfer / Relay Fee
  cctpRelayFee: number; // Authoritative forwarding/relay fee from Circle
  totalFees: number; // protocolFee + cctpRelayFee
  burnAmount: number; // Amount to burn on source to guarantee exact net delivery
  totalToPay: number; // targetAmount + totalFees
  amountReceived: number; // Exact net received (targetAmount)
  isExactNetGuaranteed: boolean; // True when Circle fee quote is verified
  sourceChain: Chain;
  destChain: Chain;
  estimatedTime: string;
  route: string;
  transferSpeed?: 'FAST' | 'STANDARD';
}


export type PipelineStageStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface PipelineStage {
  id: string;
  title: string;
  description: string;
  status: PipelineStageStatus;
  timestamp?: string;
}

export interface TransactionRecord {
  id: string;
  recipient: RecipientInfo;
  amount: number;
  token: string;
  fromChain: Chain;
  toChain: Chain;
  timestamp: string;
  txHash: string;
  destTxHash?: string;
  status: 'completed' | 'processing' | 'pending_destination_mint' | 'failed';
  unipayFee?: number;
  circleFee?: number;
  cctpUpfrontFee?: number;
  networkFee?: number;
  totalPaid: number;
  message?: string;
  attestation?: string;
  sourceDomain?: number;
  transferSpeed?: 'FAST' | 'STANDARD';
}

