import React, { useState, useEffect } from 'react';
import { usePayment } from '../context/PaymentContext';
import { X, ExternalLink, CheckCircle2, Clock, Copy } from 'lucide-react';
import { getExplorerTxUrl } from '../config/chains';

export const ActivityModal: React.FC = () => {
  const { isActivityOpen, setIsActivityOpen, history } = usePayment();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsActivityOpen(false);
      }
    };
    if (isActivityOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActivityOpen, setIsActivityOpen]);

  if (!isActivityOpen) return null;

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in cursor-pointer"
      onClick={() => setIsActivityOpen(false)}
    >
      <div
        className="w-[calc(100vw-2rem)] max-w-md bg-white dark:bg-[#151922] border-[1.5px] border-black dark:border-[#2b3245] rounded-[24px] sm:rounded-[28px] shadow-xs p-4 sm:p-5 space-y-4 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-[#e9ccff] border-[1.5px] border-black flex items-center justify-center text-black shrink-0">
              <Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-display font-extrabold text-gray-900 dark:text-white">
                Payment History
              </h3>
              <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400">
                Recent cross-chain transactions
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsActivityOpen(false)}
            className="w-7 h-7 rounded-full border-[1.5px] border-black bg-white dark:bg-[#1f2533] flex items-center justify-center text-black dark:text-white hover:bg-[#e9ccff] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transactions List */}
        <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <div className="py-10 text-center text-xs text-gray-400 space-y-1">
              <p className="font-bold text-gray-700 dark:text-gray-300">No transactions yet</p>
              <p>Your payment activity will appear here.</p>
            </div>
          ) : (
            history.map((tx) => {
              const isCrossChain = tx.fromChain.id !== tx.toChain.id;

              return (
                <div
                  key={tx.id}
                  className="p-3.5 bg-gray-50/80 dark:bg-[#1a202c] border border-gray-200 dark:border-[#2e374c] rounded-2xl space-y-2 text-xs hover:border-black transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white">
                      <span className="text-sm font-display font-extrabold">{tx.amount.toFixed(2)} USDC</span>
                      <span className="text-gray-400">→</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#e9ccff] border border-black text-[10px] text-black font-extrabold">
                        {tx.recipient.displayName || 'Alice'}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#55db9c] border border-black text-black">
                      <CheckCircle2 className="w-3 h-3" />
                      Completed
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1 font-semibold">
                      <span>{tx.fromChain.name}</span>
                      <span>→</span>
                      <span>{tx.toChain.name}</span>
                    </span>
                    <span className="font-mono text-[10px]">{tx.timestamp}</span>
                  </div>

                  <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1 text-gray-500 font-mono">
                      <span>{tx.txHash ? `${tx.txHash.slice(0, 8)}...${tx.txHash.slice(-6)}` : 'On-chain'}</span>
                      {tx.txHash && (
                        <button
                          type="button"
                          onClick={() => handleCopy(tx.id, tx.txHash!)}
                          className="hover:text-black dark:hover:text-white"
                          title="Copy Tx Hash"
                        >
                          {copiedId === tx.id ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {tx.txHash && (
                        <a
                          href={getExplorerTxUrl(tx.fromChain, tx.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-[#151922] border border-black text-black dark:text-white hover:bg-[#ffd731] transition-colors font-bold"
                          title={`View on ${tx.fromChain.name} Explorer`}
                        >
                          <span>Tx</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {tx.destTxHash && getExplorerTxUrl(tx.toChain, tx.destTxHash) ? (
                        <a
                          href={getExplorerTxUrl(tx.toChain, tx.destTxHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white dark:bg-[#151922] border border-black text-black dark:text-white hover:bg-[#ffd731] transition-colors font-bold"
                          title={`View on ${tx.toChain.name} Explorer`}
                        >
                          <span>Mint Tx</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : isCrossChain ? (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#55db9c]/30 text-emerald-800 dark:text-[#55db9c]">
                          Auto-relayed
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};


