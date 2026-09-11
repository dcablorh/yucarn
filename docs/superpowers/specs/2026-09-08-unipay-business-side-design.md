# UniPay Business & Merchant Side — Design

**Date:** 2026-09-08
**Status:** Approved design, pending implementation plan
**Scope:** `business/` (Next.js dashboard) and `server/` (NestJS API). `client/` is owned by another developer and MUST NOT be modified.

---

## 1. Objective

Give a business a way to accept payments and receive USDC on Arc, regardless of what asset or chain its customer pays from.

The merchant-facing flow, from the Development PDF:

```
Create/Connect Wallet → Register business ENS identity → Create Invoice
→ Generate Link/QR → Customer Pays → Receive USDC on Arc → Invoice Shows Paid
```

Plus, from the UniPay v2 PDF: employee subname identities and business payroll.

---

## 2. Hard constraints

1. **`client/` is off-limits.** Another developer owns the consumer checkout app. No file under `client/` is modified by this work. Anything the consumer app must change is written up as a handoff (§12).
2. **No user private keys, ever.** UniPay never stores, requests, or transmits a *user's* private key, seed phrase, or recovery phrase. Signing authority over user funds is delegated to Privy, never held by us (§5). This is distinct from UniPay's own operational gas key, which may exist server-side and cannot touch user funds (§11) — the two must never be conflated.
3. **Everything sensitive is encrypted at rest.** Envelope encryption, no exceptions, no logging (§6).
4. **The database is the source of truth for payment routing.** ENS is an additive identity layer, never a hard dependency of the payment path (§7).

---

## 3. System shape

```
unipay/
├── business/    Next.js 16.3.4 + React 19.2.8 + Tailwind v4 — merchant dashboard
├── client/      Vite + React 18 — consumer checkout            [DO NOT TOUCH]
├── server/      NestJS 11 + Prisma + Postgres — API, ENS orchestration, Arc watcher
└── docs/
```

**No monorepo tooling is introduced.** `business/`, `client/`, and `server/` remain independent npm projects with their own lockfiles. Adding root workspaces would change the setup of a repo another developer is actively working in. The small amount of shared knowledge (Arc chain config, USDC addresses, ENS contract addresses) is duplicated deliberately: `business/` imports `arcTestnet` from `viem/chains`, and each project keeps a small local constants module. Mild duplication is preferred over shared tooling that reaches into `client/`.

`server/.git` (an empty nested repository from the NestJS scaffold) is removed so `server/` joins the monorepo rather than committing as a broken gitlink.

---

## 4. Network and protocol facts

Verified against live docs and source, 2026-09-08.

### Arc

