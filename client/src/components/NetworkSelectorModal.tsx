import React, { useState, useEffect } from 'react';
import { usePayment } from '../context/PaymentContext';
import { SUPPORTED_CHAINS } from '../config/chains';
import { Chain } from '../types';
import { X, Search, Check, ShieldCheck, Globe, FlaskConical, Layers } from 'lucide-react';
import { ChainIcon } from './ChainIcon';

export const NetworkSelectorModal: React.FC = () => {
  const {
    isChainModalOpen,
    setIsChainModalOpen,
    chainModalMode,
    sourceChain,
    setSourceChain,
    destChain,
    setDestChain,
    recipient,
    isTestnetMode
  } = usePayment();

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'mainnet' | 'testnet'>(() => (isTestnetMode ? 'testnet' : 'all'));

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsChainModalOpen(false);
      }
    };
    if (isChainModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChainModalOpen, setIsChainModalOpen]);

  if (!isChainModalOpen) return null;

  const currentSelected = chainModalMode === 'source' ? sourceChain : destChain;

  const availableChains = SUPPORTED_CHAINS.filter((c) => {
    if (chainModalMode === 'dest' && recipient.isValid && recipient.address && recipient.chainType) {
      return c.type === recipient.chainType;
    }
    return true;
  });

  const tabFilteredChains = availableChains.filter((c) => {
    if (activeTab === 'mainnet') return !c.isTestnet;
    if (activeTab === 'testnet') return !!c.isTestnet;
    return true;
  });

  const filteredChains = tabFilteredChains.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subtitle.toLowerCase().includes(search.toLowerCase()) ||
    (c.nativeCurrency && c.nativeCurrency.toLowerCase().includes(search.toLowerCase()))
  );

  const recipientChainLabel = recipient.chainType === 'evm' ? 'EVM / Ethereum compatible' : recipient.chainType === 'solana' ? 'Solana' : recipient.chainType === 'sui' ? 'Sui' : '';

  const handleSelectChain = (chain: Chain) => {
    if (chainModalMode === 'source') {
      setSourceChain(chain);
    } else {
      setDestChain(chain);
    }
    setIsChainModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in cursor-pointer"
      onClick={() => setIsChainModalOpen(false)}
    >
      <div
        className="w-[calc(100vw-2rem)] max-w-sm bg-white dark:bg-[#151922] border-[1.5px] border-black dark:border-[#2b3245] rounded-[24px] sm:rounded-[28px] shadow-lg p-4 sm:p-5 space-y-3.5 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-display font-extrabold text-gray-900 dark:text-white">
              Select {chainModalMode === 'source' ? 'Source' : 'Destination'}
            </h3>
            {chainModalMode === 'dest' && recipient.isValid && recipient.chainType && (
              <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Filtered to {recipientChainLabel}
              </p>
            )}
          </div>
          <button
            onClick={() => setIsChainModalOpen(false)}
            className="w-7 h-7 rounded-full border-[1.5px] border-black bg-white dark:bg-[#1f2533] flex items-center justify-center text-black dark:text-white hover:bg-[#e9ccff] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recipient Chain Filter Banner */}
        {chainModalMode === 'dest' && recipient.isValid && recipient.chainType && (
          <div className="px-3 py-1.5 bg-[#e9ccff] border border-black rounded-full flex items-center gap-1.5 text-xs font-bold text-black">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>Compatible networks only</span>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search network..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 dark:bg-[#202634] border border-black rounded-2xl text-xs font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-black"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Filter Pills (All / Mainnets / Testnets) */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-[#202634] rounded-full border border-black text-xs font-bold">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-full text-[11px] transition-all ${
              activeTab === 'all'
                ? 'bg-black text-white'
                : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>All ({availableChains.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('mainnet')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-full text-[11px] transition-all ${
              activeTab === 'mainnet'
                ? 'bg-black text-white'
                : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <Globe className="w-3 h-3" />
            <span>Mainnets</span>
          </button>
          <button
            onClick={() => setActiveTab('testnet')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-full text-[11px] transition-all ${
              activeTab === 'testnet'
                ? 'bg-black text-white'
                : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
            }`}
          >
            <FlaskConical className="w-3 h-3" />
            <span>Testnets</span>
          </button>
        </div>

        {/* Chains List */}
        <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
          {filteredChains.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-400">
              No networks match "{search}"
            </div>
          ) : (
            filteredChains.map((chain) => {
              const isSelected = currentSelected.id === chain.id;

              return (
                <button
                  key={chain.id}
                  onClick={() => handleSelectChain(chain)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                    isSelected
                      ? 'bg-[#e9ccff] border-black font-extrabold text-black'
                      : 'bg-white dark:bg-[#1a202c] border-transparent hover:border-black hover:bg-gray-50 dark:hover:bg-[#202634]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                      <ChainIcon chain={chain} />
                    </div>
                    <div className="text-left">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-xs text-gray-900 dark:text-white">
                          {chain.name}
                        </p>
                        {chain.isTestnet && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#ffd731] border border-black text-black font-extrabold uppercase">
                            Testnet
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {chain.subtitle}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-[#55db9c] border border-black text-black flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};


