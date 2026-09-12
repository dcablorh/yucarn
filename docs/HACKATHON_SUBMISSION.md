# Yucarn — Hackathon Technical Documentation & Submission Package

---

## 🏆 SECTION 1: PROJECT INFORMATION

- **Project Name**: Yucarn — Universal Cross-Chain Payment Infrastructure & Merchant Platform
- **GitHub Repository URL**: [https://github.com/dcablorh/yucarn](https://github.com/dcablorh/yucarn)
- **Live Deployed URLs**:
  - **Marketing Landing Page**: [https://yucarn.walbucket.com/](https://yucarn.walbucket.com/)
  - **Client SPA Payment Portal**: [https://app.yucarn.walbucket.com/](https://app.yucarn.walbucket.com/)
  - **Business Merchant Dashboard**: [https://business.yucarn.walbucket.com/](https://business.yucarn.walbucket.com/)
- **One-Sentence Description**: Yucarn is a full-stack multi-chain payment portal and merchant platform providing frictionless, gasless 1-click cross-chain USDC settlement across 52+ EVM, Solana, and Sui blockchains with native Circle CCTP V1/V2, Privy B2B auth, and ENSv2 resolution.
- **Core Problem Solved**: Eliminates Web3 multi-chain payment fragmentation, manual RPC switching, destination gas token requirements, and fee discrepancies by providing a unified gasless payment layer that delivers exact net USDC settlement.

---

### HACKATHON TRACKS SUBMITTED:
- [x] **Arc/Circle DeFi Track** ($3,500 prize — Best DeFi/Onchain Finance Application)
- [x] **Privy B2B Track** ($2,500 prize — Best B2B Financial Product)
- [x] **Privy Financial Flow Track** ($2,500 prize — Best Financial Flow)
- [x] **ENSv2 Track** ($4,500 prize pool — Best Use of ENSv2)

---

### TECHNOLOGY STACK:

#### 1. Backend & Infrastructure (`server/` & `postgres/`):
- **Framework**: NestJS (TypeScript), RxJS, Passport.js, Class Validator.
- **ORM & Database**: Prisma ORM v5 with PostgreSQL 16.
- **Web3 & RPC**: Ethers v6, Circle Iris API Client, Arc RPC Custom Client, Viem 2.
- **Main Endpoints**:
  - `POST /relayer/burn` — Accepts burn intent and dispatches gasless destination mint transaction.
  - `GET /relayer/attestation/:txHash` — Polls Circle Iris API for CCTP burn attestations.
  - `POST /auth/privy` — Verifies Privy JWT tokens and manages merchant session state.
  - `POST /ens/register-subname` — Registers ENSv2 subnames on Ethereum Sepolia testnet.
  - `GET /payroll` & `POST /payroll/disburse` — Manages batch payroll disbursements for merchants.

#### 2. Client Payment Portal (`client/`):
- **Framework**: React 18, Vite 6, TypeScript 5, TailwindCSS 3.
- **Web3 / Bridges**: `@reown/appkit`, `@circle-fin/bridge-kit`, Viem v2, Wagmi v2, `@mysten/sui`, `@solana/web3.js`.
- **Main User Flow**:
  - Customer scans merchant QR code / visits payment link (`https://app.yucarn.walbucket.com/pay/[id]`).
  - Reown AppKit enables login via email/social, passkey, or 300+ EVM/Solana/Sui wallets.
  - User chooses source chain (Base, Ethereum, Arbitrum, Solana, Sui, etc.).
  - Executes 1-click gasless burn transaction; backend relayer sponsors and mints net USDC on destination.

#### 3. Business Merchant Dashboard (`business/`):
- **Framework**: Next.js 14 (App Router), React 18, TailwindCSS.
- **Authentication**: Privy B2B Auth SDK (embedded wallets, email/social login, team administration).
- **Main User Pages**:
  - `/dashboard` — Financial overview, revenue analytics, and transaction feed.
  - `/dashboard/invoices` — Dynamic USDC invoice generator with QR links.
  - `/dashboard/payroll` — Batch payroll disbursement engine for employee wallets.
  - `/dashboard/identity` — ENSv2 merchant subname setup (`[merchant].yucarn.eth`).

#### 4. Landing Page (`landingpage/`):
- **Framework**: TanStack Start (SSR), React 19, Vite 8, Bun runtime.

---

### REPOSITORY STRUCTURE:

```
unipay/
├── client/                 # Client SPA Payment Portal (Vite + React + Reown + Circle Bridge Kit)
│   ├── src/
│   │   ├── config/cctp.ts  # Circle CCTP V1/V2 contract & domain mapping across 52+ chains
│   │   ├── providers/circle/CircleBridgeProvider.ts # Bridge provider implementation
│   │   ├── services/relayer.ts # Client API connector for background relayer
│   │   └── context/PaymentContext.tsx # Global payment state management
├── server/                 # Backend API & Gasless Relayer Service (NestJS + Prisma + Postgres)
│   ├── src/
│   │   ├── auth/           # Privy authentication guard and token verification
│   │   ├── ens/            # ENSv2 Sepolia subname registrar & resolver client
│   │   ├── relayer/        # Circle Iris attestation & destination mint relayer
│   │   └── watcher/        # Arc RPC event listener & transfer matching engine
│   └── prisma/schema.prisma # Database schema for merchants, invoices, payroll, and txs
├── business/               # Merchant Dashboard (Next.js 14 + Privy B2B SDK)
│   ├── app/                # Next.js App Router (Invoices, Payroll, Identity, Settings)
│   ├── components/         # Design system, glass panels, count-up charts, modals
│   └── lib/                # API client, Privy hooks, ENS helper, wallet batching
├── landingpage/            # Marketing Landing Page (TanStack Start SSR + React 19)
├── docs/                   # System Architecture & Hackathon Documentation
│   ├── ARCHITECTURE.md     # Visual SVG diagrams and architecture specifications
│   └── HACKATHON_SUBMISSION.md # Track submissions, code mappings & checklists
└── docker-compose.yml      # Monorepo containerization configuration
```

---

## 🏛️ DELIVERABLE 2: TECHNICAL DOCUMENTATION BY TRACK

---

### TRACK 1: ARC / CIRCLE DEFI TRACK ($3,500 Prize — Best DeFi/Onchain Finance Application)

#### Section A: Executive Summary
Yucarn leverages Circle CCTP (Cross-Chain Transfer Protocol) V1/V2 and Arc forwarder smart contracts to create a frictionless, gasless cross-chain USDC settlement network. By eliminating destination gas token requirements and standardizing mint calibration (`0.024 USDC` mint gross-up), Yucarn enables instantaneous, 1-click USDC payments across 52+ blockchains.

#### Section B: Requirement-by-Requirement Mapping
1. **Circle CCTP Native USDC Minting**:
   - 📁 **File**: [`client/src/config/cctp.ts`](https://github.com/dcablorh/yucarn/blob/main/client/src/config/cctp.ts#L1-L85)
   - 🔗 **Function**: `getCCTPDomain()`, `getMessengerContract()`
   - 📝 **Implementation**: Maps source/destination chain IDs to Circle CCTP V1/V2 domains.
2. **Circle Iris API Attestation Fetching**:
   - 📁 **File**: [`server/src/relayer/attestation.service.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/relayer/attestation.service.ts#L18-L62)
   - 🔗 **Function**: `fetchAttestationSignature()`
   - 📝 **Implementation**: Polls Circle's Iris attestation API endpoint for signed burn attestations.
3. **Gasless Destination Mint Sponsorship**:
   - 📁 **File**: [`server/src/relayer/relayer.service.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/relayer/relayer.service.ts#L34-L98)
   - 🔗 **Function**: `submitDestinationMint()`
   - 📝 **Implementation**: Executes destination `receiveMessage()` on behalf of the user, paying gas from backend relayer.
4. **Arc Forwarder Gross-Up Fee Calibration**:
   - 📁 **File**: [`server/src/watcher/arc-watcher.service.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/watcher/arc-watcher.service.ts#L22-L75)
   - 🔗 **Function**: `processGrossUpAdjustment()`
   - 📝 **Implementation**: Automatically adjusts mint output by `0.024 USDC` to cover protocol forwarding friction.

#### Section C: Core Integration Points
- **Circle Bridge Kit**: [`client/src/providers/circle/CircleBridgeProvider.ts`](https://github.com/dcablorh/yucarn/blob/main/client/src/providers/circle/CircleBridgeProvider.ts#L1-L120)
- **Arc RPC Watcher**: [`server/src/watcher/arc-rpc.client.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/watcher/arc-rpc.client.ts#L15-L60)

---

### TRACK 2: PRIVY B2B TRACK ($2,500 Prize — Best B2B Financial Product)

#### Section A: Executive Summary
The Yucarn Merchant Dashboard (`business/`) utilizes Privy B2B authentication to empower businesses with seamless onboarding, embedded wallet delegation, multi-user identity management, and automated payroll workflows without friction or seed phrase vulnerabilities.

#### Section B: Requirement-by-Requirement Mapping
1. **Privy Provider Setup & Configuration**:
   - 📁 **File**: [`business/app/providers.tsx`](https://github.com/dcablorh/yucarn/blob/main/business/app/providers.tsx#L10-L45)
   - 🔗 **Function**: `PrivyProvider` wrapper configuration.
2. **Backend JWT Verification Guard**:
   - 📁 **File**: [`server/src/auth/privy-auth.guard.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/auth/privy-auth.guard.ts#L15-L52)
   - 🔗 **Function**: `canActivate()`
   - 📝 **Implementation**: Validates Privy authorization bearer tokens on all protected NestJS endpoints.
3. **Privy Merchant Identity Registration**:
   - 📁 **File**: [`business/app/(merchant)/dashboard/identity/registration-flow.tsx`](https://github.com/dcablorh/yucarn/blob/main/business/app/(merchant)/dashboard/identity/registration-flow.tsx#L25-L95)
   - 🔗 **Function**: `RegistrationFlow()`
4. **B2B Automated Payroll Disbursement**:
   - 📁 **File**: [`business/lib/payroll.ts`](https://github.com/dcablorh/yucarn/blob/main/business/lib/payroll.ts#L12-L68)
   - 🔗 **Function**: `disbursePayrollBatch()`

---

### TRACK 3: PRIVY FINANCIAL FLOW TRACK ($2,500 Prize — Best Financial Flow)

#### Section A: Executive Summary
Yucarn abstracts away complex multi-chain liquidity flows. Using Privy embedded wallets and 1-click bridge triggers, users can accept or disburse funds seamlessly without dealing with native gas balances or manual chain switching.

#### Section B: Code Mapping
1. **1-Click Payment Intent Execution**:
   - 📁 **File**: [`client/src/context/PaymentContext.tsx`](https://github.com/dcablorh/yucarn/blob/main/client/src/context/PaymentContext.tsx#L40-L115)
   - 🔗 **Function**: `executePayment()`
2. **Batch Wallet Disbursement Engine**:
   - 📁 **File**: [`business/lib/wallet-batch.ts`](https://github.com/dcablorh/yucarn/blob/main/business/lib/wallet-batch.ts#L15-L80)
   - 🔗 **Function**: `executeBatchTransfers()`

---

### TRACK 4: ENSV2 TRACK ($4,500 Prize Pool — Best Use of ENSv2)

#### Section A: Executive Summary
Yucarn incorporates ENSv2 on Ethereum Sepolia testnet to provide merchants and employees with human-readable payment handles (`[merchant].yucarn.eth` and `[employee].[merchant].yucarn.eth`). Subnames resolve seamlessly to multi-chain EVM, Solana, and Sui addresses.

#### Section B: Requirement-by-Requirement Mapping
1. **ENSv2 Sepolia RPC Client**:
   - 📁 **File**: [`server/src/ens/sepolia-rpc.client.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/ens/sepolia-rpc.client.ts#L12-L55)
   - 🔗 **Function**: `SepoliaRpcClient`
2. **ENSv2 Subname Registrar & Resolver**:
   - 📁 **File**: [`server/src/ens/ens-calls.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/ens/ens-calls.ts#L20-L90)
   - 🔗 **Function**: `registerSubname()`, `setSubnameResolver()`
3. **Merchant Identity Resolution**:
   - 📁 **File**: [`business/lib/ens.ts`](https://github.com/dcablorh/yucarn/blob/main/business/lib/ens.ts#L10-L45)
   - 🔗 **Function**: `resolveMerchantEns()`

---

## 📋 DELIVERABLE 3: QUALIFICATION REQUIREMENT CHECKLISTS

### 1. Arc/Circle DeFi Track Checklist
| Official Requirement | Status | Code Location | Demo Evidence |
| :--- | :---: | :--- | :--- |
| **Native USDC CCTP Integration** | ✅ Complete | [`client/src/config/cctp.ts`](https://github.com/dcablorh/yucarn/blob/main/client/src/config/cctp.ts) | 52+ chain dropdown & burn trigger |
| **Circle Iris Attestation Fetcher** | ✅ Complete | [`server/src/relayer/attestation.service.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/relayer/attestation.service.ts) | Background relayer logs & status |
| **Gasless Destination Settlement** | ✅ Complete | [`server/src/relayer/relayer.service.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/relayer/relayer.service.ts) | User pays zero destination gas |
| **Arc Forwarder Gross-Up Adjustment** | ✅ Complete | [`server/src/watcher/arc-watcher.service.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/watcher/arc-watcher.service.ts) | Net $0.024 USDC calibration |

### 2. Privy B2B Track Checklist
| Official Requirement | Status | Code Location | Demo Evidence |
| :--- | :---: | :--- | :--- |
| **Privy Embedded Wallet Auth** | ✅ Complete | [`business/app/providers.tsx`](https://github.com/dcablorh/yucarn/blob/main/business/app/providers.tsx) | Social/email login on merchant portal |
| **Protected JWT Backend Guard** | ✅ Complete | [`server/src/auth/privy-auth.guard.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/auth/privy-auth.guard.ts) | 401 response on unauthenticated API calls |
| **Automated B2B Payroll** | ✅ Complete | [`business/lib/payroll.ts`](https://github.com/dcablorh/yucarn/blob/main/business/lib/payroll.ts) | 1-click batch payroll execution |

### 3. ENSv2 Track Checklist
| Official Requirement | Status | Code Location | Demo Evidence |
| :--- | :---: | :--- | :--- |
| **ENSv2 Sepolia Integration** | ✅ Complete | [`server/src/ens/sepolia-rpc.client.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/ens/sepolia-rpc.client.ts) | Testnet subname registration |
| **Subname Registrar & Resolver** | ✅ Complete | [`server/src/ens/ens-calls.ts`](https://github.com/dcablorh/yucarn/blob/main/server/src/ens/ens-calls.ts) | `[merchant].yucarn.eth` active handle |

---

## 🔍 DELIVERABLE 4: GAP ANALYSIS & ACTION PLAN REPORT

1. **Documentation Integrity**:
   - All architecture specifications, SVG diagrams, and track mappings are fully updated and synchronized across `README.md`, `docs/ARCHITECTURE.md`, and `docs/HACKATHON_SUBMISSION.md`.
2. **Code Mapping Accuracy**:
   - All repository code file paths, functions, and GitHub URLs directly point to [`https://github.com/dcablorh/yucarn`](https://github.com/dcablorh/yucarn).
3. **Deployment Status**:
   - Live endpoints active on custom domains (`https://yucarn.walbucket.com`, `https://app.yucarn.walbucket.com`, `https://business.yucarn.walbucket.com`).
