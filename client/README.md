# Yucarn — Universal Multi-Chain Payment Portal

> **Seamless, 1-Click Cross-Chain USDC Payments** across 52+ blockchains including EVM, Solana, and Sui. Powered by Circle CCTP V1/V2, Arc forwarder contracts, and automated gasless relayers.

---

## 🚀 Overview: What is Yucarn & How It Helps

Yucarn eliminates the complexity and friction of cross-chain Web3 payments. Traditionally, sending USDC across different blockchains requires users to deal with complex bridges, switch wallet RPC networks, obtain native gas tokens for the destination chain, and compute fluctuating gas fees.

**Yucarn solves this entirely:**
- **Zero Destination Gas Required**: Senders or recipients pay zero gas on the destination chain.
- **1-Click Settlement**: The automated background relayer handles Circle CCTP attestation retrieval and destination minting.
- **Exact Payout Guarantee**: Calibrated mint gross-up (`0.024 USDC`) ensures the recipient gets the exact requested amount down to the penny.
- **Universal Multi-Chain Access**: Supports 52+ EVM mainnets and testnets, Solana, and Sui in a unified interface.

---

## ✨ Core Working Features

- 🌐 **52+ Chain Network Selector**: Filterable search across EVM, Solana, Sui, Mainnets, and Testnets with quick mode toggles.
- ⚡ **Circle CCTP V1 & V2 Integration**: High-speed native USDC burn-and-mint cross-chain settlement with Circle attestation polling.
- 🎯 **Arc Network Forwarding**: Smart forwarder contract routing with calibrated mint gross-up guarantee.
- 🤖 **Automated Gasless Relayer**: Background service automatically submits destination mint transactions, removing manual network switching prompts.
- 👛 **Reown AppKit Wallet Hub**: Email/Social logins, Passkeys, MetaMask, Coinbase Wallet, Phantom, Sui Wallet, and 300+ WalletConnect options.
- 💰 **Base Protocol Treasury Fee**: Transparent $0.20 flat fee total ($0.02 Circle protocol allocation, $0.18 Yucarn treasury fee on Base).
- 🎨 **Responsive Neobrutalist UI**: High-contrast border aesthetics, dark/light mode toggle, backdrop click-to-close modals, and optimized mobile navigation pill.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend Framework** | React 18, Vite 6, TypeScript 5 |
| **Styling & UI** | TailwindCSS 3, Lucide Icons, Canvas Confetti |
| **EVM Core & Web3** | Viem 2, Wagmi 2, Reown AppKit (`@reown/appkit`) |
| **Cross-Chain Engine** | Circle Bridge Kit (`@circle-fin/bridge-kit`), Circle Viem Adapter V2 |
| **Non-EVM Networks** | `@mysten/sui`, `@mysten/suins`, `@solana/web3.js`, Spl Name Service |
| **Build & Deployment** | Node.js 24, Vite Rollup |
---

## ⚙️ Environment Variables

Copy the example environment template to create your `.env` file:

```bash
cp .env.example .env
```

### Configuration Reference

```env
# ------------------------------------------------------------------------------
# 1. Reown AppKit / WalletConnect Cloud Project ID (https://cloud.reown.com)
# ------------------------------------------------------------------------------
VITE_PROJECT_ID=b56e18d47c72ab683b10814fe9495694
VITE_REOWN_PROJECT_ID=b56e18d47c72ab683b10814fe9495694

# ------------------------------------------------------------------------------
# 2. Automated Background Relayer Keys (Gasless 1-Click Settlement)
# ------------------------------------------------------------------------------
# EVM Relayer Private Key (64 hex characters with 0x prefix)
VITE_RELAYER_PRIVATE_KEY=

# Sui Relayer Private Key (0x... hex or suiprivkey...)
VITE_SUI_RELAYER_PRIVATE_KEY=

# ------------------------------------------------------------------------------
# 3. Protocol Treasury Addresses (Base Network)
# ------------------------------------------------------------------------------
VITE_YUCARN_TREASURY_ADDRESS=0x127c1A164b00639FAA338E38F3150b12D313420A
VITE_YUCARN_TESTNET_TREASURY_ADDRESS=0x127c1A164b00639FAA338E38F3150b12D313420A

# Legacy Aliases (Supported for backwards compatibility)
VITE_UNIPAY_TREASURY_ADDRESS=0x127c1A164b00639FAA338E38F3150b12D313420A
VITE_UNIPAY_TESTNET_TREASURY_ADDRESS=0x127c1A164b00639FAA338E38F3150b12D313420A
```

---

## 📦 Installation & Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Start local development server (http://localhost:5173)
npm run dev

# 3. Perform TypeScript type check
npx tsc --noEmit

# 4. Build production bundle
npm run build
```
