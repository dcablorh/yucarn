import React, { useState, useEffect, useRef } from 'react';
import { usePayment } from '../context/PaymentContext';
import { Search, Check, Copy, ChevronDown, ArrowRight, CheckCircle2, Loader2, AlertCircle, Zap, User, Link, Sparkles, Clipboard, Coins } from 'lucide-react';
import { UsdcLogo } from './UsdcLogo';
import { ChainIcon } from './ChainIcon';

export const Step1Recipient: React.FC = () => {
  const {
    recipient,
    isResolvingENS,
    ensResolutionError,
    setEnsResolutionError,
    destChain,
    sourceChain,
    openChainModal,
    amount,
    setAmount,
    userBalance,
    formattedBalance,
    isBalanceLoading,
    walletConnected,
    openReownModal,
    handleResolveRecipient,
    handleContinueToDetails,
    quote
  } = usePayment();

  const [copied, setCopied] = useState(false);
  const [searchInput, setSearchInput] = useState(recipient.query || '');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copyAddress = () => {
    if (!recipient.address) return;
    navigator.clipboard.writeText(recipient.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setSearchInput(text);
        handleResolveRecipient(text);
      }
    } catch (e) {
      console.warn('Paste failed', e);
    }
  };

  const isLikelyComplete = (text: string) => {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return false;

    if (/^0x[a-f0-9]{40}$/.test(trimmed)) return true;
    if (/^0x[a-f0-9]{64}$/.test(trimmed) || (/^[a-f0-9]{64}$/.test(trimmed) && trimmed.length === 64)) return true;
    if (!trimmed.startsWith('0x') && /^[1-9a-hj-np-za-km-z]{32,44}$/.test(trimmed)) return true;

    const validDomainSuffixes = ['.eth', '.sui', '.sol', '.xyz', '.id', '.box', '.lens', '.com', '.org', '.io', '.co', '.app'];
    return validDomainSuffixes.some(suffix => trimmed.endsWith(suffix));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (ensResolutionError) {
      setEnsResolutionError(null);
    }

    if (!val.trim()) {
      handleResolveRecipient('');
      return;
    }

    if (isLikelyComplete(val)) {
      debounceTimerRef.current = setTimeout(() => {
        handleResolveRecipient(val);
      }, 500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (searchInput.trim()) {
        handleResolveRecipient(searchInput);
      }
    }
  };

  const handleInputBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (searchInput.trim() && searchInput.trim() !== recipient.query) {
      handleResolveRecipient(searchInput);
    }
  };

  useEffect(() => {
    setSearchInput(recipient.query || '');
  }, [recipient.query]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const truncatedAddress = recipient.address
    ? `${recipient.address.slice(0, 6)}...${recipient.address.slice(-4)}`
    : '';

  // Chain & Recipient Format Compatibility Validation
  const validateCompatibility = () => {
    if (!recipient.address) return { valid: true, error: null };
    const clean = recipient.address.trim();

    if (destChain.type === 'evm') {
      if (!/^0x[a-fA-F0-9]{40}$/.test(clean)) {
        return {
          valid: false,
          error: `Destination network is ${destChain.name} (EVM), but this address is not a valid 42-character 0x EVM address.`
        };
      }
    } else if (destChain.type === 'solana') {
      if (clean.startsWith('0x') || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(clean)) {
        return {
          valid: false,
          error: `Destination is Solana, but this address is not a valid base58 Solana address.`
        };
      }
    } else if (destChain.type === 'sui') {
      if (!/^0x[a-fA-F0-9]{64}$/.test(clean) && !/^[a-fA-F0-9]{64}$/.test(clean)) {
        return {
          valid: false,
          error: `Destination is Sui, but this address is not a valid 64-hex Sui address.`
        };
      }
    }
    return { valid: true, error: null };
  };

  const compatibility = validateCompatibility();

  // Balance & Amount Validation
  const parsedAmount = parseFloat(amount || '0');
  const totalRequired = quote?.totalToPay || parsedAmount;
  const hasEnteredAmount = parsedAmount > 0;

  let balanceError: string | null = null;
  let isInsufficient = false;

  if (walletConnected && !isBalanceLoading && hasEnteredAmount) {
    if (userBalance <= 0) {
      balanceError = `You have 0.00 USDC on ${sourceChain.name}. You need USDC to send a payment.`;
      isInsufficient = true;
    } else if (parsedAmount > userBalance) {
      balanceError = `Insufficient balance: You entered ${parsedAmount.toFixed(2)} USDC, but you only have ${formattedBalance} USDC on ${sourceChain.name}.`;
      isInsufficient = true;
    } else if (totalRequired > userBalance) {
      const fees = quote?.totalFees || 0;
      balanceError = `Insufficient balance for fees: Total payment requires ${totalRequired.toFixed(2)} USDC (includes $${fees.toFixed(2)} fees), exceeding your balance of ${formattedBalance} USDC.`;
      isInsufficient = true;
    }
  }

  // Smart MAX button calculation
  const handleMax = () => {
    if (userBalance <= 0) return;
    const fees = quote?.totalFees || 0;
    const maxAvailable = Math.max(0, userBalance - fees);
    setAmount(maxAvailable > 0 ? maxAvailable.toFixed(2) : userBalance.toString());
  };

  const isFormValid = Boolean(
    recipient.isValid &&
    recipient.address &&
    compatibility.valid &&
    hasEnteredAmount &&
    !isInsufficient &&
    !isResolvingENS
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Section 1: Who are you sending to? */}
      <div className="p-3.5 sm:p-4 bg-gray-50/70 dark:bg-[#1a202c]/60 border border-gray-200/80 dark:border-[#2b3245] rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <label className="text-xs font-bold text-gray-900 dark:text-white">
              Who are you sending to?
            </label>
          </div>
          <Sparkles className="w-3.5 h-3.5 text-gray-400" />
        </div>

        {/* Search Input Box with Search and Clipboard Paste */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {isResolvingENS ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleInputBlur}
            placeholder="Search name, address, ENS (.eth), SuiNS (.sui)"
            className={`w-full pl-9 pr-9 py-2.5 bg-white dark:bg-[#151922] border rounded-xl text-xs font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none transition-all shadow-2xs font-mono sm:font-sans truncate ${
              ensResolutionError || !compatibility.valid
                ? 'border-red-400 focus:ring-2 focus:ring-red-400/20'
                : 'border-gray-200 dark:border-[#2e374c] focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500'
            }`}
          />
          <button
            type="button"
            onClick={handlePaste}
            title="Paste from clipboard"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <Clipboard className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Resolution Error Alert */}
        {ensResolutionError && !isResolvingENS && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-500" />
            <span className="truncate">{ensResolutionError}</span>
          </div>
        )}

        {/* Chain Incompatibility Alert */}
        {!compatibility.valid && compatibility.error && (
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300 animate-fade-in">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            <span>{compatibility.error}</span>
          </div>
        )}

        {/* Resolved Recipient Banner */}
        {recipient.isValid && recipient.address && !isResolvingENS && (
          <div className="p-2.5 bg-white dark:bg-[#151922] border border-gray-200 dark:border-[#2e374c] rounded-xl flex items-center justify-between gap-2 transition-all">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 sm:w-7 h-6 sm:h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs shrink-0">
                {recipient.displayName ? recipient.displayName.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-xs text-gray-900 dark:text-white truncate">
                  {recipient.displayName}
                </h4>
                <p className="text-[10px] text-gray-400 font-mono truncate">
                  {truncatedAddress}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={copyAddress}
              className="p-1 rounded-md text-gray-400 hover:text-gray-700 dark:hover:text-white shrink-0"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Section 2: Where should they receive it? */}
      <div className="p-3.5 sm:p-4 bg-gray-50/70 dark:bg-[#1a202c]/60 border border-gray-200/80 dark:border-[#2b3245] rounded-2xl space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Link className="w-3.5 h-3.5" />
          </div>
          <label className="text-xs font-bold text-gray-900 dark:text-white">
            Where should they receive it?
          </label>
        </div>

        <button
          type="button"
          onClick={() => openChainModal('dest')}
          className="w-full flex items-center justify-between p-2.5 sm:p-3 bg-white dark:bg-[#151922] border border-gray-200 dark:border-[#2e374c] rounded-xl hover:border-gray-300 transition-all shadow-2xs group cursor-pointer"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-full flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
              <ChainIcon chain={destChain} />
            </div>
            <div className="text-left min-w-0">
              <p className="font-bold text-xs text-gray-900 dark:text-white truncate">
                {destChain.name}
              </p>
              <p className="text-[11px] text-gray-400 truncate">
                {destChain.subtitle}
              </p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-gray-400 group-hover:translate-y-0.5 transition-transform shrink-0 ml-1" />
        </button>
      </div>

      {/* Section 3: Recipient receives (USDC) */}
      <div className="p-3.5 sm:p-4 bg-gray-50/70 dark:bg-[#1a202c]/60 border border-gray-200/80 dark:border-[#2b3245] rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5" />
            </div>
            <label className="text-xs font-bold text-gray-900 dark:text-white">
              Recipient receives (USDC)
            </label>
          </div>
          {/* Fast Transfer Badge */}
          <div className="flex items-center gap-1 bg-[#55db9c]/20 text-[#15803d] dark:text-[#55db9c] px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold shrink-0">
            <Zap className="w-3 h-3 fill-current" />
            <span>Fast Transfer</span>
          </div>
        </div>

        <div className={`p-3 bg-white dark:bg-[#151922] border rounded-xl space-y-2 shadow-2xs transition-colors ${
          isInsufficient
            ? 'border-red-400 dark:border-red-500/70 bg-red-50/10'
            : 'border-gray-200 dark:border-[#2e374c]'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/,/g, '.');
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setAmount(val);
                  }
                }}
                onWheel={(e) => (e.target as HTMLElement).blur()}
                placeholder="0.00"
                autoComplete="off"
                className={`text-xl sm:text-2xl font-bold font-display bg-transparent focus:outline-none w-full max-w-[150px] ${
                  isInsufficient
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              />
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium">
                ≈ ${parseFloat(amount || '0').toFixed(2)} USD
              </p>
            </div>

            {/* Asset Selector */}
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gray-50 dark:bg-[#1f2533] border border-gray-200 dark:border-[#2e374c] shrink-0">
              <UsdcLogo className="w-4 h-4" />
              <span className="font-bold text-xs text-gray-900 dark:text-white">
                USDC
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
            </div>
          </div>

          {/* Balance Subtext & Smart Max button */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-1.5 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 pt-1.5 border-t border-gray-100 dark:border-gray-800">
            {walletConnected ? (
              isBalanceLoading ? (
                <span className="flex items-center gap-1 text-gray-400">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                  <span>Checking balance...</span>
                </span>
              ) : (
                <div className="flex items-center gap-1.5 ml-auto">
                  <span>Balance:</span>
                  <span className={`font-bold ${isInsufficient ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-200'}`}>
                    {formattedBalance} USDC
                  </span>
                  <button
                    type="button"
                    onClick={handleMax}
                    title="Set maximum sendable amount after network fees"
                    className="px-1.5 py-0.5 rounded-md bg-[#55db9c] text-black font-extrabold text-[9px] hover:opacity-90 active:scale-95 uppercase cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              )
            ) : (
              <button
                type="button"
                onClick={() => openReownModal('Connect')}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline text-[10px] ml-auto cursor-pointer"
              >
                Connect to see balance
              </button>
            )}
          </div>
        </div>

        {/* Insufficient Balance Alert Banner */}
        {isInsufficient && balanceError && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300 animate-fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block">Balance Alert</span>
              <span className="text-[11px] opacity-90">{balanceError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Continue CTA Button */}
      <button
        type="button"
        onClick={handleContinueToDetails}
        disabled={!isFormValid}
        className="w-full py-3.5 rounded-full bg-[#4da2ff] hover:bg-[#3894ff] active:scale-[0.99] text-black font-extrabold text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <span>
          {isInsufficient
            ? 'Insufficient USDC Balance'
            : !recipient.isValid && searchInput.trim()
            ? 'Invalid Recipient'
            : !compatibility.valid
            ? 'Incompatible Network Address'
            : 'Continue'}
        </span>
        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
      </button>
    </div>
  );
};
