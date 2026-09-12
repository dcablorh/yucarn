# Yucarn Architecture & System Specification

This document provides visual architecture diagrams and deep technical specifications for **Yucarn** — Universal Cross-Chain Payment & Settlement Infrastructure.

---

## 📐 System Architecture Overview

Yucarn is designed as a modular monorepo spanning four distinct layers:

1. **Frontend Presentation Layer**:
   - **Marketing Landing Page** (`landingpage/`): Built with TanStack Start (SSR), React 19, and Vite 8 deployed to `https://yucarn.walbucket.com/`.
   - **Client Payment Portal SPA** (`client/`): Built with React 18, Vite 6, Viem, Wagmi, Reown AppKit, and Circle Bridge Kit deployed to `https://app.yucarn.walbucket.com/`.
   - **Business Merchant Dashboard** (`business/`): Built with Next.js 14, TailwindCSS, and Privy B2B SDK deployed to `https://business.yucarn.walbucket.com/`.

2. **Backend Services & Relayer Layer** (`server/`):
   - Built with **NestJS**, **Prisma ORM**, and **PostgreSQL 16**.
   - **Circle CCTP Relayer Service**: Automated attestation fetching & gasless destination mint submission.
   - **Arc Chain Event Watcher**: Real-time RPC log monitoring for gross-up USDC transfers.
   - **ENSv2 Sepolia Name Resolver & Registrar**: Subname registration and identity verification.

3. **Blockchain & Settlement Layer**:
   - **Circle CCTP V1 & V2 Engine**: Native burning of USDC on source chains and canonical minting on target chains.
   - **Arc Forwarder Smart Contracts**: Calibrated `0.024 USDC` mint gross-up calibration to guarantee net destination delivery.
   - **ENSv2 Sepolia Protocol**: Subname registry and permissioned resolver on Ethereum Sepolia.

---

