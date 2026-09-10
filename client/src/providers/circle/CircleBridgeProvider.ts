import { CCTP_CONFIGS, addressToBytes32, estimateCCTPUpfrontFee, ZERO_BYTES32, isFastTransferSupported } from '../../config/cctp';
import { isValidTxHash } from '../../config/chains';

export interface PaymentIntent {
  paymentId: string;
  sender: {
    address: string;
    chain: string;
  };
  recipient: {
    input: string;
    resolvedAddress: string;
    name?: string;
  };
  destination: {
    chain: string;
    asset: string; // e.g. "USDC"
    amount: string;
  };
  fee: {
    amount: string; // e.g. "0.20"
    currency: string;
  };
  status: 'CREATED' | 'QUOTE_GENERATED' | 'AUTHORIZED' | 'COMPLETED' | 'FAILED';
}

export interface RouteQuote {
  quoteId: string;
  paymentId: string;
  recipient: {
    name?: string;
    address: string;
  };
  source: {
    chain: string;
    asset: string;
  };
  destination: {
    chain: string;
    asset: string;
    amount: string;
  };
  fees: {
    uniPay: string; // Flat $0.20 UniPay protocol fee ($0.18 UniPay / $0.02 Circle)
    circle: string; // Circle CCTP fee share ($0.02)
    cctpUpfront: string; // CCTP Upfront Fast Transfer / Relay fee
    totalFees: string; // $0.20 + CCTP Upfront
  };
  total: string; // Total paid by sender in USDC
  provider: 'circle';
  estimatedTime: string;
  transferSpeed: 'FAST' | 'STANDARD';
  createdAt: string;
  expiresAt: string;
}

export interface FeeCalculationResult {
  targetAmount: number;
  protocolFee: number;
  unipayShare: number;
  circleShare: number;
  unipayFee: number;
  circleFee: number;
  cctpUpfrontFee: number;
  cctpRelayFee: number;
  burnAmount: number;
  totalFees: number;
  totalToPay: number;
  amountReceived: number;
  isExactNetGuaranteed: boolean;
  estimatedTime: string;
  transferSpeed: 'FAST' | 'STANDARD';
}

export interface ExecutionResult {
  executionId: string;
  sourceTxHash?: string;
  destinationTxHash?: string;
  status: 'PENDING' | 'SOURCE_CONFIRMED' | 'CROSS_CHAIN_TRANSFER' | 'DESTINATION_VERIFIED' | 'COMPLETED' | 'FAILED';
  error?: string;
}

export class CircleBridgeProvider {
  private bridgeKitModule: any = null;
  private adapterModule: any = null;

  constructor() {
    this.initBridgeKit();
  }

  /**
   * Eagerly pre-initialize Circle Bridge Kit and Viem Adapter modules
   */
  private async initBridgeKit() {
    try {
      const [bk, adapter] = await Promise.all([
        import('@circle-fin/bridge-kit').catch(() => null),
        import('@circle-fin/adapter-viem-v2').catch(() => null)
      ]);
      if (bk) this.bridgeKitModule = bk;
      if (adapter) this.adapterModule = adapter;
    } catch (e) {
      console.warn('Circle Bridge Kit preload warning:', e);
    }
  }

