import React, { useState } from 'react';
import { Chain } from '../types';

interface ChainIconProps {
  chain?: Chain | { id?: string; name?: string; icon?: string; color?: string };
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ChainIcon: React.FC<ChainIconProps> = ({ chain, className = 'w-full h-full' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  if (!chain) {
    return (
      <div className={`rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center font-bold text-[9px] ${className}`}>
        ?
      </div>
    );
  }

  const id = (chain.id || '').toLowerCase();
  const name = (chain.name || '').toLowerCase();

  // 1. Direct Vector SVG for Base / Base Sepolia
  if (id.includes('base') || name.includes('base')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#0052FF" />
        <path
          d="M16 25C20.9706 25 25 20.9706 25 16C25 11.0294 20.9706 7 16 7C11.3 7 7.4 10.5 7.03 15.1H19.5V16.9H7.03C7.4 21.5 11.3 25 16 25Z"
          fill="white"
        />
      </svg>
    );
  }

  // 2. Direct Vector SVG for Ethereum / Sepolia / Holesky
  if (id.includes('eth') || id.includes('sepolia') || id.includes('holesky') || name.includes('ethereum') || name.includes('sepolia')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#627EEA" />
        <path d="M16 5L9.5 15.6L16 19.4L22.5 15.6L16 5Z" fill="white" fillOpacity="0.7" />
        <path d="M16 5L16 19.4L22.5 15.6L16 5Z" fill="white" />
        <path d="M16 20.8L9.5 17L16 27L22.5 17L16 20.8Z" fill="white" fillOpacity="0.7" />
        <path d="M16 27L16 20.8L22.5 17L16 27Z" fill="white" />
      </svg>
    );
  }

  // 3. Direct Vector SVG for Arbitrum
  if (id.includes('arbitrum') || name.includes('arbitrum')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#28A0F0" />
        <path d="M19.5 13.8L16 7.8L12.3 14.3L15.1 16L18.6 10.1L20.6 13.8L19.5 13.8ZM12.5 17.7L16 23.8L19.7 17.2L16.9 15.5L13.4 21.4L11.4 17.7H12.5Z" fill="white" />
      </svg>
    );
  }

  // 4. Direct Vector SVG for Optimism / OP
  if (id.includes('optimism') || id.includes('op-') || name.includes('op ') || name.includes('optimism')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#FF0420" />
        <path d="M8.5 16C8.5 12.4 11.4 9.5 15 9.5C18.6 9.5 21.5 12.4 21.5 16C21.5 19.6 18.6 22.5 15 22.5C11.4 22.5 8.5 19.6 8.5 16ZM15 11.8C12.7 11.8 10.8 13.7 10.8 16C10.8 18.3 12.7 20.2 15 20.2C17.3 20.2 19.2 18.3 19.2 16C19.2 13.7 17.3 11.8 15 11.8Z" fill="white" />
      </svg>
    );
  }

  // 5. Direct Vector SVG for Polygon / Amoy
  if (id.includes('polygon') || id.includes('matic') || id.includes('amoy') || name.includes('polygon')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#8247E5" />
        <path d="M21.5 13.5L17.5 11.2V15.7L21.5 18V13.5ZM10.5 18.5L14.5 20.8V16.3L10.5 14V18.5ZM16 7.5L12 9.8L16 12.1L20 9.8L16 7.5ZM16 24.5L20 22.2L16 19.9L12 22.2L16 24.5Z" fill="white" />
      </svg>
    );
  }

  // 6. Direct Vector SVG for Solana
  if (id.includes('solana') || name.includes('solana')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#000000" />
        <path d="M8.5 20.2L11 17.7H23.5L21 20.2H8.5ZM8.5 11.8H21L23.5 14.3H11L8.5 11.8ZM11 6H23.5L21 8.5H8.5L11 6Z" fill="#14F195" />
      </svg>
    );
  }

  // 7. Direct Vector SVG for Sui
  if (id.includes('sui') || name.includes('sui')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#4DA2FF" />
        <path d="M16 6C16 6 9.5 13.8 9.5 18.2C9.5 21.8 12.4 24.7 16 24.7C19.6 24.7 22.5 21.8 22.5 18.2C22.5 13.8 16 6 16 6ZM16 22.2C13.8 22.2 12 20.4 12 18.2C12 15.3 15.1 10.4 16 9C16.9 10.4 20 15.3 20 18.2C20 20.4 18.2 22.2 16 22.2Z" fill="white" />
      </svg>
    );
  }

  // 8. Direct Vector SVG for Avalanche / Fuji
  if (id.includes('avalanche') || id.includes('fuji') || id.includes('avax') || name.includes('avalanche')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#E84142" />
        <path d="M16 7L24 22H19.5L16 15.5L14.5 18.5H11.5L16 7ZM10.5 20.5L8 25H24L22.5 22H12L10.5 20.5Z" fill="white" />
      </svg>
    );
  }

  // 9. Direct Vector SVG for Unichain
  if (id.includes('unichain') || name.includes('unichain')) {
    return (
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <circle cx="16" cy="16" r="16" fill="#FF007A" />
        <path d="M11 9C11 7.3 12.3 6 14 6H18C19.7 6 21 7.3 21 9V17C21 19.8 18.8 22 16 22C13.2 22 11 19.8 11 17V9Z" fill="white" />
        <circle cx="16" cy="25" r="2" fill="white" />
      </svg>
    );
  }

  // 10. Try external icon with fallback if not errored
  if (chain.icon && !imgFailed) {
    return (
      <img
        src={chain.icon}
        alt={chain.name || 'Chain'}
        className={`${className} object-contain`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  // Fallback stylish letter badge with chain color
  const initial = (chain.name || chain.id || '?').slice(0, 2).toUpperCase();
  const bgColor = chain.color || '#6366f1';

  return (
    <div
      className={`rounded-full flex items-center justify-center font-extrabold text-[9px] text-white shadow-xs ${className}`}
      style={{ backgroundColor: bgColor }}
    >
      {initial}
    </div>
  );
};
