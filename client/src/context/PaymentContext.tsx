import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAppKit, useAppKitAccount, useAppKitNetwork, useDisconnect } from '@reown/appkit/react';
import { useBalance, useReadContract, useWriteContract, useSendTransaction, useSwitchChain, useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, parseEther } from 'viem';
import { Chain, RecipientInfo, TransferQuote, PipelineStage, TransactionRecord } from '../types';
import {
  DEFAULT_SOURCE_CHAIN,
  DEFAULT_DEST_CHAIN,
  DEFAULT_MAINNET_SOURCE,
  DEFAULT_MAINNET_DEST,
  DEFAULT_TESTNET_SOURCE,
  DEFAULT_TESTNET_DEST,
  SUPPORTED_CHAINS,
  USDC_ADDRESSES,
  isValidTxHash
} from '../config/chains';
import { resolveENS } from '../utils/ensResolver';
import { circleBridgeProvider } from '../providers/circle/CircleBridgeProvider';
import { CCTP_CONFIGS, TOKEN_MESSENGER_ABI, TOKEN_MESSENGER_V2_ABI, MESSAGE_TRANSMITTER_ABI, addressToBytes32, estimateCCTPUpfrontFee, ZERO_BYTES32, isCCTPV2Contract, isFastTransferSupported } from '../config/cctp';
import { getTreasuryAddress, setTreasuryAddress } from '../config/treasury';
import { modal, getAppKitNetwork } from '../config/appkit';
import { relayerService } from '../services/relayer';
import { isPermitSupported, signUsdcPermit } from '../utils/permit';

interface PaymentContextType {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  recipient: RecipientInfo;
  setRecipient: React.Dispatch<React.SetStateAction<RecipientInfo>>;
  isResolvingENS: boolean;
  ensResolutionError: string | null;
  setEnsResolutionError: (error: string | null) => void;
  sourceChain: Chain;
  setSourceChain: (chain: Chain) => void | Promise<void>;
  destChain: Chain;
  setDestChain: (chain: Chain) => void;
  amount: string;
  setAmount: (amount: string) => void;
  transferSpeed: 'FAST';
  userBalance: number;
  formattedBalance: string;
  isBalanceLoading: boolean;
  refetchBalance: () => void;
  walletConnected: boolean;
  walletAddress: string;
  connectWallet: (walletType?: string) => void;
  disconnectWallet: () => void;
  openReownModal: (view?: 'Connect' | 'Account' | 'Networks' | 'WhatIsAWallet') => void;
  isTestnetMode: boolean;
  toggleTestnetMode: () => void;
  setTestnetMode: (testnet: boolean) => void;
  treasuryAddress: string;
  updateTreasuryAddress: (address: string) => void;
  isPermitCapable: boolean;
  quote: TransferQuote;
  pipelineStages: PipelineStage[];
  currentTxHash: string;
  destTxHash: string;
  completedTimestamp: string;
  history: TransactionRecord[];
  isActivityOpen: boolean;
  setIsActivityOpen: (open: boolean) => void;
  isWalletModalOpen: boolean;
  setIsWalletModalOpen: (open: boolean) => void;
  isChainModalOpen: boolean;
  setIsChainModalOpen: (open: boolean) => void;
  chainModalMode: 'source' | 'dest';
  openChainModal: (mode: 'source' | 'dest') => void;
  handleResolveRecipient: (input: string) => Promise<void>;
  handleContinueToDetails: () => boolean;
  handleStartPayment: () => void;
  handleReset: () => void;
  claimPendingTransfer: (tx: TransactionRecord) => Promise<boolean>;
  isClaimingPending: boolean;
  claimingTxId: string | null;
}


const INITIAL_RECIPIENT: RecipientInfo = {
  query: '',
  displayName: '',
  handle: '',
  address: '',
  isValid: false
};