| Property | Testnet | Mainnet |
|---|---|---|
| Chain ID | `5042002` | `5042` |
| RPC | `https://rpc.testnet.arc.network` | none published |
| Explorer | `https://testnet.arcscan.app` | — |
| CCTP domain | `26` | — |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` (6 dec) | — |
| viem export | `arcTestnet` | `arc` |

**Arc's native gas token is USDC.** The native view is 18 decimals and the ERC-20 view is 6 decimals — the same pool of funds exposed two ways, differing by `10^12`. Arc mainnet has no public RPC and is targeted for ~2026-09-16, so **testnet is the only viable target**.

Arc CCTP config already exists at `client/src/config/cctp.ts:476` (chain `5042002`, domain `26`) — the consumer app has the plumbing but does not expose Arc as a selectable chain (§12).

### ENSv2 on Sepolia

ENSv2 beta is live on Sepolia with a hierarchical registry model. Registration fees are paid in **freely-mintable MockUSDC**, not ETH.

| Contract | Address |
|---|---|
| ETHRegistrar | `0xa88553f454b77203b0d036a05c894d555eaaa2cc` |
| ETHRegistry | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` |
| UniversalResolverV2 | `0x4a1817d13e9cf196f471725176355c1234b63c70` |
| UpgradableUniversalResolverProxy | `0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe` |
| PublicResolverV2 | `0xe7b9a25607e02da8145e4eb1836ca539e53f11f7` |
| VerifiableFactory | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` |
| UserRegistryImpl | `0x624a25d67b59d587752ebec8dded8827dae52050` |
| MockUSDC (fee token) | `0x768f42455a2d082e23ceef7d51e5787c82d67a39` |

Registrar interface:

```
commit(bytes32 commitment)
makeCommitment(label, owner, secret, subregistry, resolver, duration, referrer)  // pure
register(label, owner, secret, subregistry, resolver, duration, paymentToken, referrer)
renew(label, duration, paymentToken, referrer)
getRegisterPrice(label, duration, paymentToken)
isAvailable(label)
```

`MIN_COMMITMENT_AGE` is **60 seconds**; `MAX_COMMITMENT_AGE` is typically 24 hours. Payment is collected by `safeTransferFrom`, so the registrar must be approved for MockUSDC before `register()`.

**Risk:** ENS documents these contracts as *"not yet final and may change prior to mainnet deployment."* All ENSv2 addresses live in configuration, never inline, so a beta redeployment is a config change (§11).

Resolver addresses are **looked up fresh per name** via `getEnsResolver` and never cached — required by ENSv2's per-account resolver model.

### Privy

`@privy-io/react-auth@3.40.0` peer-deps `react: ^18 || ^19` — compatible with the Next 16 / React 19 dashboard. `@privy-io/server-auth@1.32.5` handles server-side token verification.

---

## 5. Identity, wallets, and signing authority

### Wallet

Businesses may **connect an existing wallet or create an embedded one** — equal-weight options in one Privy login, matching the Development PDF's "connects or creates." A merchant with an existing treasury wallet is never forced into an embedded wallet.

Privy embedded wallet key shards are generated in a secure enclave and split between the user's device and Privy. **UniPay stores only a `privyUserId` and a public address.**

### Signing: server-prepared, client-signed (default)

**The server prepares transactions; the browser signs them.** The server never holds authority over user funds.

1. The server computes everything hard — route selection, fee maths, ABI encoding, approval requirements, ordering — and returns an ordered list of **unsigned call objects** (`to`, `data`, `value`, `chainId`).
2. The browser signs via Privy, using the embedded wallet or a connected external wallet.
3. The browser returns transaction hashes; the server tracks confirmation and continues the lifecycle.

The business gets the UX benefit of server-side computation with none of the custody. This is the **only** path that works for both wallet types, which is what makes it the default rather than an alternative: **Privy session signers work exclusively with embedded wallets**, so a business that connects an existing wallet (an equal-weight option above) could never use delegation.

**Batching.** Privy supports EIP-5792 `wallet_sendCalls`, using EIP-7702 to upgrade the EOA to a Kernel smart contract for atomic batched execution. Where the destination chain and wallet support it, an entire payroll run — approvals and burns for every employee — collapses into **one approval**. Where they do not (EIP-7702 support on Arc is unconfirmed and must be verified during implementation), the fallback is sequential signing, and the UI must communicate the number of approvals up front.

### Session signers (opt-in, deferred)

Delegated signing is **not part of the default path** and is not required for v1. It buys exactly one thing the pattern above cannot do: executing payroll while the business is offline, i.e. scheduled or recurring runs.

If and when that is built, it is opt-in per business, embedded-wallet only, scoped, revocable from the dashboard with immediate effect, and its delegation reference is encrypted at rest per §6.

**Trust model if enabled:** while a delegation is active, UniPay can initiate signing on that business's behalf within the delegation's scope — *delegated authority*, not the stricter "UniPay could not move funds if it tried" posture. Product copy must not describe UniPay as unqualified "non-custodial" for businesses with delegation enabled. Because the default path avoids this entirely, the unqualified claim holds for v1.

**Explicitly forbidden regardless:** storing raw private keys, seed phrases, or recovery phrases in any form, encrypted or otherwise. Encryption at rest is not a licence to hold key material.

### Authentication

NestJS verifies the Privy access token via `@privy-io/server-auth` in a `PrivyAuthGuard`. `Business` rows are keyed on `privyUserId`. Every business-scoped endpoint asserts ownership; no endpoint trusts a `businessId` supplied by the client.

---

## 6. Encryption at rest

All sensitive persisted values use **envelope encryption**:

- Per-record data key (DEK), AES-256-GCM.
- DEK wrapped by a master key from KMS in production, from env in development.
- Ciphertext, IV, and auth tag stored; plaintext never written to disk or logs.
- Encrypted fields are never returned by any API response and are excluded from serialization by default.

Applies to: ENS commit-reveal secrets, any provider credentials, and — only if the deferred session-signer path in §5 is ever built — Privy delegation references.

Note that the default signing path (§5) stores **no signing material at all**, so encryption at rest protects secrets and credentials rather than anything that could move funds.

Key rotation is supported by re-wrapping DEKs without touching ciphertext.

---

## 7. Payment routing: database first, ENS additive

The invoice record carries the recipient address, destination chain, asset, and amount **directly**. A payment link is fully self-describing.

This is deliberate. Businesses register ENS names on **Sepolia**, but the consumer app resolves **mainnet** only (§12), so a freshly registered name resolves to nothing at checkout. Making ENS load-bearing would put the entire merchant flow behind another team's change.

Consequence: **the merchant flow works end-to-end with zero changes to `client/`.** ENS becomes the human-readable layer that lights up when Sepolia resolution is wired up, not a prerequisite.

---

## 8. Business ENS identity

### Registration (Sepolia)

ENS registration is **optional and deferred** at onboarding — a business can create a wallet, issue invoices, and get paid without ever registering a name. This avoids dead-ending new users on a faucet (§10).

1. `isAvailable(label)`
2. `getRegisterPrice(label, duration, MockUSDC)`
3. Mint MockUSDC (free) and approve `ETHRegistrar`
4. Deploy the business's own subname registry via `VerifiableFactory` + `UserRegistryImpl`
5. `makeCommitment(...)` → `commit(...)` → **wait ≥ 60 s** → `register(label, owner, secret, subregistry, resolver, duration, paymentToken, referrer)`
6. Write records via resolver `multicall`

The `subregistry` parameter passed at registration is what makes employee subnames possible (§9).

The 60-second commitment window is a first-class UI state with a countdown, not a spinner. The registration is persisted server-side as a resumable record so a refresh or a closed tab does not strand a half-finished registration; the `secret` is encrypted at rest per §6.

### Records

Adopting the schema named in the v2 PDF, alongside the standard `addr` record:

| Record | Meaning |
|---|---|
| `addr` | recipient address |
| `unipay.address` | recipient address |
| `unipay.chain` | destination chain (`arc-testnet`) |
| `unipay.asset` | destination asset (`USDC`) |
| `unipay.label` | display label |

Per the v2 PDF §5, the destination chain is always explicit. **An address alone never implies a chain.**

---

## 9. Employee subnames

A registered business owns a subregistry, from which it issues `john.acme.eth`. Each subname carries its own `unipay.chain` / `unipay.asset` records, so employees can receive on different chains — the v2 PDF's core payroll premise.

`Employee` records hold name, subname, address, preferred chain, and preferred asset. Employees exist in the database independently of ENS; a subname is an optional enrichment, consistent with §7.

Note: because the business registers a real 2LD, identities are `john.acme.eth`, not the PDFs' `john.acme.unipay.eth`.

---

## 10. Invoices, links, and settlement

### Model

`Invoice { id, businessId, amount, amountNonce, destChain, asset, description, status, expiresAt }`

State machine:

```
PENDING → PROCESSING → PAID
        ↘ EXPIRED / UNDERPAID / FAILED
