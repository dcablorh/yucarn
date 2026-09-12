# Yucarn Architecture & System Specification

This document provides visual architecture diagrams and deep technical specifications for **Yucarn** — Universal Cross-Chain Payment & Settlement Infrastructure.

---

## 📐 1. System Architecture Overview

![Yucarn System Architecture Diagram](images/system_architecture.svg)

```mermaid
graph TD
    subgraph FRONTEND ["1. Presentation Layer"]
        LP["Landing Page SPA<br/>(yucarn.walbucket.com)"]
        CP["Client Payment Portal<br/>(app.yucarn.walbucket.com)"]
        MP["Business Merchant Portal<br/>(business.yucarn.walbucket.com)"]
    end

    subgraph BACKEND ["2. NestJS Backend & Relayer Service"]
        API["NestJS Core API"]
        RELAYER["Circle CCTP Relayer"]
        WATCHER["Arc RPC Event Watcher"]
        ENS_MGR["ENSv2 Subname Registrar"]
        DB[(Prisma PostgreSQL 16)]
    end

    subgraph BLOCKCHAIN ["3. Settlement & Protocol Layer"]
        CCTP["Circle CCTP V1/V2 Engine<br/>(52+ EVM Chains)"]
        ARC["Arc Forwarder Smart Contract<br/>(0.024 USDC Gross-Up Calibration)"]
        ENS_ETH["ENSv2 Sepolia Protocol<br/>([merchant].yucarn.eth)"]
    end

    subgraph EXTERNAL ["4. External Infrastructure"]
        IRIS["Circle Iris API Attestation"]
        PRIVY["Privy B2B Embedded Wallet"]
        REOWN["Reown AppKit Hub"]
    end

    CP -->|1-Click Burn| CCTP
    MP -->|Privy JWT Auth| API
    RELAYER -->|Fetch Signed Attestation| IRIS
    RELAYER -->|Gasless Destination Mint| CCTP
    WATCHER -->|Poll RPC Logs| ARC
    ENS_MGR -->|Register Subnames| ENS_ETH
    API -->|Persist Invoices & Logs| DB
```

---

## 🔄 2. Smart Contract & Protocol Interaction Flow

![Smart Contract Interaction Diagram](images/smart_contracts.svg)

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer Wallet (Source Chain)
    participant Messenger as TokenMessenger (Source)
    participant Iris as Circle Iris Attestation API
    participant Relayer as Yucarn Backend Relayer
    participant Transmitter as MessageTransmitter (Destination)
    participant Forwarder as Arc Forwarder Contract
    actor Merchant as Merchant Treasury (Destination)

    Customer->>Messenger: depositForBurn(amount, destinationDomain, mintRecipient)
    Messenger-->>Iris: Emit DepositForBurn Event
    Relayer->>Iris: Poll for Signed Attestation (txHash)
    Iris-->>Relayer: Return Signed Message Bytes & Signature
    Relayer->>Transmitter: receiveMessage(messageBytes, signature) [Sponsors Destination Gas]
    Transmitter->>Forwarder: Mint USDC & Apply +0.024 USDC Gross-Up Calibration
    Forwarder->>Merchant: Transfer Exact Net USDC to Merchant Treasury
```

---

## 🗺️ 3. End-to-End User Journey

![User Flow Diagram](images/user_flow.svg)

```mermaid
flowchart LR
    A[1. Scan Invoice QR / Link] --> B[2. Connect Wallet via Reown / Privy]
    B --> C[3. Select Source Chain<br/>EVM / Solana / Sui]
    C --> D[4. Execute 1-Click USDC Burn]
    D --> E[5. Background Relayer<br/>Fetches Attestation]
    E --> F[6. Gasless Mint on Destination Chain]
    F --> G[7. Instant Settlement & Net Recipient Credit]
```

---

## ⚡ 4. Data Flow & Event Processing Architecture

```mermaid
gantt
    title Yucarn Real-Time Cross-Chain Settlement Pipeline
    dateFormat  s
    axisFormat %S sec

    section Payment Initiation
    Client Burn Signature       :active, p1, 0, 3s
    Source Chain Block Confirm  :p2, after p1, 4s

    section Relayer Processing
    Circle Iris Attestation     :crit, p3, after p2, 8s
    Gasless Mint Broadcast      :p4, after p3, 3s

    section Settlement & Sync
    Destination Confirmation    :p5, after p4, 2s
    WebSocket Merchant Alert    :p6, after p5, 1s
```
