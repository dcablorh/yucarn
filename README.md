# Yucarn — Monorepo & Universal Cross-Chain Payment Infrastructure

> **Yucarn** is a full-stack, multi-chain payment portal and merchant platform designed for frictionless cross-chain USDC settlement across 52+ EVM, Solana, and Sui blockchains.

---

## 🌟 Overview: What Yucarn Does & How It Helps

Yucarn eliminates the friction of Web3 cross-chain transactions by providing a unified, gasless 1-click payment layer:

1. **Universal Chain Coverage**: Instant native USDC settlement across 52+ EVM chains (Base, Ethereum, Arbitrum, Optimism, Polygon, Avalanche, Unichain, Linea, Sonic, Ink, World Chain, Plume, Morph, Pharos, Monad, etc.), Solana, and Sui.
2. **Gasless Destination Settlement**: sers do not need native gas tokens on the destination chain or manual RPC network switching. Yucarn's background relayer service automatically sponsors and submits the destination mint transaction.
3. **Circle CCTP V1 & V2 Engine**: Natively burns USDC on the source chain and mints canonical USDC on the target destination chain.
4. **Arc Forwarding & Mint Gross-Up Calibration**: Integrates Arc forwarder contracts with a calibrated `0.024 USDC` mint adjustment, ensuring recipients always receive the exact net requested amount down to the cent.
5. **Reown AppKit Multi-Chain Hub**: Seamless onboarding via Email/Social logins, Passkeys, EVM wallets (MetaMask, Coinbase Wallet, Rainbow), Phantom (Solana), Sui Wallet, and 300+ WalletConnect options.
6. **Base Treasury & Fee Architecture**: Flat $0.20 protocol fee total ($0.02 Circle protocol allocation, $0.18 Yucarn treasury fee on Base).

---

## 📐 Architecture & Monorepo Structure

| Directory | Application / Role | Tech Stack | Dev Port | Prod Container Port |
| :--- | :--- | :--- | :--- | :--- |
| **`client/`** | Yucarn Client SPA Payment Portal | React 18, Vite 6, TypeScript, TailwindCSS, Viem/Wagmi, Reown AppKit, Circle Bridge Kit | `5173` | `80` (Nginx) / Netlify |
| **`server/`** | Backend API & Relayer Service | NestJS, Prisma ORM, PostgreSQL, Ethers.js | `3001` | `3001` |
| **`business/`** | Merchant Dashboard | Next.js 14, TailwindCSS, Privy Auth | `3000` | `3000` |
| **`landingpage/`** | Yucarn Marketing Landing Page | TanStack Start (SSR), React 19, Vite 8, TailwindCSS 4, Bun | `3000` | `3000` (Bun) |

---

## 🛠️ Technologies Used

- **Client App**: React 18, Vite 6, TypeScript 5, TailwindCSS 3, Viem 2, Wagmi 2, `@reown/appkit`, `@circle-fin/bridge-kit`, `@mysten/sui`, `@solana/web3.js`, Lucide Icons, Canvas Confetti.
- **Server API**: NestJS, Prisma 5, PostgreSQL 16, Ethers v6, RxJS, Passport, Class Validator.
- **Business Dashboard**: Next.js 14, React 18, TailwindCSS, Privy SDK, Lucide Icons.
- **Infrastructure & Containerization**: Docker, Docker Compose, Nginx, Netlify.

---

## 🚀 Environment Setup & Installation

### 1. Environment Configuration
Copy the example configuration file from the repository root:

```bash
cp .env.example .env
```

Ensure the core variables are configured:
- `POSTGRES_USER`, `POSTGRES_PASSWORD` (required), `POSTGRES_DB`: the only database settings for Docker. There is no `DATABASE_URL`: the server builds it from these, and the `postgres` service re-applies them to its volume on every boot, so rotating the password is just changing it and redeploying.
- `VITE_CLIENT_URL` & `VITE_BUSINESS_URL`: public URLs the landing page links to (build-time)
- `ENCRYPTION_MASTER_KEY`: 32-byte base64 key (`openssl rand -base64 32`)
- `PRIVY_APP_ID` & `PRIVY_APP_SECRET`: Privy merchant authentication credentials
- `VITE_PROJECT_ID` / `VITE_REOWN_PROJECT_ID`: Reown AppKit Project ID ([cloud.reown.com](https://cloud.reown.com))

---

### 2. Running with Docker Compose

```bash
# Start production container stack
docker compose up -d --build

# Or start hot-reloading development stack
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Access services at:
- **Client SPA**: `http://localhost:5173` (dev) / `http://localhost:8080` (prod container)
- **Business Dashboard**: `http://localhost:3000`
- **Server API**: `http://localhost:3001`
- **Landing Page**: `http://localhost:3002` (prod container)

---

### 3. Running Locally Without Docker

Ensure Node.js 24 and a local PostgreSQL instance are available:

```bash
# Server API
cd server && npm install && npx prisma migrate deploy && npm run start:dev

# Business Dashboard
cd business && npm install && npm run dev

# Client Payment Portal
cd client && npm install && npm run dev
```
