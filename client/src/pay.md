# UniPay — Software Requirements Specification

**Version:** 2.0  
**Status:** Product / Engineering Specification  
**Product:** UniPay  
**Primary Asset:** USDC  
**Protocol Fee:** $0.50 per successful payment  
**Treasury:** Base  
**Primary Cross-Chain Infrastructure:** Circle Bridge Kit / CCTP  
**Architecture:** Non-custodial, intent-driven, multichain stablecoin payment application

---

# 1. Product Definition

## 1.1 What is UniPay?

**UniPay is a universal USDC payment application that allows users to send USDC to a recipient's wallet address or supported on-chain name and have the recipient receive USDC on the blockchain they explicitly choose.**

UniPay abstracts away the complexity of:

- Cross-chain transfers
- Bridge selection
- Network selection
- USDC routing
- Cross-chain messaging
- Gas estimation
- Transaction tracking
- Destination verification

The user experience should be reduced to:

> **Who → How much → Where they receive**

Example:

> Send **100 USDC** to `alice.eth` on **Base**.

The sender may hold USDC on any supported Circle CCTP network.

---

# 2. Problem Statement

Blockchain payments are fragmented across multiple networks.

A user may have:

```text
100 USDC on Ethereum

while the recipient wants:

100 USDC on Base

Without UniPay, the sender may need to understand:

Source Chain
     ↓
Bridge
     ↓
Cross-chain transfer
     ↓
Destination Chain
     ↓
Recipient

This creates unnecessary technical complexity.

UniPay abstracts the underlying infrastructure and provides a simple payment experience.

3. Product Vision
"Send stablecoins to people, not blockchains."

UniPay should feel like a modern payment application rather than a crypto bridge.

Users should not need to understand:

CCTP
Circle Bridge Kit
Attestations
Relayers
Cross-chain messaging
Bridge mechanics
Network-specific infrastructure
Blockchain settlement mechanics

These processes operate underneath UniPay.

4. Core User Flow
CONNECT WALLET
       ↓
ENTER RECIPIENT
       ↓
RESOLVE ADDRESS / NAME
       ↓
SELECT DESTINATION CHAIN
       ↓
ENTER AMOUNT
       ↓
CHECK ROUTE
       ↓
CALCULATE FEES
       ↓
SHOW PAYMENT REVIEW
       ↓
USER AUTHORIZES
       ↓
EXECUTE PAYMENT
       ↓
TRACK CROSS-CHAIN TRANSFER
       ↓
VERIFY DESTINATION
       ↓
PAYMENT COMPLETE
5. Supported Networks

UniPay's initial network support will be based on the networks supported by Circle CCTP / Circle Bridge Kit.

5.1 Initial Mainnet Networks

UniPay will initially support the following 25 networks:

EVM Networks
Arbitrum
Avalanche
Base
Codex
Cronos
Edge
Ethereum
HyperEVM
Injective
Ink
Linea
Monad
Morph
OP Mainnet
Pharos
Plasma
Plume
Polygon PoS
Sei
Sonic
Unichain
World Chain
XDC
X Layer
Non-EVM Network
Solana

These networks constitute UniPay's initial supported Circle CCTP network ecosystem.

6. Testnet Support

UniPay must support a dedicated testnet environment before mainnet deployment.

The testnet environment will use Circle's supported testnet networks and CCTP test infrastructure.

Representative testnet environments include:

Ethereum Sepolia
Base Sepolia
Arbitrum Sepolia
Polygon Amoy
Solana Devnet
Other Circle-supported testnet networks as required

The exact available routes must be checked dynamically through Circle Bridge Kit.

UniPay must not assume that every testnet network supports every possible source/destination combination.

7. Mainnet and Testnet Separation

UniPay must maintain strict separation between:

TESTNET
    │
    ├── Test wallets
    ├── Test USDC
    ├── Test treasury
    ├── Test configuration
    └── Test transactions

MAINNET
    │
    ├── Production wallets
    ├── Real USDC
    ├── Production treasury
    ├── Production configuration
    └── Production transactions

Mainnet credentials and addresses must never be used in the testnet environment.

8. Primary Asset

UniPay v1 will focus exclusively on:

USDC

The architecture should allow additional stablecoins to be added in future versions.

Assets must be identified using:

chain
token identifier
issuer
representation
decimals
symbol

The system must not identify an asset solely by:

"USDC"

because USDC exists across multiple blockchain environments.

9. Native USDC

UniPay should prioritize transfers that result in the recipient receiving native USDC.

The desired payment flow is:

Sender
   ↓
USDC
   ↓
Circle CCTP
   ↓
Destination Chain
   ↓
Native USDC
   ↓
Recipient

UniPay should avoid unnecessary wrapped or synthetic representations whenever a native USDC route is available.

10. Circle Bridge Kit

Circle Bridge Kit will be UniPay's primary cross-chain infrastructure.

UniPay will use Bridge Kit for:

Supported-chain discovery
Route availability
USDC bridging
Cost estimation
Transfer execution
Recipient-address transfers
Event monitoring
Transaction tracking
Retry handling
Forwarding/relayer functionality where supported
Fee functionality where applicable

The application must integrate Bridge Kit through a dedicated provider layer.

The rest of the UniPay application should not depend directly on Circle-specific implementation details.

11. Circle CCTP

Circle's Cross-Chain Transfer Protocol (CCTP) is the underlying mechanism for native USDC movement across supported networks.

The conceptual flow is:

Source Chain
     │
     ▼
USDC Burn
     │
     ▼
Circle CCTP
     │
     ▼
Cross-Chain Message
     │
     ▼
Destination Chain
     │
     ▼
USDC Mint
     │
     ▼
Recipient

UniPay abstracts this process from the user.

12. UniPay Payment Abstraction

UniPay sits above Circle's infrastructure.

                         UNIPAY
                            │
                     Payment Intent
                            │
                     Payment Engine
                            │
                     Circle Bridge Kit
                            │
                          CCTP
                            │
              ┌─────────────┴─────────────┐
              │                           │
        Source Network              Destination
              │                           │
              └─────────────┬─────────────┘
                            │
                        Recipient

Circle handles the underlying cross-chain infrastructure.

UniPay handles the payment experience and business logic.

13. Payment Intent

Every payment begins as a payment intent.

interface PaymentIntent {
  paymentId: string

  sender: {
    address: string
    chain: ChainId
  }

  recipient: {
    input: string
    resolvedAddress: string
    name?: string
  }

  destination: {
    chain: ChainId
    asset: AssetId
    amount: string
  }

  fee: {
    amount: string
    currency: string
  }

  status: PaymentStatus
}

The payment intent represents:

What the user wants to accomplish.

Circle Bridge Kit determines the underlying cross-chain execution.

14. Recipient Types

UniPay will support:

14.1 Wallet Addresses

Examples:

0x742...
7xKX...

The user must select the destination chain where necessary.

Example:

Recipient:
0x742...

Receive on:
Base
14.2 Human-Readable Names

UniPay should support compatible naming systems such as:

ENS
Basenames
Solana Name Service
Other supported naming systems

Example:

alice.eth

The application resolves the name and displays:

Name:
Alice

Address:
0x742...e443

Receive on:
Base

The user must confirm the destination before authorizing the payment.

15. Destination Chain Is Mandatory

The destination must consist of:

Recipient Address
+
Destination Chain
+
Destination Asset

An EVM address alone must never determine the destination chain.

Example:

0xABC...
Base
USDC

is different from:

0xABC...
Ethereum
USDC

even though the wallet address may be identical.

16. Recipient Resolution Architecture
User Input
    │
    ▼
Input Classifier
    │
    ├── Address
    │
    └── Name
          │
          ▼
     Name Resolver
          │
     ┌────┼────┐
     ▼    ▼    ▼
    ENS  SNS  Other
          │
          ▼
   Resolved Address
          │
          ▼
Destination Validation
17. Address Validation

Before generating a payment quote, UniPay must validate:

Address format
Address/network compatibility
Destination chain
Destination asset
Recipient resolution
Route availability

Invalid combinations must prevent payment execution.

18. Route Availability

UniPay must check Circle Bridge Kit for route availability before displaying an executable payment quote.

The system must evaluate:

Source Chain
Destination Chain
Source Asset
Destination Asset
Recipient
Amount
Transfer Mode

A route must not be assumed to exist simply because both networks are supported individually.

19. Route Selection

The route engine must consider:

Source-chain support
Destination-chain support
Asset support
Recipient validity
Transfer limits
Expected recipient amount
Network fees
Circle protocol fees
Estimated completion time
Transfer availability
Finality requirements

The route engine must select an executable route that satisfies the user's payment intent.

20. UniPay Protocol Fee

UniPay charges:

$0.50 per successful payment

This is a flat protocol fee.

It is not a percentage.

Example:

Recipient receives       100.00 USDC

UniPay fee                  0.50 USDC
Network fees                0.25 USDC

Total user cost           100.75 USDC

The exact network and protocol costs must be determined from the live quote.

21. Fee Architecture

The UniPay fee system consists of:

Fee Calculation
       ↓
Fee Collection
       ↓
Fee Accounting
       ↓
Fee Settlement
       ↓
Base Treasury

The $0.50 UniPay fee must be displayed separately from:

Network fees
Gas fees
Circle/provider fees
Other transaction costs
22. Fee Collection

UniPay owns the business rule:

UniPay fee = $0.50

Circle Bridge Kit may provide fee-related functionality, but UniPay must maintain its own internal fee accounting.

The application must record:

paymentId
uniPayFee
feeCurrency
sourceChain
feeCollectionStatus
treasurySettlementStatus
23. Base Treasury

Base will serve as UniPay's canonical treasury chain.

The target architecture is:

Payment
   │
   ▼
UniPay Fee
   │
   ▼
Fee Collection
   │
   ▼
Fee Settlement
   │
   ▼
Base Treasury

Treasury addresses must be configured independently for testnet and mainnet.

Private keys must never be stored in the application's normal database.

24. Payment Quote

Before signing, UniPay must show the user:

Recipient
Alice
alice.eth

Receive on
Base

Amount
100.00 USDC

────────────────────

You pay
100.75 USDC

Alice receives
100.00 USDC

UniPay fee
0.50 USDC

Network fees
0.25 USDC

Route
Ethereum → Base

Estimated time
Live estimate

All dynamic values must come from the current quote.

25. Quote Expiration

Every quote must include:

quoteId
createdAt
expiresAt

When a quote expires, UniPay must request a new quote.

Example:

Your payment quote has expired.

The user must review the updated quote before authorizing the payment.

26. Wallet Requirements

UniPay must remain non-custodial.

The application must never request or store:

Seed phrases
Private keys
Recovery phrases
Wallet passwords

Transactions must be authorized through the user's wallet.

27. Wallet Connectivity

UniPay must use a wallet abstraction layer.

The wallet layer must remain independent from:

Payment logic
Circle Bridge Kit
Fee logic
Database logic
UI components

This allows additional wallet providers to be added without modifying the payment engine.

28. Provider Architecture

The UniPay backend should expose a Circle-specific provider abstraction:

interface PaymentProvider {

  getQuotes(
    intent: PaymentIntent
  ): Promise<RouteQuote[]>

  supportsRoute(
    source: ChainId,
    destination: ChainId,
    asset: AssetId
  ): Promise<boolean>

  execute(
    quote: RouteQuote,
    authorization: WalletAuthorization
  ): Promise<Execution>

  getStatus(
    executionId: string
  ): Promise<ExecutionStatus>
}

Initial implementation:

providers/
└── circle/
    └── CircleBridgeProvider

Future providers may be added without changing the core payment domain.

29. Circle Bridge Kit Adapter

The Circle adapter is responsible for translating UniPay payment intents into Circle Bridge Kit operations.

Responsibilities include:

Check supported chains
Check supported routes
Estimate costs
Prepare transfers
Execute transfers
Monitor events
Track transfer state
Retry supported failures
Return normalized transaction information

The rest of the UniPay backend should interact with the adapter through internal interfaces.

30. Route Abstraction

The primary UI should display:

Ethereum → Base

rather than:

CCTP transfer

or:

Circle Bridge Kit

Advanced users may inspect:

Provider
Bridge mechanism
Source transaction
Destination transaction
Execution ID
Fees
Settlement status
31. Payment UI
Screen 1 — Send
Who are you sending to?

[ Search name or wallet address ]

Alice
alice.eth

✓ Resolved address

Where should they receive it?

[ Base ▼ ]

How much?

[ 100.00 USDC ]

[ Continue → ]
32. Review Screen
100.00 USDC

Alice receives on Base

Recipient       Alice
Receive on      Base
From             Ethereum
Asset            USDC

────────────────────

You pay          100.75 USDC
Alice receives   100.00 USDC
UniPay fee         0.50 USDC
Network fees        0.25 USDC

Route             Ethereum → Base
Estimated time    Live estimate

[ Send 100.75 USDC ]
33. Transaction Progress

The interface should provide a transaction timeline:

Sending...

Ethereum → Base

100.00 USDC

✓ Payment authorized

✓ Source transaction confirmed

● Cross-chain transfer

○ Destination transaction

○ Payment complete

The underlying CCTP mechanics remain abstracted.

34. Completion Screen
✓

Payment complete!

100.00 USDC

received on Base

Recipient
Alice

From
Ethereum

To
Base

Transaction
0x9b3e...e4d2

[ Done ]

[ View activity ]
35. Design Philosophy

UniPay should feel like a modern fintech payment application.

Hide
Bridges
Relayers
Attestations
CCTP mechanics
Cross-chain messages
Provider complexity
Gas mechanics
Routing algorithms
Show
Recipient
Destination
Amount
Fees
Amount received
Estimated time
Payment status
36. Advanced Mode

Advanced users may inspect:

Source chain
Destination chain
Provider
Bridge mechanism
Gas
Network fees
Protocol fees
Source transaction
Destination transaction
Execution ID
Settlement status

This information should be accessible through:

View details

37. Payment State Machine
CREATED
   ↓
RECIPIENT_RESOLVED
   ↓
DESTINATION_VALIDATED
   ↓
ROUTE_CHECKED
   ↓
QUOTE_GENERATED
   ↓
AWAITING_SIGNATURE
   ↓
AUTHORIZED
   ↓
SOURCE_CONFIRMED
   ↓
CROSS_CHAIN_EXECUTION
   ↓
DESTINATION_PENDING
   ↓
DESTINATION_VERIFIED
   ↓
COMPLETED

Failure states:

INVALID_RECIPIENT
UNSUPPORTED_ROUTE
QUOTE_EXPIRED
USER_REJECTED
INSUFFICIENT_BALANCE
SOURCE_FAILED
CROSS_CHAIN_FAILED
DESTINATION_FAILED
VERIFICATION_FAILED
38. Transaction Recovery

UniPay must distinguish between different failure states.

It should not simply display:

Transaction failed.

Instead:

Your payment is still processing.

or:

The source transaction succeeded, but the destination is still processing.

or:

The payment could not be completed. Your funds remain available.

Where Circle Bridge Kit supports retryable failures, UniPay should provide a retry mechanism.

39. Settlement Verification

UniPay must independently verify the destination payment.

Verification must include:

Destination chain
Recipient address
Destination asset
Amount
Transaction hash
Transaction status
Required confirmations/finality

The application should not rely solely on an internal provider status.

40. Chain Registry

UniPay should maintain a dynamic chain registry.

interface SupportedChain {
  id: string
  name: string
  ecosystem: 'EVM' | 'SOLANA'

  usdcSupported: boolean

  circleSupported: boolean
  circleSourceSupported: boolean
  circleDestinationSupported: boolean

  unipaySupported: boolean
}

The registry should be synchronized with Circle's supported-network information.

41. Chain Configuration

Each supported network should have configuration for:

Chain ID
Chain name
Ecosystem
Native currency
USDC contract/mint
USDC decimals
RPC endpoint
Explorer URL
Circle support status
Source support
Destination support

Configuration should be environment-specific.

42. Testnet Configuration

Testnet configuration must be completely separate from mainnet configuration.

Example:

NODE_ENV=development

CIRCLE_ENV=testnet

UNIPAY_TREASURY_ADDRESS=

DATABASE_URL=

REDIS_URL=

RPC_ETHEREUM_SEPOLIA=
RPC_BASE_SEPOLIA=
RPC_ARBITRUM_SEPOLIA=

SOLANA_DEVNET_RPC=

No production private keys or treasury addresses should be included in testnet configuration.

43. Mainnet Configuration

Production configuration must contain:

NODE_ENV=production

CIRCLE_ENV=mainnet

UNIPAY_TREASURY_ADDRESS=

DATABASE_URL=

REDIS_URL=

RPC_ENDPOINTS=

SOLANA_RPC=

Production secrets must be managed using a secure secrets-management system.

They must never be committed to Git.

44. Database

Core entities:

UserSession
Wallet
PaymentIntent
Recipient
NameResolution
Quote
Route
Execution
Fee
TreasurySettlement
Transaction
ProviderEvent
45. Payment Record
interface Payment {
  paymentId: string

  senderAddress: string
  sourceChain: string
  sourceAsset: string
  sourceAmount: string

  recipientInput: string
  recipientAddress: string
  recipientName?: string

  destinationChain: string
  destinationAsset: string
  destinationAmount: string

  uniPayFee: string
  networkFees: string

  provider: string
  routeId?: string

  sourceTxHash?: string
  destinationTxHash?: string

  status: PaymentStatus

  environment: 'testnet' | 'mainnet'

  createdAt: Date
  completedAt?: Date
}
46. API
Create Payment Quote
POST /api/payments/quote

Request:

{
  "sourceChain": "ethereum",
  "sourceAsset": "USDC",
  "recipient": "alice.eth",
  "destinationChain": "base",
  "destinationAsset": "USDC",
  "amount": "100"
}

Response:

{
  "quoteId": "q_123",
  "paymentId": "p_123",

  "recipient": {
    "name": "alice.eth",
    "address": "0x..."
  },

  "source": {
    "chain": "ethereum",
    "asset": "USDC"
  },

  "destination": {
    "chain": "base",
    "asset": "USDC",
    "amount": "100"
  },

  "fees": {
    "uniPay": "0.50",
    "network": "0.25"
  },

  "total": "100.75",

  "provider": "circle",

  "expiresAt": "..."
}
47. Technology Stack
Frontend
React
TypeScript
Vite / Next.js
Tailwind CSS
Motion / animation system
Backend
Node.js
TypeScript
PostgreSQL
Redis
Blockchain
viem
Solana Web3
Cross-Chain
@circle-fin/bridge-kit
Circle CCTP
48. Repository Structure
unipay/

├── apps/
│   └── web/

├── services/
│   └── api/

├── packages/
│   ├── domain/
│   ├── payments/
│   ├── routing/
│   ├── assets/
│   ├── chains/
│   ├── names/
│   ├── wallets/
│   ├── fees/
│   ├── settlement/
│   └── providers/
│
├── providers/
│   └── circle/
│       └── CircleBridgeProvider
│
├── contracts/
│   └── evm/
│       ├── UniPayFeeCollector.sol
│       └── UniPayTreasury.sol
│
└── docs/
49. Security Requirements

UniPay must:

Remain non-custodial
Never store private keys
Never store seed phrases
Validate wallet addresses
Validate destination chains
Validate assets
Validate token contracts/mints
Validate routes
Simulate transactions where possible
Protect against replay attacks
Enforce quote expiration
Implement idempotency
Secure treasury operations
Monitor Circle infrastructure
Monitor payment failures
Log security-relevant events
Audit UniPay smart contracts before mainnet deployment
50. Smart Contract Security Principles

UniPay should keep its smart-contract layer minimal.

Contracts should minimize:

Privileged functions
Upgradeability
Custody
External calls
Unnecessary state
Contract complexity

UniPay must not attempt to recreate:

Circle CCTP
Cross-chain messaging infrastructure
Bridge infrastructure
USDC minting/burning infrastructure

The core principle is:

Build only the protocol functionality that UniPay actually owns.

51. Example Payment Scenarios
51.1 Ethereum → Base
Sender:
Ethereum wallet

Recipient:
alice.eth

Destination:
Base

Asset:
USDC

Flow:

Resolve Alice
      ↓
Validate Base
      ↓
Check Circle route
      ↓
Generate quote
      ↓
User authorizes
      ↓
Circle Bridge Kit
      ↓
CCTP
      ↓
Base
      ↓
Verify recipient
51.2 Solana → Base
Sender:
Solana wallet

Recipient:
Base address

Destination:
Base

Asset:
USDC

Flow:

Solana
   ↓
Circle Bridge Kit
   ↓
CCTP
   ↓
Base
   ↓
Recipient
51.3 Base → Solana
Base
   ↓
Circle Bridge Kit
   ↓
CCTP
   ↓
Solana
   ↓
Recipient
51.4 Arbitrum → Ethereum
Arbitrum
   ↓
Circle Bridge Kit
   ↓
CCTP
   ↓
Ethereum
   ↓
Recipient
52. Activity History

Users should be able to view previous payments.

Each payment should show:

Recipient
Amount
Source chain
Destination chain
Asset
Status
Date
Transaction

Example:

Alice
100 USDC

Ethereum → Base

Completed
Today
53. Performance Requirements

UniPay should:

Generate quotes quickly
Resolve recipients quickly
Display live transaction status
Minimize unnecessary polling
Use provider events where available
Cache chain metadata
Cache supported-chain information
Refresh quotes before execution
Maintain reliable transaction tracking
54. Observability

UniPay must monitor:

Quote generation
Recipient resolution
Route availability
Payment authorization
Source transactions
CCTP execution
Destination settlement
Fee collection
Treasury settlement
Provider failures

Important metrics include:

Payment success rate
Payment failure rate
Average completion time
Quote generation latency
Route availability
Provider failure rate
Destination verification failures
Fee collection success rate
Treasury settlement success rate
55. MVP Acceptance Criteria

The UniPay MVP is successful when a user can:

1. Connect a supported wallet.
2. Enter a wallet address or supported name.

Example:

alice.eth
3. Select the destination chain.
Base
4. Enter an amount.
100 USDC
5. Receive a live quote.
Recipient receives: 100.00 USDC
UniPay fee: 0.50 USDC
Network fees: live value
6. Review the route.
Ethereum → Base
7. Authorize the transaction.
8. Track the cross-chain transfer.
9. Verify destination settlement.
10. Display successful completion.
Payment complete.

100 USDC received on Base.
56. Testnet Acceptance Criteria

Before mainnet deployment, UniPay must successfully demonstrate:

Wallet connection
Recipient resolution
Destination selection
USDC balance detection
Route availability checks
Quote generation
$0.50 fee calculation
Transaction authorization
Circle Bridge Kit execution
CCTP transfer
Destination verification
Payment history
Failure handling
Retry handling where supported
Testnet treasury accounting
57. Mainnet Launch Requirements

Before enabling production payments:

Smart contracts must be audited
Treasury addresses must be verified
Production Circle configuration must be tested
Mainnet USDC addresses must be verified
Route availability must be confirmed
Transaction monitoring must be operational
Error handling must be tested
Fee accounting must be verified
Security monitoring must be enabled
Testnet acceptance criteria must be completed
58. Product Success Metrics

The primary metric should be:

Successful USDC payments completed without the user manually interacting with a bridge.

Supporting metrics:

Payment completion rate
Average payment completion time
Quote-to-payment conversion
Failed-payment rate
Route availability
Name-resolution success
Repeat payments
Merchant adoption
Cost per successful payment
Fee collection success rate
59. UX North Star

The ideal user experience is:

"I want to send Alice $100 USDC."

Not:

"I need to bridge USDC from Ethereum to Base."

The blockchain infrastructure should become an implementation detail.

60. Final Architecture
                         ┌─────────────────────┐
                         │       UNIPAY        │
                         │                     │
                         │   Payment UX        │
                         │   Payment Intent     │
                         │   Fee Engine         │
                         │   Activity           │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │    PAYMENT ENGINE   │
                         │                     │
                         │ Recipient Resolution│
                         │ Chain Validation    │
                         │ Route Checking      │
                         │ Quote Generation    │
                         │ Payment Tracking    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ CIRCLE BRIDGE KIT   │
                         │                     │
                         │ Bridge              │
                         │ Estimate            │
                         │ Supported Chains    │
                         │ Events              │
                         │ Retry               │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │        CCTP         │
                         │                     │
                         │ Native USDC         │
                         │ Cross-Chain         │
                         │ Transfer            │
                         └──────────┬──────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  │                                   │
                  ▼                                   ▼
             SOURCE CHAIN                       DESTINATION
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    │
                                    ▼
                           RECIPIENT WALLET
                                    │
                                    ▼
                        DESTINATION VERIFICATION
                                    │
                                    ▼
                           PAYMENT COMPLETE
                                    │
                                    ▼
                             $0.50 FEE
                                    │
                                    ▼
                            BASE TREASURY
61. Key Architectural Decision

Circle Bridge Kit/CCTP is the primary cross-chain infrastructure for UniPay MVP.

UniPay is not a bridge.

UniPay is the payment abstraction layer above Circle's infrastructure.

Circle provides:
Cross-chain USDC infrastructure
CCTP
Supported-chain infrastructure
Transfer execution
Cost estimation
Transfer tracking
Retry functionality where supported
UniPay provides:
Payment UX
Payment intent
Recipient resolution
Destination selection
Route validation
Quote presentation
$0.50 protocol fee
Payment state management
Transaction tracking
Destination verification
Activity history
Treasury accounting
62. MVP Scope Summary
ASSET
└── USDC

CROSS-CHAIN
└── Circle Bridge Kit / CCTP

MAINNET
├── Arbitrum
├── Avalanche
├── Base
├── Codex
├── Cronos
├── Edge
├── Ethereum
├── HyperEVM
├── Injective
├── Ink
├── Linea
├── Monad
├── Morph
├── OP Mainnet
├── Pharos
├── Plasma
├── Plume
├── Polygon PoS
├── Sei
├── Solana
├── Sonic
├── Unichain
├── World Chain
├── XDC
└── X Layer

TESTNET
└── Circle-supported testnet networks

TREASURY
└── Base

PROTOCOL FEE
└── $0.50 per successful payment shold be able to be charged by admin any time ,whilst circle takes thier 10 percent and we kepp 90

ARCHITECTURE
└── Non-custodial
63. Final Product Principle

UniPay turns multichain USDC transfers into simple payments.

The user chooses:

WHO
+
HOW MUCH
+
WHERE THEY RECEIVE

UniPay handles the rest.