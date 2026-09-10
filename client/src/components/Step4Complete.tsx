import React, { useEffect, useState } from 'react';
import { usePayment } from '../context/PaymentContext';
import confetti from 'canvas-confetti';
import { Copy, CheckCircle2, ExternalLink, ArrowRight, User, Target, Link, ChevronDown, ChevronRight, Check, Info } from 'lucide-react';
import { getExplorerTxUrl, isValidTxHash } from '../config/chains';
import { UsdcLogo } from './UsdcLogo';

export const Step4Complete: React.FC = () => {
  const {
    recipient,
    sourceChain,
    destChain,
    quote,
    currentTxHash,
    destTxHash,
    completedTimestamp,
    handleReset,
    setIsActivityOpen,
  } = usePayment();

  const [copiedRecipient, setCopiedRecipient] = useState(false);
  const [copiedSource, setCopiedSource] = useState(false);
  const [copiedDest, setCopiedDest] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Confetti burst using Slush palette colors
    const end = Date.now() + 900;
    const colors = ['#ffd731', '#55db9c', '#4da2ff', '#e9ccff', '#fb4903', '#000000'];

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  const copyRecipient = () => {
    if (!recipient.address) return;
    navigator.clipboard.writeText(recipient.address);
    setCopiedRecipient(true);
    setTimeout(() => setCopiedRecipient(false), 2000);
  };

  const effectiveSourceHash = isValidTxHash(currentTxHash) ? currentTxHash : '';
  const truncatedSourceHash = effectiveSourceHash
    ? `${effectiveSourceHash.slice(0, 6)}...${effectiveSourceHash.slice(-4)}`
    : '';

  const effectiveDestHash = isValidTxHash(destTxHash) ? destTxHash : '';
  const truncatedDestHash = effectiveDestHash
    ? `${effectiveDestHash.slice(0, 6)}...${effectiveDestHash.slice(-4)}`
    : '';

  const copySourceTx = () => {
    if (!effectiveSourceHash) return;
    navigator.clipboard.writeText(effectiveSourceHash);
    setCopiedSource(true);
    setTimeout(() => setCopiedSource(false), 2000);
  };

  const copyDestTx = () => {
    if (!effectiveDestHash) return;
    navigator.clipboard.writeText(effectiveDestHash);
    setCopiedDest(true);
    setTimeout(() => setCopiedDest(false), 2000);
  };

  const isCrossChain = sourceChain.id !== destChain.id;
  const sourceExplorerLink = effectiveSourceHash ? getExplorerTxUrl(sourceChain, effectiveSourceHash) : '';
  const destExplorerLink = effectiveDestHash ? getExplorerTxUrl(destChain, effectiveDestHash) : '';

  const truncatedRecipient = recipient.address
    ? `${recipient.address.slice(0, 6)}...${recipient.address.slice(-4)}`
    : '';

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

        {/* You paid */}
        <div className="border-t border-gray-200/80 dark:border-gray-700/80 pt-2 flex items-center justify-between">
          <span className="text-gray-900 dark:text-white font-extrabold text-xs">You paid</span>
          <span className="font-extrabold text-sm text-gray-900 dark:text-white font-display">
            {quote.totalToPay.toFixed(2)} USDC
          </span>
        </div>

        {/* Status Completed */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#151922] border border-gray-200 dark:border-[#2e374c] text-[11px]">
          <span className="text-gray-400">Status</span>
          <div className="flex items-center gap-1.5 text-gray-900 dark:text-white font-bold">
            <span className="w-2 h-2 rounded-full bg-[#55db9c] border border-black" />
            <span>Completed · {completedTimestamp}</span>
          </div>
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
              <span>{showDetails ? 'Hide details' : 'View fee & transaction details'}</span>
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

            {/* Source Tx Hash */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between text-[11px]">
              <span className="text-gray-400">{sourceChain.name} Tx</span>
              <div className="flex items-center gap-1.5">
                {sourceExplorerLink ? (
                  <a
                    href={sourceExplorerLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-bold text-gray-900 dark:text-white hover:underline flex items-center gap-1"
                    title={`View on ${sourceChain.name} Explorer`}
                  >
                    <span>{truncatedSourceHash}</span>
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </a>
                ) : (
                  <span className="font-mono font-bold text-gray-900 dark:text-white">
                    {truncatedSourceHash}
                  </span>
                )}
                {effectiveSourceHash && (
                  <button
                    type="button"
                    onClick={copySourceTx}
                    className="p-1 rounded-full border border-black hover:bg-[#e9ccff] transition-colors"
                    title="Copy hash"
                  >
                    {copiedSource ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                  </button>
                )}
              </div>
            </div>

            {/* Destination Tx Hash */}
            {isCrossChain && (
              <div className="flex items-center justify-between text-[11px] pt-1">
                <span className="text-gray-400">{destChain.name} Mint Tx</span>
                <div className="flex items-center gap-1.5">
                  {destExplorerLink ? (
                    <>
                      <a
                        href={destExplorerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-gray-900 dark:text-white hover:underline flex items-center gap-1"
                        title={`View on ${destChain.name} Explorer`}
                      >
                        <span>{truncatedDestHash}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </a>
                      <button
                        type="button"
                        onClick={copyDestTx}
                        className="p-1 rounded-full border border-black hover:bg-[#e9ccff] transition-colors"
                        title="Copy mint hash"
                      >
                        {copiedDest ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-400" />}
                      </button>
                    </>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#55db9c]/30 text-emerald-800 dark:text-[#55db9c] font-bold text-[10px]">
                      Auto-relayed
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Done Action Button with Green Circle Arrow & Activity Link */}
      <div className="space-y-2 pt-1">
        <button
          type="button"
          onClick={handleReset}
          className="w-full py-3.5 px-5 rounded-full bg-black hover:bg-gray-900 active:scale-[0.99] text-white font-extrabold text-sm flex items-center justify-between group transition-all shadow-md"
        >
          <span className="font-display tracking-wide">
            Send Another Payment
          </span>
          <div className="w-7 h-7 rounded-full bg-[#55db9c] text-black flex items-center justify-center group-hover:translate-x-0.5 transition-transform shrink-0">
            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
          </div>
        </button>

        {/* View in activity link */}
        <button
          type="button"
          onClick={() => setIsActivityOpen(true)}
          className="w-full py-2.5 rounded-full bg-white dark:bg-[#1a202c] border border-black text-xs font-bold text-gray-900 dark:text-white hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
        >
          <span>View in Activity History</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};



