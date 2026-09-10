import React, { useState } from 'react';
import { usePayment } from '../context/PaymentContext';
import { ArrowRight, Copy, CheckCircle2, User, Target, Link, ChevronDown, ChevronRight, Landmark, Info, AlertCircle } from 'lucide-react';
import { relayerService } from '../services/relayer';
import { UsdcLogo } from './UsdcLogo';

export const Step2Details: React.FC = () => {
  const {
    recipient,
    sourceChain,
    destChain,
    amount,
    userBalance,
    formattedBalance,
    quote,
    treasuryAddress,
    handleStartPayment,
    isPermitCapable,
    walletConnected
  } = usePayment();

  const [copiedRecipient, setCopiedRecipient] = useState(false);
  const [copiedTreasury, setCopiedTreasury] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const copyRecipient = () => {
    if (!recipient.address) return;
    navigator.clipboard.writeText(recipient.address);
    setCopiedRecipient(true);
    setTimeout(() => setCopiedRecipient(false), 2000);
  };

  const copyTreasury = () => {
    navigator.clipboard.writeText(treasuryAddress);
    setCopiedTreasury(true);
    setTimeout(() => setCopiedTreasury(false), 2000);
  };

  const truncatedRecipient = recipient.address
    ? `${recipient.address.slice(0, 6)}...${recipient.address.slice(-4)}`
    : '';

  const truncatedTreasury = `${treasuryAddress.slice(0, 6)}...${treasuryAddress.slice(-4)}`;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Amount Header */}
      <div className="flex items-center pt-1 pb-2">
        <div className="flex items-center gap-3">
          {/* Official USDC Coin Icon */}
          <UsdcLogo className="w-11 h-11" />
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-gray-900 dark:text-white tracking-tight leading-none">
              {quote.targetAmount.toFixed(2)} <span className="text-gray-500 dark:text-gray-400 font-bold text-xl sm:text-2xl">USDC</span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
              {recipient.displayName || 'Alice'} receives on {destChain.name}
            </p>
          </div>
        </div>
      </div>

      {/* Recipient Overview Box */}
      <div className="p-3.5 bg-gray-50/70 dark:bg-[#1a202c]/60 border border-gray-200/80 dark:border-[#2b3245] rounded-2xl space-y-2.5 text-xs">
        {/* Recipient */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center">
              <User className="w-3 h-3" />
            </div>
            <span className="font-semibold">Recipient</span>
          </div>
          <button
            type="button"
            onClick={copyRecipient}
            className="flex items-center gap-1.5 font-mono font-bold text-gray-900 dark:text-white hover:underline"
            title="Copy address"
          >
            <span>{truncatedRecipient}</span>
            {copiedRecipient ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
          </button>
        </div>

        {/* Receive on */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
              <Target className="w-3 h-3" />
            </div>
            <span className="font-semibold">Receive on</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">
            {destChain.name}
          </span>
        </div>

        {/* Sending from */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center">
              <Link className="w-3 h-3" />
            </div>
            <span className="font-semibold">Sending from</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white">
            USDC on {sourceChain.name}
          </span>
        </div>
      </div>

      {/* Breakdown Box */}
      <div className="p-3.5 bg-gray-50/70 dark:bg-[#1a202c]/60 border border-gray-200/80 dark:border-[#2b3245] rounded-2xl space-y-2 text-xs">
        {/* Recipient Receives Net */}
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-300 font-bold">
            {recipient.displayName || 'Alice'} receives
          </span>
          <span className="font-extrabold text-[#15803d] dark:text-[#55db9c]">
            {quote.targetAmount.toFixed(2)} USDC (Exact Net)
          </span>
        </div>

        {/* You pay */}
        <div className="border-t border-gray-200/80 dark:border-gray-700/80 pt-2 flex items-center justify-between">
          <span className="text-gray-900 dark:text-white font-extrabold text-xs">You pay</span>
          <span className="font-extrabold text-sm text-gray-900 dark:text-white font-display">
            {quote.totalToPay.toFixed(2)} USDC
          </span>
        </div>

        {/* Expand/Collapse Toggle Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#151922] border border-gray-200 dark:border-[#2e374c] text-[11px] font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1f2533] transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" />
              <span>{showDetails ? 'Hide details' : 'View fee & route details'}</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Collapsible Details Content */}
        {showDetails && (
          <div className="space-y-2 pt-2 border-t border-gray-200/60 dark:border-gray-700/60 animate-fade-in text-[11px]">
            {/* Protocol fee */}
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">🛡️</span>
                <span>Protocol fee (Flat)</span>
              </div>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                ${quote.protocolFee.toFixed(2)} USDC
              </span>
            </div>

            {/* Approval mode */}
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 pt-1">
              <span>Approval mode</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {isPermitCapable && relayerService.hasActiveRelayer()
                  ? 'Fast approval (1 confirmation)'
                  : 'Standard approval (2 confirmations)'}
              </span>
            </div>

            {/* Cross-chain Engine */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-gray-400">Cross-chain Engine</span>
              <span className="font-bold text-[#2563eb] dark:text-[#60a5fa]">
                Circle CCTP v2 Native USDC
              </span>
            </div>

            {/* Route */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Route</span>
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {sourceChain.name} → {destChain.name}
              </span>
            </div>

            {/* Estimated settlement time */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Estimated settlement time</span>
              <span className="font-bold text-[#15803d] dark:text-[#55db9c]">
                ~15 - 30 seconds
              </span>
            </div>

            {/* Treasury */}
            <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1.5 text-gray-400">
                <Landmark className="w-3 h-3" />
                <span>Treasury</span>
              </div>
              <button
                type="button"
                onClick={copyTreasury}
                className="flex items-center gap-1 font-mono text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <span>{truncatedTreasury}</span>
                {copiedTreasury ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-gray-400" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Insufficient Balance Alert */}
      {walletConnected && (parseFloat(amount || '0') > userBalance || quote.totalToPay > userBalance) && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl flex items-start gap-2 text-xs text-red-700 dark:text-red-300 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Insufficient USDC Balance</span>
            <span className="text-[11px] opacity-90">
              Total required is {quote.totalToPay.toFixed(2)} USDC (including fees), but you only have {formattedBalance} USDC on {sourceChain.name}.
            </span>
          </div>
        </div>
      )}

      {/* Primary Black CTA Button with Green Circle Arrow */}
      <button
        type="button"
        onClick={handleStartPayment}
        disabled={walletConnected && (parseFloat(amount || '0') > userBalance || quote.totalToPay > userBalance)}
        className="w-full py-3.5 px-5 rounded-full bg-black hover:bg-gray-900 active:scale-[0.99] text-white font-extrabold text-sm flex items-center justify-between group transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        <span className="font-display tracking-wide">
          {walletConnected
            ? (parseFloat(amount || '0') > userBalance || quote.totalToPay > userBalance)
              ? 'Insufficient USDC Balance'
              : `Send ${quote.totalToPay.toFixed(2)} USDC`
            : 'Connect Wallet to Send'}
        </span>
        <div className="w-7 h-7 rounded-full bg-[#55db9c] text-black flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </div>
      </button>
    </div>
  );
};




