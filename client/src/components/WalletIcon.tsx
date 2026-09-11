import React, { useState } from 'react';

interface WalletIconProps {
  wallet: {
    name: string;
    icon?: string;
    isReown?: boolean;
  };
  className?: string;
}

export const WalletIcon: React.FC<WalletIconProps> = ({ wallet, className = 'w-full h-full' }) => {
  const [imgFailed, setImgFailed] = useState(false);
  const name = wallet.name.toLowerCase();

  // 1. Reown AppKit / WalletConnect
  if (wallet.isReown || name.includes('reown') || name.includes('walletconnect')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#3B99FC" />
        <path
          d="M10.2 13.5C13.4 10.3 18.6 10.3 21.8 13.5L22.2 13.9C22.4 14.1 22.4 14.5 22.2 14.7L20.8 16.1C20.7 16.2 20.5 16.2 20.4 16.1L19.8 15.5C17.7 13.4 14.3 13.4 12.2 15.5L11.5 16.2C11.4 16.3 11.2 16.3 11.1 16.2L9.7 14.8C9.5 14.6 9.5 14.2 9.7 14L10.2 13.5ZM24.3 16C24.5 16.2 24.5 16.6 24.3 16.8L18.8 22.3C18.6 22.5 18.2 22.5 18 22.3L16 20.3C15.9 20.2 15.7 20.2 15.6 20.3L13.6 22.3C13.4 22.5 13 22.5 12.8 22.3L7.3 16.8C7.1 16.6 7.1 16.2 7.3 16L8.7 14.6C8.8 14.5 9 14.5 9.1 14.6L13.1 18.6C13.2 18.7 13.4 18.7 13.5 18.6L15.5 16.6C15.7 16.4 16.1 16.4 16.3 16.6L18.3 18.6C18.4 18.7 18.6 18.7 18.7 18.6L22.7 14.6C22.8 14.5 23 14.5 23.1 14.6L24.3 16Z"
          fill="white"
        />
      </svg>
    );
  }

  // 2. MetaMask
  if (name.includes('metamask')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M26.5 6L17.5 12.5L19.5 8L26.5 6Z" fill="#E2761B" stroke="#E2761B" strokeWidth="0.5" />
        <path d="M5.5 6L14.4 12.6L12.5 8L5.5 6Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" />
        <path d="M23 21L20.5 25L25.5 26.5L27 21H23Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" />
        <path d="M9 21L5 21L6.5 26.5L11.5 25L9 21Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" />
        <path d="M10.8 14L9 17.5L13.5 18L13.5 13.5L10.8 14Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" />
        <path d="M21.2 14L18.5 13.5L18.5 18L23 17.5L21.2 14Z" fill="#E4761B" stroke="#E4761B" strokeWidth="0.5" />
        <path d="M11.5 25L14.5 23.2L12 21.5L11.5 25Z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="0.5" />
        <path d="M20.5 25L20 21.5L17.5 23.2L20.5 25Z" fill="#D7C1B3" stroke="#D7C1B3" strokeWidth="0.5" />
        <path d="M14.5 23.2L17.5 23.2L16 26.5L14.5 23.2Z" fill="#233447" stroke="#233447" strokeWidth="0.5" />
        <path d="M18.5 13.5L16 10.2L13.5 13.5L13.5 18L16 19.5L18.5 18L18.5 13.5Z" fill="#CD6116" stroke="#CD6116" strokeWidth="0.5" />
      </svg>
    );
  }

  // 3. Coinbase Wallet
  if (name.includes('coinbase')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#0052FF" />
        <rect x="9.5" y="9.5" width="13" height="13" rx="4" fill="white" />
        <rect x="13" y="13" width="6" height="6" rx="1.5" fill="#0052FF" />
      </svg>
    );
  }

  // 4. Sui Wallet
  if (name.includes('sui')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#4DA2FF" />
        <path d="M16 6C16 6 9.5 13.8 9.5 18.2C9.5 21.8 12.4 24.7 16 24.7C19.6 24.7 22.5 21.8 22.5 18.2C22.5 13.8 16 6 16 6ZM16 22.2C13.8 22.2 12 20.4 12 18.2C12 15.3 15.1 10.4 16 9C16.9 10.4 20 15.3 20 18.2C20 20.4 18.2 22.2 16 22.2Z" fill="white" />
      </svg>
    );
  }

  // 5. Phantom Wallet
  if (name.includes('phantom')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#AB9FF2" />
        <path d="M22.5 16C22.5 19.6 19.6 22.5 16 22.5C13.5 22.5 11.5 21.5 10 19.5L13.5 17C14.5 18 15 18.5 16 18.5C17.4 18.5 18.5 17.4 18.5 16C18.5 14.6 17.4 13.5 16 13.5C14.6 13.5 13.5 14.6 13.5 16V17H9.5V16C9.5 12.4 12.4 9.5 16 9.5C19.6 9.5 22.5 12.4 22.5 16Z" fill="white" />
        <circle cx="19" cy="14" r="1" fill="#4B3C96" />
        <circle cx="14" cy="14" r="1" fill="#4B3C96" />
      </svg>
    );
  }

  if (wallet.icon && !imgFailed) {
    return (
      <img
        src={wallet.icon}
        alt={wallet.name}
        className={`${className} object-contain`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div className={`rounded-full bg-blue-500 text-white font-bold flex items-center justify-center text-xs ${className}`}>
      {wallet.name.slice(0, 1).toUpperCase()}
    </div>
  );
};