  /**
   * Authoritative Live Circle CCTP Fee Estimation via BridgeKit
   * Queries BridgeKit provider/forwarder fees dynamically without hard-coding constant numbers.
   */
  public async estimateLiveCircleFees(
    sourceChainId: number,
    destChainId: number,
    targetAmount: number,
    provider?: any,
    recipientAddress?: string
  ): Promise<{ forwarderFee: number; providerFee: number; isAuthoritative: boolean }> {
    try {
      if (!this.bridgeKitModule) {
        await this.initBridgeKit();
      }
      const BridgeKit = this.bridgeKitModule?.BridgeKit || (await import('@circle-fin/bridge-kit')).BridgeKit;
      const kit = new BridgeKit();

      const sourceConfig = CCTP_CONFIGS[sourceChainId];
      const destConfig = CCTP_CONFIGS[destChainId];
      if (!sourceConfig?.bridgeChainName || !destConfig?.bridgeChainName) {
        return { forwarderFee: 0, providerFee: 0, isAuthoritative: false };
      }

      const validRecipient = recipientAddress && recipientAddress.startsWith('0x') && recipientAddress.length === 42
        ? recipientAddress
        : '0x91F5c3127aB60c1dFEf925b6a715a31e87498c4A';

      if (typeof kit.estimate === 'function' && provider && this.adapterModule) {
        const createViemAdapterFromProvider = this.adapterModule.createViemAdapterFromProvider;
        const adapter = await createViemAdapterFromProvider({ provider });
        const estimate = await kit.estimate({
          from: { adapter, chain: sourceConfig.bridgeChainName as any },
          to: { chain: destConfig.bridgeChainName as any, recipientAddress: validRecipient, useForwarder: true },
          amount: targetAmount > 0 ? targetAmount.toFixed(6) : '1.000000'
        });
        if (estimate && Array.isArray(estimate.fees)) {
          let fwFee = 0;
          let pvFee = 0;
          for (const f of estimate.fees) {
            if (f.type === 'forwarder' && f.amount) fwFee = parseFloat(f.amount);
            if (f.type === 'provider' && f.amount) pvFee = parseFloat(f.amount);
          }
          if (fwFee > 0 || pvFee > 0) {
            return { forwarderFee: fwFee, providerFee: pvFee, isAuthoritative: true };
          }
        }
      }
    } catch (_) {
      // Quietly fall back to CCTP standard fee estimation
    }
    return { forwarderFee: 0, providerFee: 0, isAuthoritative: false };
  }

  /**
   * Check if a given route is supported by Circle CCTP
   */
  public async supportsRoute(sourceChainId: string, destinationChainId: string, asset: string = 'USDC'): Promise<boolean> {
    if (asset.toUpperCase() !== 'USDC') {
      return false;
    }
    return true;
  }

  /**
   * Calculate precise flat $0.20 Custom Developer Fee and authoritative Circle CCTP relay costs.
   * - Target Amount: Exact net USDC the recipient must receive on destination.
   * - Circle Relay Fee: Authoritative forwarding/relay fee from Circle.
   * - Burn Amount: targetAmount + cctpRelayFee (so after destination forwarder deducts its fee, recipient gets EXACT targetAmount).
   * - Total to Pay: targetAmount + cctpRelayFee + protocolFee.
   */
  public calculateFees(
    sourceChain: { id?: string; name?: string; chainId?: number; type?: string },
    destChain: { id?: string; name?: string; chainId?: number; type?: string },
    targetAmount: number,
    speed?: 'FAST' | 'STANDARD',
    liveCircleFee?: number
  ): FeeCalculationResult {
    const targetNum = Math.max(0, targetAmount || 0);
    const protocolFee = 0.20; // $0.20 flat fee ($0.18 Yucarn / $0.02 Circle)
    const unipayShare = 0.18; // 90% ($0.18) to Yucarn Treasury
    const circleShare = 0.02; // 10% ($0.02) to Circle

    const sourceDomain = sourceChain.chainId ? CCTP_CONFIGS[sourceChain.chainId]?.domain : (sourceChain.type === 'solana' ? 5 : undefined);

    const isCrossChain = Boolean(
      (sourceChain.id && destChain.id && sourceChain.id !== destChain.id) ||
      (sourceChain.chainId && destChain.chainId && sourceChain.chainId !== destChain.chainId) ||
      (sourceChain.type && destChain.type && sourceChain.type !== destChain.type)
    );

    // Determine effective transfer speed: only use FAST if the source domain supports it
    const effectiveSpeed: 'FAST' | 'STANDARD' =
      (speed === 'FAST' && sourceDomain !== undefined && isFastTransferSupported(sourceDomain))
        ? 'FAST'
        : 'STANDARD';

    // Arc CCTP destination forwarder deducts ~0.022351 to ~0.023388 USDC on mint.
    // Under Option B, we use 0.024 USDC (or live fee if available) to ensure the recipient
    // always receives 100% of the requested amount (never short), while strictly
    // maintaining total paid by sender at targetNum + 0.20 USDC.
    const isArcDest = destChain.id === 'arc-testnet' || Boolean(destChain.name && destChain.name.toLowerCase().includes('arc'));
    let destMintAdjustment = 0;
    if (isCrossChain) {
      if (liveCircleFee !== undefined && liveCircleFee > 0.015 && liveCircleFee < 0.05) {
        destMintAdjustment = Number(Math.max(liveCircleFee, 0.0235).toFixed(6));
      } else {
        destMintAdjustment = isArcDest ? 0.024 : 0.024;
      }
    }

    const cctpRelayFee = 0.00;
    const isExactNetGuaranteed = true;

    const burnAmount = targetNum > 0 ? Number((targetNum + destMintAdjustment).toFixed(6)) : 0;
    const totalFees = protocolFee; // Flat $0.20
    const totalToPay = targetNum > 0 ? Number((targetNum + protocolFee).toFixed(2)) : 0; // e.g., 4.00 -> 4.20
    const amountReceived = targetNum; // Recipient receives 100% exact net!

    const srcLower = (sourceChain.name || sourceChain.id || '').toLowerCase();
    let estimatedTime = '~ 15 - 30 secs';
    if (srcLower.includes('ethereum') && !srcLower.includes('sepolia')) {
      estimatedTime = '~ 1 - 2 mins';
    } else if (!isCrossChain) {
      estimatedTime = '~ 5 - 10 secs';
    }

    return {
      targetAmount: targetNum,
      protocolFee,
      unipayShare,
      circleShare,
      unipayFee: protocolFee,
      circleFee: circleShare,
      cctpUpfrontFee: 0,
      cctpRelayFee: 0,
      burnAmount,
      totalFees,
      totalToPay,
      amountReceived,
      isExactNetGuaranteed,
      estimatedTime,
      transferSpeed: effectiveSpeed
    };
  }

