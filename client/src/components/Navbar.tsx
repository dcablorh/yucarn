import React from 'react';
import { usePayment } from '../context/PaymentContext';
import { useTheme } from '../context/ThemeContext';
import { Zap, Moon, Sun, Link2, ChevronDown } from 'lucide-react';
import { ChainIcon } from './ChainIcon';

export const Navbar: React.FC = () => {
  const { 
    walletConnected, 
    walletAddress, 
    openReownModal,
    setIsWalletModalOpen,
    setIsActivityOpen,
    sourceChain,
    openChainModal,
    isTestnetMode,
    toggleTestnetMode
  } = usePayment();
  const { theme, toggleTheme } = useTheme();

  const truncatedAddress = walletAddress 
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-3)}`
    : '';

  return (
    <header className="w-full pt-3 sm:pt-4 pb-2 px-2 sm:px-4 max-w-3xl mx-auto">
      {/* Floating Pill Nav Bar */}
      <nav className="flex items-center justify-between gap-1 sm:gap-2 px-2 py-1.5 sm:px-3.5 sm:py-2 bg-white dark:bg-[#151922] border-[1.5px] border-black dark:border-[#2b3245] rounded-full shadow-xs">
        {/* Brand Logo & TESTNET Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div 
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none group" 
            onClick={() => window.location.reload()}
          >
            {/* Brand logo icon */}
            <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl overflow-hidden border border-black flex items-center justify-center bg-[#55db9c] shadow-2xs group-hover:scale-105 transition-transform shrink-0">
              <img
                src="/yucarn-icon.png"
                alt="Yucarn"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const el = e.currentTarget;
                  el.style.display = 'none';
                  const fallback = el.parentElement?.querySelector('.fallback-icon');
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
              <Zap className="fallback-icon hidden w-3 h-3 sm:w-4 sm:h-4 fill-black text-black stroke-[2.5]" />
            </div>
            <span className="font-display font-extrabold text-sm sm:text-lg tracking-tight text-black dark:text-white">
              yucarn
            </span>
          </div>

          {/* Yellow TESTNET Badge */}
          <button
            onClick={toggleTestnetMode}
            title={`Click to switch to ${isTestnetMode ? 'Mainnet' : 'Testnet'} mode`}
            className="hidden xs:inline-flex px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold tracking-wider uppercase bg-[#ffd731] border border-black text-black transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            {isTestnetMode ? 'TESTNET' : 'MAINNET'}
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 min-w-0">
          {/* Source Chain Selector Pill */}
          <button
            onClick={() => openChainModal('source')}
            title="Switch Source Chain"
            className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 dark:bg-[#1f2533] text-gray-800 dark:text-gray-200 border border-black dark:border-[#2e374c] hover:bg-[#ffd731] hover:text-black transition-colors shrink-0 max-w-[85px] xs:max-w-[115px] sm:max-w-[140px]"
          >
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center overflow-hidden shrink-0">
              <ChainIcon chain={sourceChain} />
            </div>
            <span className="text-[10px] sm:text-xs truncate font-bold max-w-[45px] xs:max-w-[70px] sm:max-w-none">
              {sourceChain.name}
            </span>
            <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500 shrink-0" />
          </button>

          {/* Wallet State Pill (Connected vs Disconnected) */}
          {walletConnected ? (
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-full bg-gray-50 dark:bg-[#1f2533] border border-black dark:border-[#2e374c] text-gray-800 dark:text-gray-200 hover:bg-[#e9ccff] hover:text-black transition-all text-xs font-semibold shrink-0 max-w-[95px] xs:max-w-[120px] sm:max-w-[140px]"
            >
              <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#8b5cf6] border border-black/20 flex items-center justify-center text-[8px] sm:text-[9px] text-white font-bold shrink-0">
                {walletAddress ? walletAddress.slice(2, 4).toUpperCase() : '0x'}
              </div>
              <span className="font-mono text-[10px] sm:text-xs font-bold truncate">
                {truncatedAddress}
              </span>
              <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500 shrink-0" />
            </button>
          ) : (
            <button
              onClick={() => openReownModal()}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1 rounded-full bg-[#55db9c] hover:bg-[#4bc78d] border border-black text-black transition-all text-xs font-extrabold shadow-2xs shrink-0 cursor-pointer"
            >
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-black animate-pulse shrink-0" />
              <span className="text-[10px] sm:text-xs font-extrabold">
                Connect<span className="hidden sm:inline"> Wallet</span>
              </span>
            </button>
          )}

          {/* Activity link button */}
          <button
            onClick={() => setIsActivityOpen(true)}
            title="Transaction Activity"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black dark:border-[#2e374c] bg-white dark:bg-[#1f2533] flex items-center justify-center text-black dark:text-white hover:bg-[#ffd731] transition-colors shrink-0"
          >
            <Link2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black dark:border-[#2e374c] bg-white dark:bg-[#1f2533] flex items-center justify-center text-black dark:text-white hover:bg-[#e9ccff] transition-colors shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-800" />
            )}
          </button>
        </div>
      </nav>
    </header>
  );
};