## 🎨 Diagram 1: System Architecture Diagram

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 650" width="100%" height="100%">
  <defs>
    <linearGradient id="feGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3A8A" />
      <stop offset="100%" stop-color="#3B82F6" />
    </linearGradient>
    <linearGradient id="beGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#065F46" />
      <stop offset="100%" stop-color="#10B981" />
    </linearGradient>
    <linearGradient id="bcGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#581C87" />
      <stop offset="100%" stop-color="#8B5CF6" />
    </linearGradient>
    <linearGradient id="extGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9A3412" />
      <stop offset="100%" stop-color="#F97316" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.3" />
    </filter>
  </defs>

  <rect width="1000" height="650" fill="#0F172A" rx="12"/>

  <!-- Title -->
  <text x="500" y="40" text-anchor="middle" fill="#F8FAFC" font-family="Inter, sans-serif" font-size="22" font-weight="bold">Yucarn System Architecture Diagram</text>

  <!-- LAYER 1: FRONTEND (Blue) -->
  <rect x="40" y="70" width="920" height="120" rx="8" fill="url(#feGrad)" filter="url(#shadow)" opacity="0.9"/>
  <text x="60" y="95" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="14" font-weight="bold">FRONTEND LAYER (User Applications)</text>
  
  <rect x="60" y="110" width="270" height="65" rx="6" fill="#1E293B" stroke="#60A5FA" stroke-width="1.5"/>
  <text x="195" y="135" text-anchor="middle" fill="#60A5FA" font-size="13" font-weight="bold">Landing Page SPA</text>
  <text x="195" y="155" text-anchor="middle" fill="#94A3B8" font-size="11">yucarn.walbucket.com (TanStack)</text>

  <rect x="365" y="110" width="270" height="65" rx="6" fill="#1E293B" stroke="#60A5FA" stroke-width="1.5"/>
  <text x="500" y="135" text-anchor="middle" fill="#60A5FA" font-size="13" font-weight="bold">Client Payment Portal</text>
  <text x="500" y="155" text-anchor="middle" fill="#94A3B8" font-size="11">app.yucarn.walbucket.com (Vite/Reown)</text>

  <rect x="670" y="110" width="270" height="65" rx="6" fill="#1E293B" stroke="#60A5FA" stroke-width="1.5"/>
  <text x="805" y="135" text-anchor="middle" fill="#60A5FA" font-size="13" font-weight="bold">Business Merchant Portal</text>
  <text x="805" y="155" text-anchor="middle" fill="#94A3B8" font-size="11">business.yucarn.walbucket.com (Next/Privy)</text>

  <!-- LAYER 2: BACKEND (Green) -->
  <rect x="40" y="220" width="920" height="130" rx="8" fill="url(#beGrad)" filter="url(#shadow)" opacity="0.9"/>
  <text x="60" y="245" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="14" font-weight="bold">BACKEND &amp; RELAYER LAYER (NestJS Core API)</text>

  <rect x="60" y="260" width="200" height="70" rx="6" fill="#1E293B" stroke="#34D399" stroke-width="1.5"/>
  <text x="160" y="288" text-anchor="middle" fill="#34D399" font-size="13" font-weight="bold">CCTP Relayer</text>
  <text x="160" y="308" text-anchor="middle" fill="#94A3B8" font-size="11">Gasless Mint Executor</text>

  <rect x="290" y="260" width="200" height="70" rx="6" fill="#1E293B" stroke="#34D399" stroke-width="1.5"/>
  <text x="390" y="288" text-anchor="middle" fill="#34D399" font-size="13" font-weight="bold">Arc Chain Watcher</text>
  <text x="390" y="308" text-anchor="middle" fill="#94A3B8" font-size="11">RPC Event Listener</text>

  <rect x="520" y="260" width="200" height="70" rx="6" fill="#1E293B" stroke="#34D399" stroke-width="1.5"/>
  <text x="620" y="288" text-anchor="middle" fill="#34D399" font-size="13" font-weight="bold">ENSv2 Subname Manager</text>
  <text x="620" y="308" text-anchor="middle" fill="#94A3B8" font-size="11">Sepolia Name Registrar</text>

  <rect x="750" y="260" width="190" height="70" rx="6" fill="#1E293B" stroke="#34D399" stroke-width="1.5"/>
  <text x="845" y="288" text-anchor="middle" fill="#34D399" font-size="13" font-weight="bold">PostgreSQL 16 DB</text>
  <text x="845" y="308" text-anchor="middle" fill="#94A3B8" font-size="11">Prisma ORM Datastore</text>

  <!-- LAYER 3: BLOCKCHAIN (Purple) -->
  <rect x="40" y="380" width="920" height="120" rx="8" fill="url(#bcGrad)" filter="url(#shadow)" opacity="0.9"/>
  <text x="60" y="405" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="14" font-weight="bold">BLOCKCHAIN &amp; SETTLEMENT LAYER</text>

  <rect x="60" y="420" width="270" height="65" rx="6" fill="#1E293B" stroke="#C084FC" stroke-width="1.5"/>
  <text x="195" y="445" text-anchor="middle" fill="#C084FC" font-size="13" font-weight="bold">Circle CCTP V1 &amp; V2 Engine</text>
  <text x="195" y="465" text-anchor="middle" fill="#94A3B8" font-size="11">52+ EVM Chains Native USDC</text>

  <rect x="365" y="420" width="270" height="65" rx="6" fill="#1E293B" stroke="#C084FC" stroke-width="1.5"/>
  <text x="500" y="445" text-anchor="middle" fill="#C084FC" font-size="13" font-weight="bold">Arc Forwarder Contracts</text>
  <text x="500" y="465" text-anchor="middle" fill="#94A3B8" font-size="11">0.024 USDC Gross-Up Fee Calibration</text>

  <rect x="670" y="420" width="270" height="65" rx="6" fill="#1E293B" stroke="#C084FC" stroke-width="1.5"/>
  <text x="805" y="445" text-anchor="middle" fill="#C084FC" font-size="13" font-weight="bold">ENSv2 Sepolia Protocol</text>
  <text x="805" y="465" text-anchor="middle" fill="#94A3B8" font-size="11">Hierarchical Registry &amp; Resolver</text>

  <!-- LAYER 4: EXTERNAL SERVICES (Orange) -->
  <rect x="40" y="530" width="920" height="90" rx="8" fill="url(#extGrad)" filter="url(#shadow)" opacity="0.9"/>
  <text x="60" y="555" fill="#FFFFFF" font-family="Inter, sans-serif" font-size="14" font-weight="bold">EXTERNAL PROTOCOLS &amp; SERVICES</text>

  <rect x="60" y="565" width="270" height="45" rx="6" fill="#1E293B" stroke="#FB923C" stroke-width="1.5"/>
  <text x="195" y="592" text-anchor="middle" fill="#FB923C" font-size="12" font-weight="bold">Circle Iris API (Attestations)</text>

  <rect x="365" y="565" width="270" height="45" rx="6" fill="#1E293B" stroke="#FB923C" stroke-width="1.5"/>
  <text x="500" y="592" text-anchor="middle" fill="#FB923C" font-size="12" font-weight="bold">Privy Embedded Wallet Auth</text>

  <rect x="670" y="565" width="270" height="45" rx="6" fill="#1E293B" stroke="#FB923C" stroke-width="1.5"/>
  <text x="805" y="592" text-anchor="middle" fill="#FB923C" font-size="12" font-weight="bold">Reown AppKit / Solana / Sui</text>