```

### The matching problem

If a merchant has two open invoices for 100 USDC, an incoming 100 USDC transfer on Arc matches both.

**Resolution: amount nonce.** The server allocates a unique sub-cent tail per open invoice, exploiting USDC's 6 decimals.

The nonce is **added, never subtracted**: a merchant asking for `100` USDC issues an invoice payable at `100.004417`, so the merchant is always paid at least the amount requested. The nonce occupies the four decimal places below the cent — `1`–`9999` base units, i.e. `0.000001`–`0.009999` USDC — bounding the customer's excess at under one cent.

Uniqueness is scoped to *open invoices for a single merchant*, not globally, so the space is ample; allocation collides only if one merchant holds 9,999 simultaneously open invoices, which raises `NONCE_SPACE_EXHAUSTED` rather than issuing an ambiguous invoice. Nonces are released when an invoice reaches `PAID` or `EXPIRED`.

Amounts are stored and compared as integer base units (`bigint`, 6-decimal micro-USDC), never as floats.

Matching is therefore unambiguous, and funds move customer → merchant directly.

The rejected alternative — a unique deposit address per invoice — would require UniPay to hold a key and sweep funds. That is custody, and it is out of the question under §2.2.

### Marking paid

A NestJS scheduled job polls Arc via `eth_getLogs` for USDC `Transfer(→ merchant)` events, cursored by block height. Amount and recipient are matched against open invoices.

**Only the watcher may set `PAID`.** This satisfies `pay.md` §39's requirement that UniPay independently verify destination settlement rather than trusting a client report.

`POST /invoices/:id/payments` is built and documented as a ready contract for the consumer app: it moves `PENDING → PROCESSING` only. Nothing depends on it being called.

**Known consequence:** until the consumer app calls that endpoint, invoices go `PENDING → PAID` with no visible `PROCESSING`. A cross-chain payment takes minutes, so the merchant sees no activity and then a jump to Paid. Accepted; `PROCESSING` remains in the state machine, unpopulated.

Watcher correctness requirements: idempotent on replay, resumable from its cursor after downtime, tolerant of RPC gaps, and it must never double-credit an invoice.

### Links and QR

Every invoice is shareable as a link and a QR code, for physical checkout, invoices, websites, messages, and social — per the Development PDF §4.

---

## 11. Payroll

`PayrollBatch` holds items, funding source, and status; each item produces one payment intent.

**Execution.** The consumer app's CCTP engine lives in `client/src/context/PaymentContext.tsx` — another app's React context, neither importable nor editable. Payroll route computation is therefore **reimplemented server-side** in NestJS.

The split follows §5: the server computes routes, fees, and encoded calls and returns them **unsigned**; the business signs in the browser, ideally as a single EIP-5792 batch. The server holds no authority over the business's funds at any point in a payroll run.

Order of preference for the destination mint:

1. **Circle Bridge Kit forwarding**, if it covers our routes. `pay.md` §10 already names Bridge Kit for "forwarding/relayer functionality where supported." If it forwards, **no relayer key is needed at all.**
2. Otherwise, a UniPay-held **operational gas key**, server-side only.

If (2) is required, its nature must be understood precisely: CCTP's `receiveMessage` is permissionless and the mint recipient is fixed at burn time, so this key can only pay gas to finish a transfer already authorized by the sender. **It cannot redirect or take custody of funds.** It is categorically different from a user key — but it is a hot key, and it lives in the server's secret manager, never in the database and never in a frontend bundle.

**Scope: EVM CCTP destinations only for v1** (Arc, Base, Ethereum, Arbitrum, OP, Polygon, and the other CCTP EVM chains). The v2 PDF's payroll example includes Solana and Sui; those are substantially different CCTP integrations and are deferred rather than half-built.

---

## 12. Handoff to the consumer app owner

Neither item blocks building the business side. Both block the full end-to-end demo.

1. **A customer cannot select Arc as a destination.** Arc is absent from `SUPPORTED_CHAINS`, `USDC_ADDRESSES`, and the AppKit networks list in `client/`, though its CCTP config exists at `client/src/config/cctp.ts:476`.
2. **Sepolia ENS names will not resolve.** `client/src/utils/ensResolver.ts` hardcodes mainnet `enstate.rs`. A `sepolia.enstate.rs` endpoint exists and returns 200.
3. `POST /invoices/:id/payments` is available whenever the consumer app wants to drive the `PROCESSING` state.
4. **Two CCTP implementations will now exist** (consumer app and server). Flagged as a drift risk requiring coordination.

---

## 13. Findings in existing code

Recorded, not fixed by this work.

1. **Treasury chain contradiction.** `pay.md` §23 states Base is the canonical treasury chain; both PDFs state Arc. **Resolved for the business side as Arc**, single address from environment configuration.
2. **Two conflicting treasury addresses.** `client/src/config/treasury.ts:8` has `0x127c1A16…`; `client/src/config/cctp.ts:669` has `0x91F5c312…`. The business side reads one address from env and hardcodes neither.
3. **Relayer key exposed in the frontend bundle.** `client/src/services/relayer.ts:71` reads `VITE_RELAYER_PRIVATE_KEY`. Vite inlines `VITE_*` variables into the shipped bundle, making that key readable by anyone who opens devtools. Out of scope (it is `client/` code), but it should reach whoever owns that app. The business side avoids the pattern entirely by keeping its operational key server-side.
4. **Undocumented record schema.** The v2 PDF cites `unipay.address` / `.chain` / `.asset` / `.label` as *"defined in the existing SRS."* They appear in neither `pay.md` nor the code. This design defines them (§8).
5. **Two ENS naming models across the PDFs.** The Development PDF uses `microsoft.eth` (real 2LD); the v2 PDF uses `acme.unipay.eth` (subname). Resolved as real 2LD registration per §8.
6. **Documented features that do not exist.** The PDFs describe Uniswap swaps and paying with SOL; the codebase is USDC→USDC over CCTP only. Not required by the merchant MVP.

---

## 14. Testing

Test-driven per the repository's standard workflow. Unit-testable in isolation, without network:

- Invoice state machine — every legal and illegal transition
- Amount-nonce allocation — uniqueness across concurrent open invoices, exhaustion behaviour
- Watcher matching — correct match, no double-credit, replay idempotency, cursor resume, underpayment
- Encryption envelope — round-trip, tamper detection, rotation
- ENS record encoding and commitment computation
- Privy auth guard — ownership assertions, rejected tokens
- Transaction preparation — encoded calls, ordering, approval inclusion, and the assertion that **no prepared-transaction endpoint ever returns or requires signing material**

Integration tests run against Sepolia and Arc testnet behind an explicit flag, never in the default suite.

---

## 15. Build order

Sequenced so the demo-critical path lands first and each phase is independently demonstrable.

| # | Phase | Depends on |
|---|---|---|
| 1 | NestJS foundation: Prisma schema, Postgres, encryption service, Privy auth guard | — |
| 2 | Privy wallet (connect or create) + dashboard shell | 1 |
| 3 | Invoice CRUD, amount nonce, links + QR | 1, 2 |
| 4 | Arc watcher → `PAID` | 3 |
| 5 | ENSv2 registration + `unipay.*` records | 2 |
| 6 | Subnames → employees | 5 |
| 7 | Payroll: server-prepared routes + client-signed batch execution (EVM) | 6 |

Phases 1–4 constitute a complete merchant story with no external dependencies.

All work happens on the `feat/business-side` branch for a pull request.

---

## 16. Open items

None blocking. Deferred by decision: Solana/Sui payroll destinations (§11), session signers for unattended/scheduled payroll (§5), Uniswap swap routing (§13.6), Arc mainnet (no public RPC until ~2026-09-16, §4).

**To verify during implementation:** whether Arc testnet supports EIP-7702, which determines if payroll is one approval or N (§5). The design works either way; only the UX changes.
