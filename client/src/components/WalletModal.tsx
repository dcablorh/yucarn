import React, { useState, useEffect } from 'react';
import { usePayment } from '../context/PaymentContext';
import { X, Power, Copy, CheckCircle2, Wallet, ExternalLink, ShieldCheck, Check } from 'lucide-react';
import { getExplorerAddressUrl } from '../config/chains';
import { WalletIcon } from './WalletIcon';

export const WalletModal: React.FC = () => {
  const {
    isWalletModalOpen,
    setIsWalletModalOpen,
    walletConnected,
    walletAddress,
    userBalance,
    sourceChain,
    connectWallet,
    disconnectWallet,
    openReownModal
  } = usePayment();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWalletModalOpen(false);
      }
    };
    if (isWalletModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWalletModalOpen, setIsWalletModalOpen]);

  if (!isWalletModalOpen) return null;

  const handleOpenAppKit = () => {
    setIsWalletModalOpen(false);
    openReownModal();
  };

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setIsWalletModalOpen(false);
  };

  const truncatedAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';

  const explorerAddressLink = walletAddress ? getExplorerAddressUrl(sourceChain, walletAddress) : '';

  const wallets = [
    {
      name: 'Reown AppKit',
      description: 'Email, Social & 300+ Wallets',
      icon: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.svg',
      recommended: true,
      isReown: true
    },
    {
      name: 'MetaMask',
      description: 'Browser Extension & Mobile',
      icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg'
    },
    {
      name: 'Coinbase Wallet',
      description: 'Smart Wallet & Passkeys',
      icon: 'https://raw.githubusercontent.com/base-org/brand-kit/main/logo/in-product/Base_Network_Logo.svg'
    },
    {
      name: 'Sui Wallet',
      description: 'Sui Network & SuiNS',
      icon: 'https://cryptologos.cc/logos/sui-sui-logo.svg'
    },
    {
      name: 'Phantom',
      description: 'Solana & Multi-chain',
      icon: 'https://cryptologos.cc/logos/solana-sol-logo.svg'
    }
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs animate-fade-in cursor-pointer"
      onClick={() => setIsWalletModalOpen(false)}
    >
      <div
        className="w-[calc(100vw-2rem)] max-w-sm bg-white dark:bg-[#151922] border-[1.5px] border-black dark:border-[#2b3245] rounded-[24px] sm:rounded-[28px] shadow-lg p-4 sm:p-5 space-y-4 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-[#dceeff] dark:bg-blue-900/30 border-[1.5px] border-black flex items-center justify-center text-blue-600 shrink-0">
              <Wallet className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-black dark:text-white" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-display font-extrabold text-gray-900 dark:text-white">
                {walletConnected ? 'Account' : 'Connect Wallet'}
              </h3>
              <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400">
                {walletConnected ? 'Connected to Yucarn' : 'Choose how to connect to Yucarn'}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsWalletModalOpen(false)}
            className="w-7 h-7 rounded-full border-[1.5px] border-black bg-white dark:bg-[#1f2533] flex items-center justify-center text-black dark:text-white hover:bg-[#e9ccff] transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connected state */}
        {walletConnected ? (
          <div className="space-y-3.5">
            {/* Active Account Card */}
            <div className="p-4 bg-gray-50 dark:bg-[#1f2533] border-[1.5px] border-black dark:border-[#2e374c] rounded-2xl space-y-3 text-center">
              {/* Avatar circle */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className="w-14 h-14 rounded-full bg-[#55db9c]/20 border-[1.5px] border-black flex items-center justify-center text-xl font-bold font-display text-black dark:text-white">
                    {walletAddress ? walletAddress.slice(2, 4).toUpperCase() : '0x'}
                  </div>
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[#55db9c] border-[1.5px] border-black" />
                </div>
              </div>

              {/* Address label */}
              <div>
                <span className="font-mono text-xs font-extrabold text-gray-900 dark:text-white block">
                  {truncatedAddress}
                </span>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {sourceChain.name} Network
                </p>
              </div>
            </div>

            {/* Action Buttons: Copy Address & Explorer side-by-side + Disconnect */}
            <div className="space-y-2">
              {/* Side-by-side Row */}
              <div className="grid grid-cols-2 gap-2">
                {/* Copy Address Button */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="py-2 px-2.5 rounded-full bg-white dark:bg-[#1a202c] hover:bg-[#ffd731] hover:text-black border-[1.5px] border-black text-gray-900 dark:text-white font-extrabold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-2xs"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 shrink-0" />
                      <span>Copy Address</span>
                    </>
                  )}
                </button>

                {/* View on Explorer Link */}
                {explorerAddressLink ? (
                  <a
                    href={explorerAddressLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2 px-2.5 rounded-full bg-gray-50 dark:bg-[#1f2533] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:text-black dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors truncate"
                  >
                    <span className="truncate">Explorer</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <div className="py-2 px-2.5 rounded-full bg-gray-50 dark:bg-[#1f2533] border border-gray-200 dark:border-gray-700 text-gray-400 font-bold text-[11px] flex items-center justify-center">
                    <span>Explorer</span>
                  </div>
                )}
              </div>

              {/* Disconnect Button */}
              <button
                type="button"
                onClick={handleDisconnect}
                className="w-full py-2.5 px-4 rounded-full bg-[#fb4903] hover:bg-red-600 border-[1.5px] border-black text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-2xs"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Disconnect Wallet</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {wallets.map((w) => (
              <button
                key={w.name}
                onClick={() => (w.isReown ? handleOpenAppKit() : connectWallet(w.name))}
                className="w-full flex items-center justify-between p-3 bg-white dark:bg-[#1a202c] border-[1.5px] border-black dark:border-[#2e374c] rounded-2xl hover:bg-[#e9ccff] dark:hover:bg-purple-900/30 hover:border-black transition-all group text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center shrink-0 overflow-hidden">
                    <WalletIcon wallet={w} />
                  </div>
                  <div>
                    <span className="font-bold text-xs text-gray-900 dark:text-white group-hover:text-black">
                      {w.name}
                    </span>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">
                      {w.description}
                    </p>
                  </div>
                </div>
                {w.recommended && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffd731] border border-black text-black font-extrabold uppercase shrink-0">
                    Popular
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


