import React from 'react';
import { usePayment } from '../context/PaymentContext';
import { Zap, Check, ExternalLink, ArrowRight, User, Target, Link, ChevronRight } from 'lucide-react';
import { getExplorerTxUrl, isValidTxHash } from '../config/chains';
import { UsdcLogo } from './UsdcLogo';

export const Step3Sending: React.FC = () => {
  const {
    recipient,
    sourceChain,
    destChain,
    quote,
    pipelineStages,
    currentTxHash,
    destTxHash,
    setCurrentStep
  } = usePayment();

  const isCrossChain = sourceChain.id !== destChain.id || sourceChain.chainId !== destChain.chainId || sourceChain.type !== destChain.type;
  const effectiveTxHash = isValidTxHash(currentTxHash) ? currentTxHash : '';
  const effectiveDestHash = isValidTxHash(destTxHash) ? destTxHash : '';
  const sourceExplorerLink = effectiveTxHash ? getExplorerTxUrl(sourceChain, effectiveTxHash) : '';
  const destExplorerLink = effectiveDestHash ? getExplorerTxUrl(destChain, effectiveDestHash) : '';

  const truncatedRecipient = recipient.address
    ? `${recipient.address.slice(0, 6)}...${recipient.address.slice(-4)}`
    : '';

  const isAnyFailed = pipelineStages.some((s) => s.status === 'failed');
  const isAllComplete = pipelineStages.every((s) => s.status === 'completed');

  // Automatically advance to Step 4 (Receipt) once all pipeline stages complete
  React.useEffect(() => {
    if (isAllComplete) {
      const timer = setTimeout(() => {
        setCurrentStep(4);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAllComplete, setCurrentStep]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Header matching Step2 */}
      <div className="flex items-center pt-1 pb-1">
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

      {/* Recipient & Route Summary Card */}
      <div className="p-3 bg-gray-50/70 dark:bg-[#1a202c]/60 border border-gray-200/80 dark:border-[#2b3245] rounded-2xl space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <div className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 flex items-center justify-center">
              <User className="w-3 h-3" />
            </div>
            <span className="font-semibold">Recipient</span>
          </div>
          <span className="font-mono font-bold text-gray-900 dark:text-white">
            {truncatedRecipient}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
            <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
              <Target className="w-3 h-3" />
            </div>
            <span className="font-semibold">Route</span>
          </div>
          <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1">
            <span>{sourceChain.name}</span>
            <span className="text-gray-400">→</span>
            <span>{destChain.name}</span>
          </span>
        </div>
      </div>

      {/* 5-Stage Live Pipeline Tracker */}
      <div className="bg-white dark:bg-[#1a202c] border-[1.5px] border-black dark:border-[#2e374c] rounded-2xl p-4 space-y-3.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
          <span className="text-xs font-display font-extrabold text-gray-900 dark:text-white">
            Cross-Chain Pipeline
          </span>
          <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
            Circle CCTP v2
          </span>
        </div>

        {pipelineStages.map((stage, idx) => {
          const isDone = stage.status === 'completed';
          const isInProgress = stage.status === 'in_progress';
          const isFailed = stage.status === 'failed';
          const isLast = idx === pipelineStages.length - 1;

          return (
            <div key={stage.id} className="relative flex items-start gap-3">
              {/* Connecting vertical line */}
              {!isLast && (
                <div
                  className={`absolute left-[11px] top-6 bottom-0 w-[1.5px] -z-0 ${
                    isDone
                      ? 'bg-black dark:bg-white'
                      : isFailed
                      ? 'bg-[#fb4903]'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                  style={{ height: 'calc(100% + 6px)' }}
                />
              )}

              {/* Status Node Icon */}
              <div className="relative z-10 shrink-0 mt-0.5">
                {isDone ? (
                  <div className="w-6 h-6 rounded-full bg-[#55db9c] border-[1.5px] border-black text-black flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : isFailed ? (
                  <div className="w-6 h-6 rounded-full bg-[#fb4903] border-[1.5px] border-black text-white flex items-center justify-center font-bold text-xs">
                    ✕
                  </div>
                ) : isInProgress ? (
                  <div className="w-6 h-6 rounded-full bg-[#ffd731] border-[1.5px] border-black text-black flex items-center justify-center shadow-xs">
                    <div className="w-2 h-2 rounded-full bg-black animate-ping" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-[#202634] border border-gray-300 dark:border-gray-600 flex items-center justify-center" />
                )}
              </div>

              {/* Step Text Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4
                    className={`text-xs font-bold ${
                      isDone || isInProgress
                        ? 'text-gray-900 dark:text-white'
                        : isFailed
                        ? 'text-[#fb4903] font-extrabold'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {stage.title}
                  </h4>
                  {stage.timestamp && (
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                      {stage.timestamp}
                    </span>
                  )}
                </div>
                <p className={`text-[11px] mt-0.5 ${isFailed ? 'text-[#fb4903] font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explorer Links & Action Controls */}
      <div className="space-y-2 pt-1">
        {isAnyFailed ? (
          <button
            onClick={() => setCurrentStep(2)}
            className="w-full py-3.5 px-4 rounded-full bg-[#fb4903] border-[1.5px] border-black text-white font-extrabold text-sm hover:opacity-90 transition-all"
          >
            Transaction Rejected · Try Again
          </button>
        ) : (
          (sourceExplorerLink || (isCrossChain && destExplorerLink)) && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              {sourceExplorerLink && (
                <a
                  href={sourceExplorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1a202c] border border-black text-[11px] font-bold text-gray-900 dark:text-white hover:bg-[#ffd731] hover:text-black transition-colors"
                >
                  <span>{sourceChain.name} Tx</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {isCrossChain && destExplorerLink && (
                <a
                  href={destExplorerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1a202c] border border-black text-[11px] font-bold text-gray-900 dark:text-white hover:bg-[#ffd731] hover:text-black transition-colors"
                >
                  <span>{destChain.name} Mint Tx</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};