</svg>
```

---

## 🔄 Diagram 2: Smart Contract Interaction Flow

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 550" width="100%" height="100%">
  <rect width="1000" height="550" fill="#0F172A" rx="12"/>
  
  <text x="500" y="40" text-anchor="middle" fill="#F8FAFC" font-family="Inter, sans-serif" font-size="20" font-weight="bold">Yucarn Smart Contract &amp; Protocol Interaction Flow</text>

  <!-- Node 1: User Wallet -->
  <rect x="50" y="100" width="220" height="80" rx="8" fill="#1E3A8A" stroke="#60A5FA" stroke-width="2"/>
  <text x="160" y="135" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold">Source User Wallet</text>
  <text x="160" y="155" text-anchor="middle" fill="#93C5FD" font-size="11">EVM / Solana / Sui</text>

  <!-- Node 2: TokenMessenger (Source) -->
  <rect x="390" y="100" width="220" height="80" rx="8" fill="#581C87" stroke="#C084FC" stroke-width="2"/>
  <text x="500" y="135" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold">TokenMessenger V1/V2</text>
  <text x="500" y="155" text-anchor="middle" fill="#E9D5FF" font-size="11">depositForBurn()</text>

  <!-- Node 3: Circle Iris Attestation -->
  <rect x="730" y="100" width="220" height="80" rx="8" fill="#9A3412" stroke="#FB923C" stroke-width="2"/>
  <text x="840" y="135" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold">Circle Iris Service</text>
  <text x="840" y="155" text-anchor="middle" fill="#FDBA74" font-size="11">Signed Attestation Output</text>

  <!-- Node 4: Backend Relayer Service -->
  <rect x="730" y="320" width="220" height="80" rx="8" fill="#065F46" stroke="#34D399" stroke-width="2"/>
  <text x="840" y="355" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold">Yucarn Relayer</text>
  <text x="840" y="375" text-anchor="middle" fill="#A7F3D0" font-size="11">Sponsors Destination Gas</text>

  <!-- Node 5: MessageTransmitter (Destination) -->
  <rect x="390" y="320" width="220" height="80" rx="8" fill="#581C87" stroke="#C084FC" stroke-width="2"/>
  <text x="500" y="355" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold">MessageTransmitter</text>
  <text x="500" y="375" text-anchor="middle" fill="#E9D5FF" font-size="11">receiveMessage()</text>

  <!-- Node 6: Arc Forwarder Contract -->
  <rect x="50" y="320" width="220" height="80" rx="8" fill="#1E3A8A" stroke="#60A5FA" stroke-width="2"/>
  <text x="160" y="355" text-anchor="middle" fill="#FFFFFF" font-size="14" font-weight="bold">Arc Forwarder Contract</text>
  <text x="160" y="375" text-anchor="middle" fill="#93C5FD" font-size="11">+0.024 USDC Gross-Up Net Settlement</text>

  <!-- Arrows -->
  <path d="M 270 140 L 390 140" stroke="#60A5FA" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="330" y="130" text-anchor="middle" fill="#93C5FD" font-size="10">1. Burn USDC</text>

  <path d="M 610 140 L 730 140" stroke="#C084FC" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="670" y="130" text-anchor="middle" fill="#E9D5FF" font-size="10">2. Emit Event</text>

  <path d="M 840 180 L 840 320" stroke="#FB923C" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="850" y="250" text-anchor="start" fill="#FDBA74" font-size="10">3. Fetch Signature</text>

  <path d="M 730 360 L 610 360" stroke="#34D399" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="670" y="350" text-anchor="middle" fill="#A7F3D0" font-size="10">4. Submit Mint</text>

  <path d="M 390 360 L 270 360" stroke="#C084FC" stroke-width="2" marker-end="url(#arrow)"/>
  <text x="330" y="350" text-anchor="middle" fill="#E9D5FF" font-size="10">5. Mint USDC</text>
</svg>
```

---