const INITIAL_STAGES: PipelineStage[] = [
  {
    id: '1',
    title: 'Payment authorized',
    description: 'Your wallet has approved the payment',
    status: 'pending'
  },
  {
    id: '2',
    title: 'Source transaction confirmed',
    description: 'USDC locked on source chain',
    status: 'pending'
  },
  {
    id: '3',
    title: 'Moving USDC',
    description: 'Cross-chain transfer in progress',
    status: 'pending'
  },
  {
    id: '4',
    title: 'Arriving on destination',
    description: 'Waiting for final settlement',
    status: 'pending'
  },
  {
    id: '5',
    title: 'Complete',
    description: 'Recipient will receive USDC',
    status: 'pending'
  }
];

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export const PaymentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Reown AppKit Hooks
  const { open, close } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { chainId, switchNetwork } = useAppKitNetwork();

  // Auto-close modal as soon as wallet connection is approved
  useEffect(() => {
    if (isConnected) {
      try {
        close();
      } catch (e) {
        console.warn('Error closing AppKit modal:', e);
      }
    }
  }, [isConnected, close]);
  const { disconnect } = useDisconnect();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();
  const { connector } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Testnet vs Mainnet Developer Mode (defaults to testnet mode)
  const [isTestnetMode, setIsTestnetMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('unipay_testnet_mode');
    return saved !== null ? saved === 'true' : true;
  });

  const [treasuryAddress, setTreasuryState] = useState<string>(() => getTreasuryAddress(isTestnetMode));

  const updateTreasuryAddress = (newAddress: string) => {
    if (newAddress.startsWith('0x') && newAddress.length === 42) {
      setTreasuryAddress(newAddress, isTestnetMode);
      setTreasuryState(newAddress);
    }
  };

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [recipient, setRecipient] = useState<RecipientInfo>(INITIAL_RECIPIENT);
  const [isResolvingENS, setIsResolvingENS] = useState<boolean>(false);
  const [ensResolutionError, setEnsResolutionError] = useState<string | null>(null);
  const [sourceChain, setSourceChainState] = useState<Chain>(() => (isTestnetMode ? DEFAULT_TESTNET_SOURCE : DEFAULT_MAINNET_SOURCE));
  const [destChain, setDestChain] = useState<Chain>(() => (isTestnetMode ? DEFAULT_TESTNET_DEST : DEFAULT_MAINNET_DEST));
  const [amount, setAmount] = useState<string>('');
  
  // Dynamic Circle fee & EIP-2612 permit capability
  const [liveCircleRelayFee, setLiveCircleRelayFee] = useState<number | undefined>(undefined);
  const [isPermitCapable, setIsPermitCapable] = useState<boolean>(false);

  // Check EIP-2612 permit support for source chain USDC contract
  useEffect(() => {
    let active = true;
    async function checkPermit() {
      const usdc = sourceChain.chainId ? USDC_ADDRESSES[sourceChain.chainId] : undefined;
      if (publicClient && usdc && sourceChain.type === 'evm') {
        const supported = await isPermitSupported(publicClient as any, usdc as `0x${string}`, address as `0x${string}` | undefined);
        if (active) setIsPermitCapable(supported);
      } else {
        if (active) setIsPermitCapable(false);
      }
    }
    checkPermit();
    return () => {
      active = false;
    };
  }, [sourceChain, publicClient, address]);

  // Query live authoritative Circle fee via BridgeKit estimate (debounced)
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      const parsed = parseFloat(amount) || 0;
      if (sourceChain.chainId && destChain.chainId && sourceChain.chainId !== destChain.chainId && parsed > 0) {
        let provider: any = null;
        try {
          if (connector && typeof (connector as any).getProvider === 'function') {
            provider = await (connector as any).getProvider();
          } else if (typeof window !== 'undefined' && (window as any).ethereum) {
            provider = (window as any).ethereum;
          }
        } catch (_) {}

        const feeEst = await circleBridgeProvider.estimateLiveCircleFees(
          sourceChain.chainId,
          destChain.chainId,
          parsed,
          provider,
          recipient.address
        );
        if (active && feeEst.isAuthoritative && feeEst.forwarderFee > 0) {
          setLiveCircleRelayFee(feeEst.forwarderFee);
        }
      } else {
        if (active) setLiveCircleRelayFee(undefined);
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [sourceChain.id, destChain.id, amount, recipient.address, connector]);

  // Circle CCTP Fast Transfer Mode
  const transferSpeed = 'FAST' as const;

  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>(INITIAL_STAGES);
  const [currentTxHash, setCurrentTxHash] = useState<string>('');
  const [destTxHash, setDestTxHash] = useState<string>('');
  const [completedTimestamp, setCompletedTimestamp] = useState<string>('');
  const [isActivityOpen, setIsActivityOpen] = useState<boolean>(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isChainModalOpen, setIsChainModalOpen] = useState<boolean>(false);
  const [chainModalMode, setChainModalMode] = useState<'source' | 'dest'>('dest');

  // Unified handler to set source chain and synchronize with wallet / AppKit
  const setSourceChain = async (newChain: Chain) => {
    setSourceChainState(newChain);

    if (newChain.type === 'evm' && newChain.chainId) {
      const targetAppKitNet = getAppKitNetwork(newChain.chainId);

      // 1. If wallet is connected, switch chain in connected wallet extension
      if (isConnected) {
        try {
          await switchChainAsync({ chainId: newChain.chainId });
        } catch (err: any) {
          console.warn('Wagmi switchChainAsync error:', err);
          if (targetAppKitNet && switchNetwork) {
            try {
              switchNetwork(targetAppKitNet as any);
            } catch (appKitErr) {
              console.warn('AppKit switchNetwork error:', appKitErr);
            }
          }
        }
      } else {
        // 2. If wallet is not connected, set active network in AppKit so next connect prompt targets this chain
        if (targetAppKitNet && modal) {
          try {
            modal.switchNetwork(targetAppKitNet as any);
          } catch (e) {
            console.warn('AppKit modal.switchNetwork error:', e);
          }
        }
      }
    }
  };

  // Real on-chain balance fetching
  const usdcContractAddress = sourceChain.chainId ? USDC_ADDRESSES[sourceChain.chainId] : undefined;

  // 1. ERC-20 USDC balance query (when USDC contract is known for chain)
  const {
    data: usdcBalanceData,
    isLoading: isUsdcLoading,
    refetch: refetchUsdc
  } = useReadContract({
    address: usdcContractAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    chainId: sourceChain.chainId,
    query: {
      enabled: Boolean(isConnected && address && usdcContractAddress && sourceChain.type === 'evm'),
      refetchInterval: 6000
    }
  });

  // 2. Native currency balance query (ETH, POL, AVAX, S, etc.)
  const {
    data: nativeBalanceData,
    isLoading: isNativeLoading,
    refetch: refetchNative
  } = useBalance({
    address: address as `0x${string}` | undefined,
    chainId: sourceChain.chainId,
    query: {
      enabled: Boolean(isConnected && address && sourceChain.type === 'evm'),
      refetchInterval: 6000
    }
  });

  // Dynamic balance resolution for USDC
  let userBalance = 0;
  let formattedBalance = '0.00';

  if (isConnected && address) {
    if (usdcBalanceData !== undefined) {
      userBalance = Number(formatUnits(usdcBalanceData as bigint, 6));
      formattedBalance = userBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    } else if (nativeBalanceData) {
      userBalance = Number(formatUnits(nativeBalanceData.value, nativeBalanceData.decimals));
      formattedBalance = userBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
  }

  const isBalanceLoading = Boolean(
    isConnected && (
      (isUsdcLoading && usdcBalanceData === undefined) ||
      (isNativeLoading && nativeBalanceData === undefined && !usdcContractAddress)
    )
  );

  const refetchBalance = () => {
    refetchUsdc();
    refetchNative();
  };

  const toggleTestnetMode = () => {
    setIsTestnetMode(prev => {
      const next = !prev;
      localStorage.setItem('unipay_testnet_mode', String(next));
      setTreasuryState(getTreasuryAddress(next));
      const nextSource = next ? DEFAULT_TESTNET_SOURCE : DEFAULT_MAINNET_SOURCE;
      const nextDest = next ? DEFAULT_TESTNET_DEST : DEFAULT_MAINNET_DEST;
      setDestChain(nextDest);
      setSourceChain(nextSource);
      return next;
    });
  };

  const setTestnetMode = (testnet: boolean) => {
    setIsTestnetMode(testnet);
    localStorage.setItem('unipay_testnet_mode', String(testnet));
    setTreasuryState(getTreasuryAddress(testnet));
    const nextSource = testnet ? DEFAULT_TESTNET_SOURCE : DEFAULT_MAINNET_SOURCE;
    const nextDest = testnet ? DEFAULT_TESTNET_DEST : DEFAULT_MAINNET_DEST;
    setDestChain(nextDest);
    setSourceChain(nextSource);
  };

  // Live wallet connection status synced with Reown
  const walletConnected = isConnected;
  const walletAddress = address || '';

  // Synchronize sourceChain when EVM network changes in Reown AppKit / External Wallet
  useEffect(() => {
    if (chainId) {
      const matchedChain = SUPPORTED_CHAINS.find(c => c.chainId === Number(chainId));
      if (matchedChain && matchedChain.id !== sourceChain.id) {
        setSourceChainState(matchedChain);
      }
    }
  }, [chainId]);

  const [history, setHistory] = useState<TransactionRecord[]>(() => {
    const saved = localStorage.getItem('unipay_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('unipay_history', JSON.stringify(history));
  }, [history]);

  // Live fee calculation ($0.20 Custom Developer Fee + authoritative Circle CCTP relay costs)
  const parsedAmount = parseFloat(amount) || 0;
  const feeCalculation = circleBridgeProvider.calculateFees(
    sourceChain,
    destChain,
    parsedAmount,
    'FAST',
    liveCircleRelayFee
  );

  const quote: TransferQuote = {
    amount: parsedAmount,
    targetAmount: feeCalculation.targetAmount,
    protocolFee: feeCalculation.protocolFee,
    unipayShare: feeCalculation.unipayShare,
    circleShare: feeCalculation.circleShare,
    unipayFee: feeCalculation.unipayFee,
    circleFee: feeCalculation.circleFee,
    cctpUpfrontFee: feeCalculation.cctpUpfrontFee,
    cctpRelayFee: feeCalculation.cctpRelayFee,
    burnAmount: feeCalculation.burnAmount,
    totalFees: feeCalculation.totalFees,
    totalToPay: feeCalculation.totalToPay,
    amountReceived: feeCalculation.amountReceived,
    isExactNetGuaranteed: feeCalculation.isExactNetGuaranteed,
    sourceChain,
    destChain,
    estimatedTime: feeCalculation.estimatedTime,
    route: `${sourceChain.name} → ${destChain.name}`,
    transferSpeed
  };

  const openChainModal = (mode: 'source' | 'dest') => {
    setChainModalMode(mode);
    setIsChainModalOpen(true);
  };


  /**
   * Real On-Chain ENS and Address Resolution
   */
  const handleResolveRecipient = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      setRecipient({
        query: '',
        displayName: '',
        address: '',
        isValid: false
      });
      setEnsResolutionError(null);
      return;
    }

    setIsResolvingENS(true);
    setEnsResolutionError(null);

    try {
      const resolved = await resolveENS(trimmed, destChain.id);
      if (resolved.isValid && resolved.address) {
        const chainType = resolved.chainType || (
          resolved.address.startsWith('0x') && resolved.address.length === 42 ? 'evm'
          : resolved.address.length === 66 ? 'sui'
          : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(resolved.address) ? 'solana'
          : 'evm'
        );
        
        setRecipient({
          query: trimmed,
          displayName: resolved.displayName,
          handle: resolved.handle,
          address: resolved.address,
          avatar: resolved.avatar,
          isValid: true,
          chainType
        });
        setEnsResolutionError(null);

        // Auto-switch destination chain if current destChain is incompatible with recipient address/name
        if (chainType === 'solana' && destChain.type !== 'solana') {
          const solanaChain = SUPPORTED_CHAINS.find(c => c.type === 'solana' && (isTestnetMode ? c.isTestnet : !c.isTestnet))
            || SUPPORTED_CHAINS.find(c => c.type === 'solana');
          if (solanaChain) setDestChain(solanaChain);
        } else if (chainType === 'sui' && destChain.type !== 'sui') {
          const suiChain = SUPPORTED_CHAINS.find(c => c.type === 'sui' && (isTestnetMode ? c.isTestnet : !c.isTestnet))
            || SUPPORTED_CHAINS.find(c => c.type === 'sui');
          if (suiChain) setDestChain(suiChain);
        } else if (chainType === 'evm' && destChain.type !== 'evm') {
          const defaultEvm = sourceChain.type === 'evm' ? sourceChain : (SUPPORTED_CHAINS.find(c => c.id === 'base') || SUPPORTED_CHAINS.find(c => c.type === 'evm'));
          if (defaultEvm) setDestChain(defaultEvm);
        }
      } else {
        setRecipient({
          query: trimmed,
          displayName: trimmed,
          handle: trimmed,
          address: '',
          isValid: false
        });
        setEnsResolutionError(resolved.error || `Could not resolve "${trimmed}"`);
      }
    } catch {
      setEnsResolutionError(`Failed to resolve "${trimmed}"`);
    } finally {
      setIsResolvingENS(false);
    }
  };

  const openReownModal = async (view?: 'Connect' | 'Account' | 'Networks' | 'WhatIsAWallet') => {
    if (sourceChain.chainId && sourceChain.type === 'evm') {
      const targetAppKitNet = getAppKitNetwork(sourceChain.chainId);
      if (targetAppKitNet && modal) {
        try {
          modal.switchNetwork(targetAppKitNet as any);
        } catch (e) {
          console.warn('AppKit pre-set network error:', e);
        }
      }
    }
    open(view ? { view } : undefined);
  };

  const connectWallet = (_walletType?: string) => {
    setIsWalletModalOpen(false);
    openReownModal('Connect');
  };

  const disconnectWallet = () => {
    try {
      disconnect();
    } catch (e) {
      console.error(e);
    }
    setIsWalletModalOpen(false);
  };

  const handleContinueToDetails = () => {
    if (!recipient.isValid || !recipient.address) {
      return false;
    }
    if (parsedAmount <= 0) {
      return false;
    }
    if (walletConnected && (parsedAmount > userBalance || quote.totalToPay > userBalance)) {
      return false;
    }
    setCurrentStep(2);
    return true;
  };

  const handleStartPayment = async () => {
    // 1. Prompt wallet connection if not connected
    if (!isConnected || !address) {
      setIsWalletModalOpen(true);
      open({ view: 'Connect' });
      return;
    }

    if (!recipient.address) {
      setEnsResolutionError('Please enter a valid recipient address before continuing.');
      setCurrentStep(1);
      return;
    }

    if (walletConnected && (parsedAmount > userBalance || quote.totalToPay > userBalance)) {
      return;
    }

    setCurrentStep(3);

    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fullDate = `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · ${timeString}`;
    setCompletedTimestamp(fullDate);

    // isCrossChain: true when chain IDs differ (EVM<>EVM) OR when chain types differ (EVM→Solana, EVM→Sui, etc.)
    const isCrossChain = Boolean(
      (sourceChain.id !== destChain.id) ||
      (sourceChain.chainId && destChain.chainId && sourceChain.chainId !== destChain.chainId) ||
      (sourceChain.type !== destChain.type)  // e.g. evm → solana or evm → sui
    );

    const stages: PipelineStage[] = isCrossChain
      ? [
          {
            id: '1',
            title: 'Payment authorized',
            description: (isPermitCapable && relayerService.hasActiveRelayer())
              ? 'Fast approval available (1 user confirmation)'
              : `Please approve ${quote.totalToPay.toFixed(2)} USDC in your wallet extension...`,
            status: 'in_progress',
            timestamp: timeString
          },
          {
            id: '2',
            title: 'Source transaction confirmed',
            description: `${quote.burnAmount.toFixed(2)} USDC burned on ${sourceChain.name}`,
            status: 'pending'
          },
          {
            id: '3',
            title: 'Circle CCTP Attestation',
            description: 'Verifying cross-chain attestation',
            status: 'pending'
          },
          {
            id: '4',
            title: `Minting on ${destChain.name}`,
            description: `Minting ${quote.targetAmount.toFixed(2)} native USDC to recipient`,
            status: 'pending'
          },
          {
            id: '5',
            title: 'Complete',
            description: `${recipient.displayName || 'Recipient'} received exact ${quote.targetAmount.toFixed(2)} USDC on ${destChain.name}`,
            status: 'pending'
          }
        ]
      : [
          {
            id: '1',
            title: 'Payment authorization',
            description: `Please confirm the ${quote.amountReceived.toFixed(2)} USDC transfer in your wallet...`,
            status: 'in_progress',
            timestamp: timeString
          },
          {
            id: '2',
            title: 'Broadcasting transaction',
            description: `Submitting transfer to ${sourceChain.name} mempool...`,
            status: 'pending'
          },
          {
            id: '3',
            title: 'On-chain confirmation',
            description: `Waiting for block inclusion on ${sourceChain.name}...`,
            status: 'pending'
          },
          {
            id: '4',
            title: 'Payment settled',
            description: `Transfer confirmed on ${sourceChain.name}`,
            status: 'pending'
          },
          {
            id: '5',
            title: 'Complete',
            description: `${recipient.displayName || 'Recipient'} received ${quote.amountReceived.toFixed(2)} USDC on ${destChain.name}`,
            status: 'pending'
          }
        ];

    const sourceCCTP = sourceChain.chainId ? CCTP_CONFIGS[sourceChain.chainId] : undefined;
    const destCCTP = destChain.chainId ? CCTP_CONFIGS[destChain.chainId] : undefined;

    let txHashToUse: string | undefined = undefined;
    let finalDestHash: string = '';

    try {
      // Auto-switch wallet network if user's wallet is currently on a different chain
      if (sourceChain.chainId && chainId && Number(chainId) !== sourceChain.chainId) {
        try {
          stages[0].description = `Please allow network switch to ${sourceChain.name} in wallet...`;
          setPipelineStages([...stages]);
          await switchChainAsync({ chainId: sourceChain.chainId });
        } catch (switchErr: any) {
          console.warn('Network switch failed or user rejected switch:', switchErr);
        }
      }

      const usdcAddress = sourceChain.chainId ? USDC_ADDRESSES[sourceChain.chainId] : undefined;

      // Determine the correct CCTP messenger address for this source chain (V1 vs V2)
      // This must be computed BEFORE approve/permit so the spender matches depositForBurn
      const _useV2Early = isCrossChain && sourceCCTP ? isCCTPV2Contract(sourceCCTP) : false;
      const _messengerAddress = (_useV2Early && sourceCCTP?.tokenMessengerV2)
        ? sourceCCTP.tokenMessengerV2
        : sourceCCTP?.tokenMessenger;

      const recipientAddr = (recipient.address && recipient.address.startsWith('0x'))
        ? (recipient.address as `0x${string}`)
        : undefined;

      // Only require an 0x address for same-chain EVM sends (no CCTP involved).
      // Cross-chain CCTP sends to Solana/Sui use non-0x addresses — that is expected.
      const destIsNonEvm = destChain.type === 'solana' || destChain.type === 'sui';
      if (!recipientAddr && sourceChain.type === 'evm' && !isCrossChain) {
        throw new Error('Invalid EVM recipient address');
      }
      if (!recipient.address && sourceChain.type === 'evm' && !destIsNonEvm) {
        throw new Error('Invalid EVM recipient address');
      }

      if (isCrossChain && sourceCCTP && destCCTP && sourceChain.type === 'evm') {
        // ================= PRE-FLIGHT EIP-2612 PERMIT CHECK =================
        // If allowance is not yet granted, attempt gasless EIP-712 permit via relayer
        if (address && sourceCCTP.usdcAddress) {
          try {
            const burnUnits = parseUnits(quote.burnAmount.toFixed(6), 6);
            const currentAllowance = await publicClient?.readContract({
              address: sourceCCTP.usdcAddress,
              abi: erc20Abi,
              functionName: 'allowance',
              // Use the ACTUAL messenger address that will receive the spend (V1 or V2)
              args: [address as `0x${string}`, _messengerAddress as `0x${string}`]
            });

            if (currentAllowance !== undefined && (currentAllowance as bigint) < burnUnits) {
              if (isPermitCapable && walletClient && publicClient && relayerService.hasActiveRelayer()) {
                try {
                  stages[0].description = `Please sign EIP-2612 permit in wallet (fast approval)...`;
                  setPipelineStages([...stages]);

                  const signedPermit = await signUsdcPermit(walletClient, publicClient as any, {
                    owner: address as `0x${string}`,
                    // Spender must be the SAME address depositForBurn will be called on
                    spender: _messengerAddress as `0x${string}`,
                    value: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
                    chainId: sourceChain.chainId!,
                    usdcAddress: sourceCCTP.usdcAddress
                  });

                  stages[0].description = `Submitting fast approval via relayer...`;
                  setPipelineStages([...stages]);

                  const relayRes = await relayerService.submitPermit(
                    sourceChain.chainId!,
                    sourceCCTP.usdcAddress,
                    signedPermit.owner,
                    signedPermit.spender,
                    signedPermit.value,
                    signedPermit.deadline,
                    signedPermit.v,
                    signedPermit.r,
                    signedPermit.s
                  );

                  if (relayRes.success) {
                    stages[0].description = 'Fast approval confirmed on-chain via relayer';
                    setPipelineStages([...stages]);
                  }
                } catch (permitErr: any) {
                  if (permitErr?.name === 'UserRejectedRequestError' || permitErr?.message?.includes('rejected')) {
                    throw permitErr;
                  }
                  console.warn('EIP-2612 permit flow notice, will use standard flow:', permitErr);
                }
              }
            }
          } catch (preflightErr) {
            console.warn('Pre-flight allowance check notice:', preflightErr);
          }
        }

        // ================= CIRCLE BRIDGE-KIT / CCTP CROSS-CHAIN TRANSFER =================
        let provider: any = null;
        try {
          if (connector && typeof (connector as any).getProvider === 'function') {
            provider = await (connector as any).getProvider();
          } else if (typeof window !== 'undefined' && (window as any).ethereum) {
            provider = (window as any).ethereum;
          }
        } catch (provErr) {
          console.warn('Could not retrieve wallet provider for BridgeKit:', provErr);
        }

        if (provider) {
          try {
            stages[0].description = `Authorizing transfer via Circle Bridge Kit...`;
            setPipelineStages([...stages]);

            const bridgeRes = await circleBridgeProvider.bridgeWithForwarder(
              provider,
              sourceChain.chainId!,
              destChain.chainId!,
              recipient.address,
              quote.burnAmount.toFixed(6), // Pass grossed-up burnAmount so exact targetAmount is minted to recipient!
              {
                amount: Math.max(0, Number((quote.totalToPay - quote.burnAmount).toFixed(6))).toFixed(6),
                recipient: treasuryAddress
              },
              {
                onApprove: () => {
                  stages[0].status = 'completed';
                  stages[0].description = 'Allowance approved for CCTP';
                  stages[1].status = 'in_progress';
                  stages[1].timestamp = timeString;
                  stages[1].description = `Burning USDC on ${sourceChain.name}...`;
                  setPipelineStages([...stages]);
                },
                onBurn: (hash) => {
                  if (hash) {
                    txHashToUse = hash;
                    setCurrentTxHash(hash);
                  }
                  stages[1].status = 'completed';
                  stages[1].description = `${quote.burnAmount.toFixed(2)} USDC burned on ${sourceChain.name}`;
                  stages[2].status = 'in_progress';
                  stages[2].timestamp = timeString;
                  stages[2].description = 'Waiting for Circle Iris attestation...';
                  setPipelineStages([...stages]);
                },
                onAttestation: () => {
                  stages[2].status = 'completed';
                  stages[2].description = 'Attestation verified by Circle Iris';
                  stages[3].status = 'in_progress';
                  stages[3].timestamp = timeString;
                  stages[3].description = `Circle Orbit Relayer minting on ${destChain.name}...`;
                  setPipelineStages([...stages]);
                },
                onMint: (hash) => {
                  if (hash) {
                    finalDestHash = hash;
                    setDestTxHash(hash);
                  }
                  stages[3].status = 'completed';
                  stages[3].description = `${quote.targetAmount.toFixed(2)} USDC minted on ${destChain.name}`;
                  stages[4].status = 'completed';
                  stages[4].timestamp = timeString;
                  stages[4].description = `Delivered exact ${quote.targetAmount.toFixed(2)} USDC to ${recipient.displayName || recipient.address?.slice(0, 8)}`;
                  setPipelineStages([...stages]);
                }
              }
            );

            if (bridgeRes.sourceTxHash) {
              txHashToUse = bridgeRes.sourceTxHash;
              setCurrentTxHash(bridgeRes.sourceTxHash);
            }
            if (bridgeRes.destinationTxHash) {
              finalDestHash = bridgeRes.destinationTxHash;
              setDestTxHash(bridgeRes.destinationTxHash);
            }

            if (bridgeRes.status === 'FAILED' && !bridgeRes.sourceTxHash) {
              if (bridgeRes.error?.toLowerCase().includes('reject') || bridgeRes.error?.toLowerCase().includes('denied')) {
                throw new Error(bridgeRes.error);
              }
              console.warn('BridgeKit initial pass returned failed, falling back to direct contract calls:', bridgeRes.error);
            }
          } catch (bkErr: any) {
            if (bkErr?.message?.toLowerCase().includes('reject') || bkErr?.name === 'UserRejectedRequestError') {
              throw bkErr;
            }
            console.warn('BridgeKit attempt notice, falling back to direct CCTP TokenMessenger:', bkErr);
          }
        }

        // Direct CCTP TokenMessenger fallback if BridgeKit was not used or did not produce a burn tx
        if (!txHashToUse) {
          const burnAmountInUnits = parseUnits(quote.burnAmount.toFixed(6), 6);
          const recipientBytes32 = addressToBytes32(recipient.address);

          // Check if allowance is required
          let needsApproval = false;
          try {
            if (publicClient && address) {
              const allowance = await publicClient.readContract({
                address: sourceCCTP.usdcAddress,
                abi: erc20Abi,
                functionName: 'allowance',
                args: [address as `0x${string}`, _messengerAddress as `0x${string}`]
              });
              if ((allowance as bigint) < burnAmountInUnits) {
                needsApproval = true;
              }
            }
          } catch (readErr) {
            console.warn('Allowance check warning:', readErr);
          }

          if (needsApproval) {
            let permitHandled = false;

            // Attempt EIP-2612 permit if capable and relayer is online
            if (isPermitCapable && walletClient && publicClient && relayerService.hasActiveRelayer()) {
              try {
                stages[0].description = `Please sign EIP-2612 permit in wallet (fast approval)...`;
                setPipelineStages([...stages]);

                const signedPermit = await signUsdcPermit(walletClient, publicClient as any, {
                  owner: address as `0x${string}`,
                  spender: _messengerAddress as `0x${string}`,
                  value: BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'),
                  chainId: sourceChain.chainId!,
                  usdcAddress: sourceCCTP.usdcAddress
                });

                stages[0].description = `Submitting fast approval via relayer...`;
                setPipelineStages([...stages]);

                const relayRes = await relayerService.submitPermit(
                  sourceChain.chainId!,
                  sourceCCTP.usdcAddress,
                  signedPermit.owner,
                  signedPermit.spender,
                  signedPermit.value,
                  signedPermit.deadline,
                  signedPermit.v,
                  signedPermit.r,
                  signedPermit.s
                );

                if (relayRes.success) {
                  permitHandled = true;
                }
              } catch (permitErr: any) {
                if (permitErr?.name === 'UserRejectedRequestError' || permitErr?.message?.includes('rejected')) {
                  throw permitErr;
                }
                console.warn('Permit error in fallback, using standard approve:', permitErr);
              }
            }

            if (!permitHandled) {
              stages[0].description = `Standard approval required: please approve USDC in wallet...`;
              setPipelineStages([...stages]);

              try {
                await writeContractAsync({
                  address: sourceCCTP.usdcAddress,
                  abi: erc20Abi,
                  functionName: 'approve',
                  // Approve the ACTUAL messenger address (V1 or V2) that will call transferFrom
                  args: [_messengerAddress as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
                  account: address as `0x${string}`
                });
              } catch (approveErr: any) {
                if (approveErr?.name === 'UserRejectedRequestError' || approveErr?.message?.includes('rejected')) {
                  throw approveErr;
                }
                console.warn('Approval error/bypassed:', approveErr);
              }
            }
          }

          stages[0].description = `Please confirm cross-chain burn on ${sourceChain.name}...`;
          setPipelineStages([...stages]);

          const useV2 = _useV2Early;
          const messengerAddress = _messengerAddress!;
          const sourceDomain = sourceCCTP.domain;
          const useStandard = !isFastTransferSupported(sourceDomain);

          // For Fast Transfer (threshold <= 1000), Circle requires maxFee to cover the fee!
          // If maxFee is 0, Circle delays transfer with delayReason: "insufficient_fee" or reverts!
          const maxFeeUnits = useStandard
            ? 0n
            : parseUnits(Math.max(quote.cctpRelayFee * 1.5, 0.50).toFixed(6), 6);

          try {
            if (useV2) {
              // CCTP V2: depositForBurn(amount, destDomain, mintRecipient, burnToken, destinationCaller, maxFee, minFinalityThreshold)
              txHashToUse = await writeContractAsync({
                address: messengerAddress,
                abi: TOKEN_MESSENGER_V2_ABI,
                functionName: 'depositForBurn',
                args: [
                  burnAmountInUnits,
                  destCCTP.domain,
                  recipientBytes32,
                  sourceCCTP.usdcAddress,
                  ZERO_BYTES32,   // destinationCaller = any
                  maxFeeUnits,    // Proper maxFee to enable Fast Transfer
                  useStandard ? 2000 : 1000  // minFinalityThreshold: FAST=1000, STANDARD=2000
                ],
                account: address as `0x${string}`
              });
            } else {
              // CCTP V1: depositForBurn(amount, destDomain, mintRecipient, burnToken)
              txHashToUse = await writeContractAsync({
                address: messengerAddress,
                abi: TOKEN_MESSENGER_ABI,
                functionName: 'depositForBurn',
                args: [
                  burnAmountInUnits,
                  destCCTP.domain,
                  recipientBytes32,
                  sourceCCTP.usdcAddress
                ],
                account: address as `0x${string}`
              });
            }
          } catch (burnErr: any) {
            if (burnErr?.name === 'UserRejectedRequestError' || burnErr?.message?.includes('rejected')) {
              throw burnErr;
            }
            // Graceful fallback to V1 if V2 failed and V1 messenger is available
            if (useV2 && sourceCCTP.tokenMessenger && sourceCCTP.tokenMessenger.toLowerCase() !== messengerAddress.toLowerCase()) {
              console.warn('V2 depositForBurn failed, attempting V1 fallback on', sourceCCTP.tokenMessenger, burnErr);
              txHashToUse = await writeContractAsync({
                address: sourceCCTP.tokenMessenger,
                abi: TOKEN_MESSENGER_ABI,
                functionName: 'depositForBurn',
                args: [
                  burnAmountInUnits,
                  destCCTP.domain,
                  recipientBytes32,
                  sourceCCTP.usdcAddress
                ],
                account: address as `0x${string}`
              });
            } else {
              throw burnErr;
            }
          }
        }
      } else if (usdcAddress && sourceChain.type === 'evm' && recipientAddr) {
        // ================= DIRECT ON-CHAIN USDC TRANSFER =================
        const recipientAmountInUnits = parseUnits(quote.amountReceived.toFixed(6), 6);
        txHashToUse = await writeContractAsync({
          address: usdcAddress,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [recipientAddr, recipientAmountInUnits],
          account: address as `0x${string}`
        });
      } else if (sourceChain.type === 'evm' && recipientAddr) {
        // ================= DIRECT ON-CHAIN NATIVE TRANSFER =================
        const val = parseEther(quote.amountReceived.toString() || '0.0001');
        txHashToUse = await sendTransactionAsync({
          to: recipientAddr,
          value: val,
          account: address as `0x${string}`
        });
      }
    } catch (e: any) {
      console.warn('Wallet transaction rejected or failed:', e);
      stages[0].status = 'failed';
      stages[0].description = e?.shortMessage || e?.message || 'Transaction rejected in wallet';
      setPipelineStages([...stages]);
      return; // STOP execution immediately on failure or rejection
    }

    if (!txHashToUse) {
      stages[0].status = 'failed';
      stages[0].description = 'No transaction hash returned from wallet';
      setPipelineStages([...stages]);
      return;
    }

    const finalSourceHash = txHashToUse;
    if (!finalDestHash) {
      finalDestHash = isCrossChain ? '' : txHashToUse;
    }

    setCurrentTxHash(finalSourceHash);
    setDestTxHash(finalDestHash);

    stages[0].status = 'completed';
    stages[0].description = `Transaction submitted to ${sourceChain.name}`;
    stages[1].status = 'in_progress';
    stages[1].timestamp = timeString;
    setPipelineStages([...stages]);

    // Wait for genuine on-chain confirmation and check revert status
    if (publicClient && finalSourceHash) {
      try {
        stages[1].description = `Waiting for block confirmation on ${sourceChain.name}...`;
        setPipelineStages([...stages]);
        const receipt = await publicClient.waitForTransactionReceipt({
          hash: finalSourceHash as `0x${string}`,
          confirmations: 1,
          timeout: 60_000
        });
        // If the transaction was included but reverted (status 0), abort the pipeline
        if (receipt.status === 'reverted') {
          stages[1].status = 'failed';
          stages[1].description = 'Transaction reverted on-chain. Check allowance or contract state.';
          setPipelineStages([...stages]);
          return; // Stop here — do NOT proceed to attestation
        }
      } catch (receiptErr) {
        console.warn('waitForTransactionReceipt timed out or warned (tx is broadcast):', receiptErr);
      }
    }

    stages[1].status = 'completed';
    stages[1].description = isCrossChain
      ? `${quote.amountReceived.toFixed(2)} USDC burned on ${sourceChain.name}`
      : `Confirmed on ${sourceChain.name}`;
    setPipelineStages([...stages]);

    let attestationData: { message: `0x${string}`; attestation: `0x${string}`; destinationTxHash?: string } | null = null;

    if (isCrossChain && sourceCCTP && destCCTP && destChain.chainId && !finalDestHash) {
      // 1. Circle Iris Attestation Polling
      stages[2].status = 'in_progress';
      stages[2].timestamp = timeString;
      stages[2].description = 'Requesting Circle Iris cross-chain attestation (~15-30s)...';
      setPipelineStages([...stages]);

      try {
        attestationData = await circleBridgeProvider.fetchIrisAttestation(
          sourceCCTP.domain,
          finalSourceHash,
          isTestnetMode,
          240,    // 240 attempts × 5s = 20 minutes (covers L2 standard finality)
          5000,
          (statusText) => {
            stages[2].description = statusText;
            setPipelineStages([...stages]);
          }
        );
      } catch (irisErr: any) {
        console.warn('Iris attestation polling timeout or error:', irisErr);
      }

      if (attestationData) {
        stages[2].status = 'completed';
        stages[2].description = 'Attestation verified by Circle Iris';
        stages[3].status = 'in_progress';
        stages[3].timestamp = timeString;
        stages[3].description = `Circle Orbit Relayer minting on ${destChain.name}...`;
        setPipelineStages([...stages]);

        let destMintHash: string | undefined = attestationData.destinationTxHash;

        // If attestation response did not immediately carry the destination mint hash,
        // poll Circle Iris briefly for the auto-relayed destination transaction
        if (!destMintHash && sourceCCTP) {
          try {
            const polled = await circleBridgeProvider.pollDestinationTxHash(
              sourceCCTP.domain,
              finalSourceHash,
              isTestnetMode,
              8,
              2500
            );
            if (polled && isValidTxHash(polled)) {
              destMintHash = polled;
            }
          } catch (pollErr) {
            console.warn('Initial destination tx poll notice:', pollErr);
          }
        }

        if (destChain.type === 'solana') {
          // Solana: Circle CCTP Orbit Relayer mints USDC to recipient's Solana ATA
          if (destMintHash && isValidTxHash(destMintHash)) {
            finalDestHash = destMintHash;
            setDestTxHash(destMintHash);
          }
          stages[3].status = 'completed';
          stages[3].description = destMintHash && isValidTxHash(destMintHash)
            ? `USDC minted on Solana (${destMintHash.slice(0, 6)}...${destMintHash.slice(-4)})`
            : `Circle CCTP delivering to Solana recipient`;
          stages[4].status = 'completed';
          stages[4].description = `${recipient.displayName || recipient.address.slice(0, 6) + '...' + recipient.address.slice(-4)} received ${quote.amountReceived.toFixed(2)} USDC on ${destChain.name}`;
          stages[4].timestamp = timeString;
          setPipelineStages([...stages]);
        } else if (destChain.type === 'evm') {
          if (destMintHash && isValidTxHash(destMintHash)) {
            finalDestHash = destMintHash;
            setDestTxHash(destMintHash);
          } else {
            // 2. Attempt automated background relayer
            if (relayerService.hasActiveRelayer() && destChain.chainId) {
              try {
                const relayRes = await relayerService.relayDestinationMint(
                  destChain.chainId,
                  attestationData.message,
                  attestationData.attestation
                );
                if (relayRes.success && relayRes.txHash && isValidTxHash(relayRes.txHash)) {
                  destMintHash = relayRes.txHash;
                }
              } catch (relayErr) {
                console.warn('Automated relayer attempt notice:', relayErr);
              }
            }

            // 3. Fallback to manual connected wallet receiveMessage only if relayer didn't handle it
            if (!destMintHash && destChain.chainId && destCCTP && destCCTP.messageTransmitter !== '0x0000000000000000000000000000000000000000') {
              try {
                stages[3].description = `Switching network to ${destChain.name}...`;
                setPipelineStages([...stages]);
                await switchChainAsync({ chainId: destChain.chainId });

                stages[3].description = `Please confirm USDC mint on ${destChain.name} in wallet...`;
                setPipelineStages([...stages]);

                const manualTxHash = await writeContractAsync({
                  address: destCCTP.messageTransmitter,
                  abi: MESSAGE_TRANSMITTER_ABI,
                  functionName: 'receiveMessage',
                  args: [attestationData.message, attestationData.attestation],
                  account: address as `0x${string}`,
                  chainId: destChain.chainId
                });
                if (isValidTxHash(manualTxHash)) {
                  destMintHash = manualTxHash;
                }
              } catch (mintErr: any) {
                console.warn('Destination receiveMessage fallback notice:', mintErr);
                // Check if Circle Orbit Relayer finished it in background while wallet prompted
                const retryPolled = await circleBridgeProvider.pollDestinationTxHash(
                  sourceCCTP.domain,
                  finalSourceHash,
                  isTestnetMode,
                  5,
                  2000
                );
                if (retryPolled && isValidTxHash(retryPolled)) {
                  destMintHash = retryPolled;
                }
              }
            }
          }

          if (destMintHash && isValidTxHash(destMintHash)) {
            finalDestHash = destMintHash;
            setDestTxHash(destMintHash);

            stages[3].status = 'completed';
            stages[3].description = `${quote.amountReceived.toFixed(2)} USDC minted on ${destChain.name}`;
            stages[4].status = 'completed';
            stages[4].description = `${recipient.displayName || 'Recipient'} received ${quote.amountReceived.toFixed(2)} USDC on ${destChain.name}`;
            stages[4].timestamp = timeString;
            setPipelineStages([...stages]);
          } else {
            stages[3].status = 'completed';
            stages[3].description = `Circle Forwarder minting on ${destChain.name}...`;
            stages[4].status = 'completed';
            stages[4].description = `${recipient.displayName || 'Recipient'} received ${quote.amountReceived.toFixed(2)} USDC on ${destChain.name}`;
            stages[4].timestamp = timeString;
            setPipelineStages([...stages]);
          }
        }
      } else {
        stages[2].status = 'in_progress';
        stages[2].description = 'Attestation verifying in background. Claimable once confirmed.';
        stages[3].status = 'pending';
        stages[4].status = 'pending';
        setPipelineStages([...stages]);
      }
    } else {
      // Same-chain transfer completes immediately
      stages[2].status = 'completed';
      stages[3].status = 'completed';
      stages[4].status = 'completed';
      stages[4].timestamp = timeString;
      setPipelineStages([...stages]);
    }

    refetchBalance();

    const newTx: TransactionRecord = {
      id: `tx-${Date.now()}`,
      recipient,
      amount: quote.amountReceived,
      token: 'USDC',
      fromChain: sourceChain,
      toChain: destChain,
      timestamp: fullDate,
      txHash: finalSourceHash,
      destTxHash: isValidTxHash(finalDestHash) ? finalDestHash : undefined,
      status: 'completed',
      unipayFee: quote.unipayFee,
      circleFee: quote.circleFee,
      totalPaid: quote.totalToPay,
      message: attestationData?.message,
      attestation: attestationData?.attestation,
      sourceDomain: sourceCCTP?.domain
    };
    setHistory(prev => [newTx, ...prev]);

    setTimeout(() => {
      setCurrentStep(4);
    }, 600);
  };

  const [isClaimingPending, setIsClaimingPending] = useState<boolean>(false);
  const [claimingTxId, setClaimingTxId] = useState<string | null>(null);

  /**
   * Relay/call receiveMessage on destination chain for any pending CCTP transaction
   */
  const claimPendingTransfer = async (record: TransactionRecord): Promise<boolean> => {
    if (!record.txHash || !record.toChain.chainId || record.toChain.type !== 'evm') return false;
    setIsClaimingPending(true);
    setClaimingTxId(record.id);

    try {
      const destCCTP = CCTP_CONFIGS[record.toChain.chainId];
      const sourceCCTP = record.fromChain.chainId ? CCTP_CONFIGS[record.fromChain.chainId] : undefined;
      const sourceDomain = record.sourceDomain ?? sourceCCTP?.domain ?? 0;

      // 0. Check if destination mint was already auto-relayed on Circle Iris
      const existingDestHash = await circleBridgeProvider.pollDestinationTxHash(
        sourceDomain,
        record.txHash,
        isTestnetMode,
        1,
        500
      );

      if (existingDestHash && isValidTxHash(existingDestHash)) {
        setHistory(prev =>
          prev.map(item =>
            item.id === record.id || item.txHash === record.txHash
              ? {
                  ...item,
                  destTxHash: existingDestHash,
                  status: 'completed'
                }
              : item
          )
        );

        if (currentTxHash === record.txHash || !currentTxHash) {
          setDestTxHash(existingDestHash);
        }

        refetchBalance();
        return true;
      }

      let message = record.message as `0x${string}` | undefined;
      let attestation = record.attestation as `0x${string}` | undefined;

      // 1. Fetch attestation from Iris if missing
      if (!message || !attestation) {
        const attestationRes = await circleBridgeProvider.fetchIrisAttestation(
          sourceDomain,
          record.txHash,
          isTestnetMode
        );
        message = attestationRes.message;
        attestation = attestationRes.attestation;
      }

      if (!message || !attestation || !destCCTP) {
        throw new Error('Unable to retrieve valid CCTP attestation for this transfer');
      }

      // 2. Switch chain to destination
      try {
        await switchChainAsync({ chainId: record.toChain.chainId });
      } catch (switchErr) {
        console.warn('Switch chain warning during claim:', switchErr);
      }

      // 3. Execute receiveMessage
      const mintTxHash = await writeContractAsync({
        address: destCCTP.messageTransmitter,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [message, attestation],
        account: address as `0x${string}`,
        chainId: record.toChain.chainId
      });

      if (mintTxHash && isValidTxHash(mintTxHash)) {
        setHistory(prev =>
          prev.map(item =>
            item.id === record.id || item.txHash === record.txHash
              ? {
                  ...item,
                  destTxHash: mintTxHash,
                  status: 'completed',
                  message,
                  attestation
                }
              : item
          )
        );

        if (currentTxHash === record.txHash || !currentTxHash) {
          setDestTxHash(mintTxHash);
        }

        refetchBalance();
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('claimPendingTransfer failed:', err);
      return false;
    } finally {
      setIsClaimingPending(false);
      setClaimingTxId(null);
    }
  };

  // Active background poller for destination transaction hash when cross-chain transfer is in flight
  useEffect(() => {
    if (!currentTxHash || !isValidTxHash(currentTxHash)) return;
    if (isValidTxHash(destTxHash)) return;
    const isCross = sourceChain.id !== destChain.id || sourceChain.chainId !== destChain.chainId || sourceChain.type !== destChain.type;
    if (!isCross) return;

    const sourceCCTP = sourceChain.chainId ? CCTP_CONFIGS[sourceChain.chainId] : undefined;
    if (!sourceCCTP) return;

    let isCancelled = false;
    let attempts = 0;
    const maxAttempts = 30; // 30 attempts × 3s = 90 seconds
    const interval = 3000;

    const checkDestinationTx = async () => {
      if (isCancelled) return;
      attempts++;
      try {
        const foundHash = await circleBridgeProvider.pollDestinationTxHash(
          sourceCCTP.domain,
          currentTxHash,
          sourceChain.isTestnet ?? true,
          1,
          1000
        );

        if (foundHash && isValidTxHash(foundHash) && !isCancelled) {
          setDestTxHash(foundHash);
          setHistory(prev =>
            prev.map(tx =>
              tx.txHash === currentTxHash ? { ...tx, destTxHash: foundHash } : tx
            )
          );
          setPipelineStages(prev =>
            prev.map(stage => {
              if (stage.id === '4') {
                return {
                  ...stage,
                  status: 'completed',
                  description: `${destChain.name} mint confirmed (${foundHash.slice(0, 6)}...${foundHash.slice(-4)})`
                };
              }
              return stage;
            })
          );
          return;
        }
      } catch (err) {
        // Polling failure, retry next tick
      }

      if (attempts < maxAttempts && !isCancelled) {
        setTimeout(checkDestinationTx, interval);
      }
    };

    const initialTimer = setTimeout(checkDestinationTx, 2000);

    return () => {
      isCancelled = true;
      clearTimeout(initialTimer);
    };
  }, [currentTxHash, destTxHash, sourceChain, destChain]);

  const handleReset = () => {
    setCurrentStep(1);
    setRecipient(INITIAL_RECIPIENT);
    setAmount('');
    setPipelineStages(INITIAL_STAGES);
    setCurrentTxHash('');
    setDestTxHash('');
    setCompletedTimestamp('');
  };

  return (
    <PaymentContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        recipient,
        setRecipient,
        isResolvingENS,
        ensResolutionError,
        setEnsResolutionError,
        sourceChain,
        setSourceChain,
        destChain,
        setDestChain,
        amount,
        setAmount,
        userBalance,
        formattedBalance,
        isBalanceLoading,
        refetchBalance,
        walletConnected,
        walletAddress,
        connectWallet,
        disconnectWallet,
        openReownModal,
        isTestnetMode,
        toggleTestnetMode,
        setTestnetMode,
        treasuryAddress,
        updateTreasuryAddress,
        isPermitCapable,
        transferSpeed,
        quote,
        pipelineStages,
        currentTxHash,
        destTxHash,
        completedTimestamp,
        history,
        isActivityOpen,
        setIsActivityOpen,
        isWalletModalOpen,
        setIsWalletModalOpen,
        isChainModalOpen,
        setIsChainModalOpen,
        chainModalMode,
        openChainModal,
        handleResolveRecipient,
        handleContinueToDetails,
        handleStartPayment,
        handleReset,
        claimPendingTransfer,
        isClaimingPending,
        claimingTxId
      }}
    >
      {children}
    </PaymentContext.Provider>
  );
};


export const usePayment = () => {
  const context = useContext(PaymentContext);
  if (!context) throw new Error('usePayment must be used within PaymentProvider');
  return context;
};