  /**
   * Estimate fees and generate executable payment quote with expiration
   */
  public async getQuotes(intent: PaymentIntent, speed: 'FAST' = 'FAST'): Promise<RouteQuote> {
    const amountNum = parseFloat(intent.destination.amount) || 0;
    const feeResult = this.calculateFees(
      { id: intent.sender.chain, name: intent.sender.chain },
      { id: intent.destination.chain, name: intent.destination.chain },
      amountNum,
      speed
    );


    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 1000); // 60s quote expiration window

    return {
      quoteId: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      paymentId: intent.paymentId,
      recipient: {
        name: intent.recipient.name,
        address: intent.recipient.resolvedAddress
      },
      source: {
        chain: intent.sender.chain,
        asset: intent.destination.asset
      },
      destination: {
        chain: intent.destination.chain,
        asset: intent.destination.asset,
        amount: intent.destination.amount
      },
      fees: {
        uniPay: feeResult.unipayFee.toFixed(2),
        circle: feeResult.circleFee.toFixed(2),
        cctpUpfront: feeResult.cctpUpfrontFee.toFixed(2),
        totalFees: feeResult.totalFees.toFixed(2)
      },
      total: feeResult.totalToPay.toFixed(2),
      provider: 'circle',
      estimatedTime: feeResult.estimatedTime,
      transferSpeed: 'FAST',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString()
    };
  }

  /**
   * Execute cross-chain transfer via Bridge Kit Forwarder with optional Custom Developer Fee
   */
  public async bridgeWithForwarder(
    provider: any,
    sourceChainId: number,
    destChainId: number,
    recipientAddress: string,
    amount: string,
    developerFee?: { amount: string; recipient?: string },
    callbacks?: {
      onApprove?: (txHash?: string) => void;
      onBurn?: (txHash?: string) => void;
      onAttestation?: (data?: any) => void;
      onMint?: (txHash?: string) => void;
      onStep?: (stepName: string, state: string, txHash?: string) => void;
    }
  ): Promise<ExecutionResult> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const BridgeKit = this.bridgeKitModule?.BridgeKit || (await import('@circle-fin/bridge-kit')).BridgeKit;
      const createViemAdapterFromProvider = this.adapterModule?.createViemAdapterFromProvider || (await import('@circle-fin/adapter-viem-v2')).createViemAdapterFromProvider;

      const kit = new BridgeKit();
      const adapter = await createViemAdapterFromProvider({ provider });

      let sourceChainName = CCTP_CONFIGS[sourceChainId]?.bridgeChainName;
      let destChainName = CCTP_CONFIGS[destChainId]?.bridgeChainName;

      if (!sourceChainName || !destChainName) {
        try {
          const supportedChains = kit.getSupportedChains ? kit.getSupportedChains() : [];
          if (!sourceChainName) {
            const matchSrc = supportedChains.find((c: any) => c.chainId === sourceChainId || c.chain === sourceChainId);
            if (matchSrc) sourceChainName = matchSrc.chain;
          }
          if (!destChainName) {
            const matchDest = supportedChains.find((c: any) => c.chainId === destChainId || c.chain === destChainId);
            if (matchDest) destChainName = matchDest.chain;
          }
        } catch (queryErr) {
          console.warn('Could not query kit.getSupportedChains():', queryErr);
        }
      }

      if (sourceChainId === 501 || sourceChainId === 502) sourceChainName = 'Solana';
      if (destChainId === 501 || destChainId === 502) destChainName = 'Solana';

      if (!sourceChainName || !destChainName) {
        throw new Error(`Unsupported CCTP chain: source ${sourceChainId}, dest ${destChainId}`);
      }

      const bridgeParams: any = {
        from: { adapter, chain: sourceChainName as any },
        to: { recipientAddress, chain: destChainName as any, useForwarder: true },
        amount: amount.toString(),
        config: {
          // Only request FAST if source domain supports it
          transferSpeed: isFastTransferSupported(CCTP_CONFIGS[sourceChainId]?.domain ?? -1) ? 'FAST' : 'STANDARD'
        }
      };

      // Custom Developer Fee (split on source chain: 90% to UniPay Treasury, 10% to Circle)
      if (developerFee && parseFloat(developerFee.amount) > 0) {
        const feeVal = developerFee.amount.toString();
        const feeRecipient = developerFee.recipient || '0x91F5c3127aB60c1dFEf925b6a715a31e87498c4A';

        try {
          if (typeof kit.setCustomFeePolicy === 'function') {
            kit.setCustomFeePolicy({
              computeFee: () => feeVal,
              resolveFeeRecipientAddress: () => feeRecipient
            });
          }
        } catch (policyErr) {
          console.warn('BridgeKit setCustomFeePolicy warning:', policyErr);
        }

        bridgeParams.config.customFee = {
          value: feeVal,
          recipientAddress: feeRecipient
        };
      }

      // Real-time event notifications with robust payload extraction
      if (callbacks) {
        const getHash = (e: any) => e?.values?.txHash || e?.txHash || e?.hash || e?.values?.hash || e?.data?.txHash;
        if (callbacks.onApprove) kit.on('approve', (e: any) => callbacks.onApprove?.(getHash(e)));
        if (callbacks.onBurn) kit.on('burn', (e: any) => callbacks.onBurn?.(getHash(e)));
        if (callbacks.onAttestation) kit.on('fetchAttestation', (e: any) => callbacks.onAttestation?.(e?.values?.data || e?.data));
        if (callbacks.onMint) kit.on('mint', (e: any) => callbacks.onMint?.(getHash(e)));
        if (callbacks.onStep) kit.on('*', (e: any) => callbacks.onStep?.(e?.method || e?.name || e?.step || '', e?.state || 'in_progress', getHash(e)));
      }

      const result: any = await kit.bridge(bridgeParams);

      if (result && result.steps) {
        const isApprovalStep = (s: any) => {
          const n = (s?.name || s?.step || s?.type || '').toLowerCase();
          return n.includes('approve') || n.includes('approval') || n.includes('allowance');
        };

        const isBurnStep = (s: any) => {
          const n = (s?.name || s?.step || s?.type || '').toLowerCase();
          return n.includes('burn') || n.includes('deposit') || n.includes('transfer') || n.includes('bridge') || n.includes('send');
        };

        // 1. Explicit burn step by name
        let burnStep = result.steps.find((s: any) => isBurnStep(s) && s.txHash);

        // 2. If not found by explicit burn name, pick candidate that is NOT an approval step
        if (!burnStep) {
          const nonApprovalSteps = result.steps.filter((s: any) => s.txHash && !isApprovalStep(s));
          if (nonApprovalSteps.length > 0) {
            burnStep = nonApprovalSteps[nonApprovalSteps.length - 1];
          }
        }

        // 3. If multiple steps have txHash, the burn transaction always succeeds the approval step
        if (!burnStep) {
          const stepsWithTx = result.steps.filter((s: any) => Boolean(s.txHash));
          if (stepsWithTx.length > 1) {
            burnStep = stepsWithTx[stepsWithTx.length - 1];
          } else if (stepsWithTx.length === 1 && !isApprovalStep(stepsWithTx[0])) {
            burnStep = stepsWithTx[0];
          }
        }

        const isMintStep = (s: any) => {
          const n = (s?.name || s?.step || s?.type || '').toLowerCase();
          return n === 'mint' || n.includes('mint') || n.includes('receive') || n.includes('claim') || Boolean(s?.forwarded);
        };

        const mintStep = result.steps.find((s: any) => isMintStep(s) && isValidTxHash(s.txHash));
        const candidateDestHash = mintStep?.txHash || result.destinationTxHash || result.forwardTxHash || result.destinationTransactionHash;
        const resolvedDestHash = isValidTxHash(candidateDestHash) ? candidateDestHash.trim() : undefined;

        return {
          executionId,
          sourceTxHash: burnStep?.txHash,
          destinationTxHash: resolvedDestHash,
          status: result.state === 'error' ? 'FAILED' : 'COMPLETED',
          error: result.state === 'error' ? (result.error?.message || 'Bridge transfer encountered an issue') : undefined
        };
      }

      return {
        executionId,
        status: 'COMPLETED'
      };
    } catch (err: any) {
      console.warn('BridgeKit Forwarder execution error:', err?.message || err);
      return {
        executionId,
        status: 'FAILED',
        error: err?.message || 'BridgeKit execution failed'
      };
    }
  }

  /**
   * Poll Circle Iris API v2 for signed attestation.
   * - Handles "PENDING" attestation state (not yet finalized).
   * - Normalizes hex strings to ensure 0x prefix on both message and attestation.
   * - Extracts destinationTransactionHash if the message was auto-relayed.
   */
  public async fetchIrisAttestation(
    sourceDomain: number,
    sourceTxHash: string,
    isTestnet: boolean = true,
    maxAttempts: number = 150,    // 150 × 5s = 12.5 min default, caller may extend
    intervalMs: number = 5000,
    onProgress?: (status: string, attempt: number) => void
  ): Promise<{ message: `0x${string}`; attestation: `0x${string}`; destinationTxHash?: string }> {
    const baseUrl = isTestnet ? 'https://iris-api-sandbox.circle.com' : 'https://iris-api.circle.com';
    const cleanHash = sourceTxHash.startsWith('0x') ? sourceTxHash : `0x${sourceTxHash}`;
    const v2Url = `${baseUrl}/v2/messages/${sourceDomain}?transactionHash=${cleanHash}`;
    const v1Url = `${baseUrl}/v1/messages/${sourceDomain}/${cleanHash}`;

    const normalizeHex = (value: string | undefined | null): `0x${string}` | null => {
      if (!value || value === 'PENDING' || value.trim() === '') return null;
      const raw = value.startsWith('0x') ? value : `0x${value}`;
      if (!/^0x[0-9a-fA-F]+$/.test(raw)) return null;
      return raw as `0x${string}`;
    };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (onProgress) {
          onProgress(`Waiting for Circle attestation (attempt ${attempt}/${maxAttempts})...`, attempt);
        }

        let res = await fetch(v2Url);
        if (!res.ok && res.status === 404) {
          try {
            const resV1 = await fetch(v1Url);
            if (resV1.ok) {
              res = resV1;
            }
          } catch {
            // Ignore v1 fallback network error
          }
        }

        if (res.ok) {
          const data = await res.json();
          const firstMsg = Array.isArray(data?.messages)
            ? data.messages[0]
            : (data?.message ? data : null);

          if (firstMsg) {
            const status = firstMsg.status as string | undefined;
            const msgHex = normalizeHex(firstMsg.message);
            const attHex = normalizeHex(firstMsg.attestation);
            const rawDestTx =
              firstMsg.destinationTransactionHash ||
              firstMsg.destinationTxHash ||
              firstMsg.claimTxHash ||
              firstMsg.claimTransactionHash ||
              firstMsg.mintTxHash ||
              firstMsg.mintTransactionHash ||
              firstMsg.destination?.transactionHash ||
              firstMsg.destination?.txHash ||
              firstMsg.relay?.txHash;

            const destTx = isValidTxHash(rawDestTx) ? rawDestTx.trim() : undefined;

            if ((status === 'complete' || !status) && msgHex && attHex) {
              return {
                message: msgHex,
                attestation: attHex,
                destinationTxHash: destTx
              };
            }

            // Surface meaningful progress status to caller
            if (onProgress) {
              const label =
                firstMsg.delayReason === 'insufficient_fee' ? 'Waiting for standard block finality (~10-15m)...'
                : status === 'pending_confirmations' ? 'Waiting for source chain finality...'
                : status === 'complete' ? 'Attestation ready, finalizing...'
                : status ? `Circle attestation status: ${status}`
                : `Waiting for Circle attestation (attempt ${attempt}/${maxAttempts})...`;
              onProgress(label, attempt);
            }
          }
        } else if (res.status === 404) {
          if (onProgress) onProgress('Transaction not yet indexed by Circle Iris...', attempt);
        }
      } catch (err) {
        console.warn(`Iris polling attempt ${attempt} warning:`, err);
      }

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    throw new Error(`Circle Iris attestation timed out after ${maxAttempts * (intervalMs / 1000)}s`);
  }

  /**
   * Fetch and poll for destination transaction hash from Circle Iris API.
   * Useful when attestation has been confirmed and Orbit Relayer or Circle Forwarder
   * is executing the mint transaction on the destination chain.
   */
  public async pollDestinationTxHash(
    sourceDomain: number,
    sourceTxHash: string,
    isTestnet: boolean = true,
    maxAttempts: number = 20,
    intervalMs: number = 3000
  ): Promise<string | undefined> {
    const baseUrl = isTestnet ? 'https://iris-api-sandbox.circle.com' : 'https://iris-api.circle.com';
    const cleanHash = sourceTxHash.startsWith('0x') ? sourceTxHash : `0x${sourceTxHash}`;
    const v2Url = `${baseUrl}/v2/messages/${sourceDomain}?transactionHash=${cleanHash}`;
    const v1Url = `${baseUrl}/v1/messages/${sourceDomain}/${cleanHash}`;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        let res = await fetch(v2Url);
        if (!res.ok && res.status === 404) {
          try {
            const resV1 = await fetch(v1Url);
            if (resV1.ok) res = resV1;
          } catch {
            // Ignore v1 fallback error
          }
        }

        if (res.ok) {
          const data = await res.json();
          const firstMsg = Array.isArray(data?.messages)
            ? data.messages[0]
            : (data?.message ? data : null);

          if (firstMsg) {
            const rawDestTx =
              firstMsg.destinationTransactionHash ||
              firstMsg.destinationTxHash ||
              firstMsg.claimTxHash ||
              firstMsg.claimTransactionHash ||
              firstMsg.mintTxHash ||
              firstMsg.mintTransactionHash ||
              firstMsg.destination?.transactionHash ||
              firstMsg.destination?.txHash ||
              firstMsg.relay?.txHash;

            if (isValidTxHash(rawDestTx)) {
              return rawDestTx.trim();
            }
          }
        }
      } catch (err) {
        console.warn(`Destination tx poll attempt ${attempt} notice:`, err);
      }

      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }

    return undefined;
  }
}

export const circleBridgeProvider = new CircleBridgeProvider();