## 🗺️ Diagram 3: User Journey Flow

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" width="100%" height="100%">
  <rect width="1000" height="500" fill="#0F172A" rx="12"/>
  <text x="500" y="40" text-anchor="middle" fill="#F8FAFC" font-family="Inter, sans-serif" font-size="20" font-weight="bold">Yucarn Cross-Chain Payment Journey</text>

  <circle cx="120" cy="150" r="45" fill="#1E3A8A" stroke="#60A5FA" stroke-width="2"/>
  <text x="120" y="155" text-anchor="middle" fill="#FFFFFF" font-size="16" font-weight="bold">1</text>
  <text x="120" y="220" text-anchor="middle" fill="#93C5FD" font-size="12" font-weight="bold">Scan / Open Link</text>
  <text x="120" y="240" text-anchor="middle" fill="#64748B" font-size="10">Merchant Invoice</text>

  <circle cx="310" cy="150" r="45" fill="#581C87" stroke="#C084FC" stroke-width="2"/>
  <text x="310" y="155" text-anchor="middle" fill="#FFFFFF" font-size="16" font-weight="bold">2</text>
  <text x="310" y="220" text-anchor="middle" fill="#E9D5FF" font-size="12" font-weight="bold">Connect &amp; Select</text>
  <text x="310" y="240" text-anchor="middle" fill="#64748B" font-size="10">Source Chain (52+)</text>

  <circle cx="500" cy="150" r="45" fill="#065F46" stroke="#34D399" stroke-width="2"/>
  <text x="500" y="155" text-anchor="middle" fill="#FFFFFF" font-size="16" font-weight="bold">3</text>
  <text x="500" y="220" text-anchor="middle" fill="#A7F3D0" font-size="12" font-weight="bold">Sign 1-Click Burn</text>
  <text x="500" y="240" text-anchor="middle" fill="#64748B" font-size="10">Circle CCTP TokenMessenger</text>

  <circle cx="690" cy="150" r="45" fill="#9A3412" stroke="#FB923C" stroke-width="2"/>
  <text x="690" y="155" text-anchor="middle" fill="#FFFFFF" font-size="16" font-weight="bold">4</text>
  <text x="690" y="220" text-anchor="middle" fill="#FDBA74" font-size="12" font-weight="bold">Gasless Relayer Mint</text>
  <text x="690" y="240" text-anchor="middle" fill="#64748B" font-size="10">Attestation &amp; Destination Mint</text>

  <circle cx="880" cy="150" r="45" fill="#1E3A8A" stroke="#60A5FA" stroke-width="2"/>
  <text x="880" y="155" text-anchor="middle" fill="#FFFFFF" font-size="16" font-weight="bold">5</text>
  <text x="880" y="220" text-anchor="middle" fill="#93C5FD" font-size="12" font-weight="bold">Instant Settlement</text>
  <text x="880" y="240" text-anchor="middle" fill="#64748B" font-size="10">Exact Net USDC Received</text>
</svg>
```

---

## ⚡ Diagram 4: Data Flow & Event Processing Architecture

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" width="100%" height="100%">
  <rect width="1000" height="500" fill="#0F172A" rx="12"/>
  <text x="500" y="40" text-anchor="middle" fill="#F8FAFC" font-family="Inter, sans-serif" font-size="20" font-weight="bold">Yucarn Data Processing &amp; Real-Time Socket Architecture</text>

  <rect x="60" y="120" width="220" height="100" rx="8" fill="#1E293B" stroke="#60A5FA" stroke-width="2"/>
  <text x="170" y="155" text-anchor="middle" fill="#60A5FA" font-size="14" font-weight="bold">User Action</text>
  <text x="170" y="180" text-anchor="middle" fill="#94A3B8" font-size="11">Initiates Cross-Chain Transfer</text>

  <rect x="390" y="120" width="220" height="100" rx="8" fill="#1E293B" stroke="#34D399" stroke-width="2"/>
  <text x="500" y="155" text-anchor="middle" fill="#34D399" font-size="14" font-weight="bold">NestJS Event Gateway</text>
  <text x="500" y="180" text-anchor="middle" fill="#94A3B8" font-size="11">WebSockets &amp; Transfer Matcher</text>

  <rect x="720" y="120" width="220" height="100" rx="8" fill="#1E293B" stroke="#C084FC" stroke-width="2"/>
  <text x="830" y="155" text-anchor="middle" fill="#C084FC" font-size="14" font-weight="bold">Prisma PostgreSQL</text>
  <text x="830" y="180" text-anchor="middle" fill="#94A3B8" font-size="11">Stores Tx Logs, Invoices &amp; Identity</text>

  <rect x="390" y="320" width="220" height="100" rx="8" fill="#1E293B" stroke="#FB923C" stroke-width="2"/>
  <text x="500" y="355" text-anchor="middle" fill="#FB923C" font-size="14" font-weight="bold">Arc RPC Watcher</text>
  <text x="500" y="380" text-anchor="middle" fill="#94A3B8" font-size="11">Polls Logs &amp; Reconciles Balances</text>
</svg>
```
