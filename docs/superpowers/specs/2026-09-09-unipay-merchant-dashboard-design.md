# UniPay Merchant Dashboard — Design

**Date:** 2026-09-09
**Status:** Approved design, pending implementation plans
**Scope:** `business/` (Next.js dashboard) and `server/` (NestJS API)
**Builds on:** `docs/superpowers/specs/2026-09-08-unipay-business-side-design.md` (referred to below as *the base spec*)

---

## 0. Why this document exists

The base spec designed the merchant backend thoroughly and said almost nothing about the dashboard UI. Plan 1 (`docs/superpowers/plans/2026-09-08-merchant-core.md`) shipped the merchant core — Privy login, invoices, amount nonce, links, QR, the Arc settlement watcher, and expiry — as 25 commits on `feat/business-side`.

What exists today is therefore a working payment backend behind three unstyled screens. This document designs the remaining four sub-projects that turn it into the dashboard the Development PDF describes:

| | Sub-project | Base spec coverage |
|---|---|---|
| **A** | Dashboard shell — nav, overview, invoice detail, settings, visual identity | none — designed here (§2) |
| **B** | ENS identity — ENSv2 Sepolia registration, `unipay.*` records | §8 — extended here (§3) |
| **C** | Team — subregistry subnames, employee records | §9 — extended here (§4) |
| **D** | Payroll — server-prepared CCTP routes, client-signed execution | §11 — extended here (§5) |

Everything in the base spec's §2 hard constraints still binds: `client/` is off-limits, no user private keys ever, sensitive values envelope-encrypted at rest, and the database — never ENS — is the source of truth for payment routing.

### Source-document gap

The base spec cites a *"UniPay v2 PDF"* as the origin of payroll, employee subnames, and the `unipay.address` / `.chain` / `.asset` / `.label` record schema. **That document is not in this repository and has not been produced.** The only PDF present (`Development .pdf`) is the Business & Merchant Side / Consumer Development document, which mentions payroll and employees zero times; `client/src/pay.md` (1,582 lines) likewise contains no occurrence of "payroll", "employee", "subname", or "salary".

Sections §4 and §5 below therefore rest on the base spec's §9 and §11 summaries rather than on a primary source. Places where that summary is too thin to act on are marked **[UNSOURCED]** and are either resolved by explicit decision here or routed to the day-0 spike (§1.1).

---

## 1. Sequencing and risk

**Budget: five working days. All four sub-projects required. Payroll at full CCTP EVM fidelity.**

This is an aggressive combination: payroll is the largest item and sits last behind two dependencies. The sequencing below is built so that slippage is absorbed *inside* payroll's chain coverage rather than costing a whole sub-project.

| When | Work | Demonstrable output |
|---|---|---|
| Day 0 (½) | **Spike** — three flagged unknowns | Facts; no kept code |
| Day 1 | **A. Shell** | A dashboard that reads as a product |
| Day 2–2.5 | **B. ENS identity** | `unipaydemo.eth` registered, records set |
| Day 3 | **C. Team** | `john.unipaydemo.eth` issued |
| Day 3.5–5 | **D. Payroll** | A batch runs end to end |

### 1.1 Day 0 spike

> **Run 2026-09-09. Findings: `docs/superpowers/specs/2026-09-09-day-0-spike-findings.md`.**
> Questions 1 and 2 answered favourably; question 3 did not. The amendments the
> findings require are already applied to §3.2, §3.3, §3.4, §5.4 and §7 below.

Three questions the base spec itself flags as unverified. Each is cheap to answer now and expensive to discover late. Output is an answer and a recommendation, not code that is kept.

1. **Are the ENSv2 Sepolia beta contracts in base spec §4 still live, and does `commit` → 60s → `register` succeed?** ENS documents them as *"not yet final and may change prior to mainnet deployment."* If any address has moved, B's entire budget is wrong.
   **1b.** What is the actual subname-issuance method on `UserRegistryImpl`? C depends on it.
2. **Does Arc testnet support EIP-7702?** This decides whether a payroll batch is one signature or `N+1`. The design works either way; only the UX and the day-4 estimate change.
3. **Does Circle Bridge Kit forward to our destination chains?** If yes, no relayer key is needed anywhere. If no, D requires a server-side operational gas key (§5.4) — a security-sensitive component that must not be designed on day four.

### 1.2 Standing risks

- **D is the item most likely to be incomplete on demo day.** Mitigated by building D chain-agnostically off a CCTP domain table, with same-chain Arc→Arc working first. Partial completion degrades to "fewer destination chains", never to "payroll does not run".
- **C is not blocked by B.** Employees exist in the database independently of ENS (base spec §9). If ENS registration fails, the Team page and payroll still operate on raw addresses.
- **ENS registration now sits on the demo path, and it needs a faucet.** See §3.4.

---

## 2. Sub-project A — Dashboard shell

### 2.1 Information architecture

A persistent sidebar. Five destinations plus settings is past what a top nav carries well, and it gives B, C, and D a home before they exist.

```
┌───────────────┬──────────────────────────────────────────┐
│  UniPay       │  Invoices                    acme.eth ▾  │
│  ───────────  ├──────────────────────────────────────────┤
│  Overview     │  ┌────────────────────────────────────┐  │
│  Invoices  ●  │  │ AMOUNT      DESCRIPTION   STATUS   │  │
│  Identity     │  ├────────────────────────────────────┤  │
│  Team         │  │ 100.004417  Order #1234   ● Paid   │  │
│  Payroll      │  │  49.002118  Consulting    ○ Pending│  │
│  ───────────  │  └────────────────────────────────────┘  │
│  Settings     │                                          │
└───────────────┴──────────────────────────────────────────┘
```

| Route | Purpose | Sub-project |
|---|---|---|
| `/dashboard` | Overview — total received, open invoices, recent activity | A |
| `/dashboard/invoices` | Invoice table | A |
| `/dashboard/invoices/new` | Create invoice (exists; restyled) | A |
| `/dashboard/invoices/[id]` | Detail with status timeline | A |
| `/dashboard/identity` | ENS registration and records | B |
| `/dashboard/team` | Employees and subnames | C |
| `/dashboard/payroll` | Batch list | D |
| `/dashboard/payroll/[id]` | Per-item execution progress | D |
| `/dashboard/settings` | Payout wallet, destination chain, wallet management | A |

`/i/[id]` — the public invoice page — stays outside the shell. It is customer-facing and correctly has no navigation.

### 2.2 Visual identity

Deliberately **not** the consumer app's identity. `client/tailwind.config.js` defines a lime `#C5F82A` dark-first brand with Inter/Outfit; the merchant dashboard takes a distinct, sober, data-dense direction that signals "business tool".

Declared as Tailwind v4 `@theme` tokens in `business/app/globals.css`, replacing the `create-next-app` scaffold currently there:

| Token | Value | Role |
|---|---|---|
| ground | `#FAFAF9` | warm off-white page background |
| card | `#FFFFFF` | surfaces |
| border | `#E7E5E4` | hairlines |
| ink | `#1C1917` | primary text |
| muted | `#78716C` | secondary text |
| accent | `#0D9488` | the single action colour |

Warm stone neutrals rather than the consumer app's cool zinc. One restrained accent, nowhere near the consumer lime.

**Typography:** IBM Plex Sans for UI, **IBM Plex Mono for every amount and address**. Tabular figures are not decorative in a ledger — the current app renders amounts in proportional Arial, which is why columns do not align.

**Density:** 13px base, 44px table rows, real `<table>` semantics. The current invoice list is a `<ul>` and must become a table with Amount / Description / Status / Created / Expires columns.

The six invoice status colours already in `business/app/(merchant)/dashboard/page.tsx` are retained, re-toned for the warmer ground.

### 2.3 The one substantive addition

An invoice detail page with a real status timeline: Pending → Processing → Paid, with the Arc transaction hash linked to `testnet.arcscan.app` once the watcher credits it.

Base spec §10 records that `PROCESSING` currently never populates, because the consumer app does not call `POST /public/invoices/:id/payments`. **The timeline must show this honestly as a skipped step, not as a stuck spinner.** An invoice jumping Pending → Paid is the expected behaviour today, and the UI should not imply otherwise.

### 2.4 Settings

Payout wallet address (with the deliberate-change path the server-side upsert already supports), destination chain, and Privy wallet management. Note the guard in `dashboard/page.tsx` — registration must not run on the polling interval, because `useWallets()` ordering is not stable and re-registering could silently flip the payout address. Settings is where a payout address change becomes an explicit, intentional act.

---

## 3. Sub-project B — ENS identity

### 3.1 Model

```prisma
model EnsRegistration {
  id             String    @id @default(cuid())
  businessId     String    @unique
  business       Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  label          String            // "acme"
  name           String            // "acme.eth"
  status         EnsStatus @default(DRAFT)
  ownerAddress   String
  subregistry    String?           // deployed UserRegistry proxy
  resolver       String?
  secretCipher   Bytes             // commit secret, envelope-encrypted
  secretIv       Bytes
  secretTag      Bytes
  secretDek      Bytes
  commitTxHash   String?
  committedAt    DateTime?         // from BLOCK timestamp, never the client clock
  registerTxHash String?
  durationSecs   Int
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

enum EnsStatus { DRAFT COMMITTED REGISTERED FAILED }
```

The commit secret is the one genuinely sensitive value this sub-project persists, and it is exactly what the base spec's §6 envelope encryption exists for. It is never returned by any API response and never logged.

### 3.2 Registration is six transactions

Every address and signature below was verified against deployed Sepolia bytecode on 2026-09-09. Contract addresses live in the spike findings; treat that document as the source and do not retype them from memory.

`makeCommitment` takes `subregistry` as a parameter, so the business's own registry must be deployed **before** the commitment is computed:

```
1. VerifiableFactory.deployProxy(UserRegistryImpl, salt)   → subregistry address
2. MockUSDC.mint(owner, price)                             → open faucet, no auth
3. MockUSDC.approve(ETHRegistrar, price)
4. ETHRegistrar.commit(commitment)
   ⏳ wait ≥ 60 s  (MIN_COMMITMENT_AGE) and < 24 h (MAX_COMMITMENT_AGE)
5. ETHRegistrar.register(label, owner, secret, subregistry, resolver, duration, paymentToken, referrer)
6. PublicResolverV2.multicall([setAddr, setText ×4])
```

The two registrar signatures are **not** the same shape, and an earlier draft of this spec had both wrong:

```solidity
makeCommitment(string label, address owner, bytes32 secret, IRegistry subregistry,
               address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)

register(string label, address owner, bytes32 secret, IRegistry subregistry,
         address resolver, uint64 duration, IERC20 paymentToken, bytes32 referrer)
         returns (uint256)
```

`makeCommitment` takes **seven** parameters and no payment token; `register` takes eight. `referrer` is `bytes32` in both, not an address.

Six wallet approvals is an unacceptable demo. **Mitigation: batch with EIP-5792 `wallet_sendCalls` — but not as 1–4 and 5–6.**

`VerifiableFactory` exposes `deployProxy(address implementation, uint256 salt, bytes data) returns (address)` and **no address predictor** — verified against its deployed ABI on 2026-09-09. The subregistry address exists only once call 1 has executed, and `makeCommitment` needs it to produce the commitment for call 4. A single batch cannot feed one call's return value into a later call's arguments, so 1–4 is not a batchable group. The real grouping is:

```
A. [deployProxy]                        → 1 signature
   read subregistry from the ProxyDeployed event
B. [mint, approve, commit]              → 1 signature
   ⏳ 60 s ≤ wait < 24 h
C. [register, resolver multicall]       → 1 signature
```

**Three signatures, not two** — still a long way from six. Batch C sets the records in the same atomic call that registers the name, which works because `register` establishes ownership before the resolver call runs. Without `wallet_sendCalls` the fallback is the same six transactions in the same order, and the register/records pair splits into two so records can be retried on their own.

Both chains support EIP-7702 — Sepolia since Pectra, and Arc confirmed by direct submission (spike question 2). **But chain support is necessary, not sufficient:** `wallet_sendCalls` is a *wallet* capability, and whether Privy and the connected wallet expose it is a separate question answered only at runtime. Plan 3 must call `wallet_getCapabilities` and branch on the answer. **Fallback:** six sequential signings, with the count stated up front before the merchant starts, per base spec §5. The fallback is a live code path, not a contingency to write later.

**`acme.eth` is already registered on the ENSv2 beta.** Demo and test data must use a label verified free — `unipaydemo` was available at 8.000021 MockUSDC for one year when the spike ran.

### 3.3 Endpoints

Server-prepares / browser-signs throughout (base spec §5). Every endpoint returns unsigned `{to, data, value, chainId}` call objects. No endpoint returns or requires signing material.

| Endpoint | Behaviour |
|---|---|
| `GET /ens/availability?label=` | `isAvailable`, then `getRegisterPrice(label, duration, paymentToken)` → `(base, premium)`, read-only via viem on Sepolia. Order matters: pricing an unavailable name reverts `NameNotAvailable` |
| `POST /ens/registrations` | Generate a 32-byte secret, encrypt at rest, compute `makeCommitment`, return calls 1–4 |
| `POST /ens/registrations/:id/committed` | Record `commitTxHash`; set `committedAt` from the **block** timestamp |
| `GET /ens/registrations/:id` | Status and a server-supplied `readyAt` |
| `POST /ens/registrations/:id/register-calls` | Re-check ≥60s **and <24h** against block time server-side, decrypt the secret, return calls 5–6. A commitment past `MAX_COMMITMENT_AGE` is dead — respond with the re-commit branch, never calls 5–6 |
| `POST /ens/registrations/:id/registered` | Mark `REGISTERED` |

The sixty-second window is a first-class UI state — a countdown driven by `readyAt`, not a spinner. The flow is resumable: closing the tab mid-registration leaves a row to continue from, never a stranded name.

**Resumable within 24 hours.** `MAX_COMMITMENT_AGE` is 86,400 s, so a `COMMITTED` row older than that holds a commitment the registrar will no longer honour. Continuing it produces a revert the merchant cannot act on. Such a row returns to `DRAFT` with a fresh secret and a fresh `commit` — a new sixty seconds, not a resumed one. The name was never at risk; only the commitment expired.

**`isAvailable` is not a validity check.** It returns `true` for labels the registrar will nonetheless refuse: `isAvailable("ab")` is `true` while pricing it reverts `NotValid(string)`. The Identity page enforces label length and character rules itself before it calls either endpoint, so a merchant never sees a green check followed by a revert.

Resolver addresses are looked up fresh per name via `getEnsResolver` and never cached, as ENSv2's per-account resolver model requires.

### 3.4 Two consequences the base spec did not carry

Both confirmed by the day 0 spike and unchanged. MockUSDC is an open faucet — `mint(address,uint256)` succeeds from any sender — so the registration *fee* is genuinely free, which is exactly why the *gas* requirement below is the one that bites.

- **Privy must add Sepolia.** `business/app/providers.tsx` currently sets `supportedChains: [arcTestnet]`. ENS lives on Sepolia, so the provider config needs both chains and the Identity page needs an explicit chain-switch step. **Invoices and settlement remain entirely on Arc** — this changes nothing about the payment path.
- **The merchant needs Sepolia ETH for gas.** MockUSDC covers the ENS registration *fee*, not gas. Base spec §8 made ENS optional precisely to avoid "dead-ending new users on a faucet"; building it puts that faucet on the demo path. **The demo wallet must be pre-funded with Sepolia ETH**, and the Identity page must detect a zero balance and say so plainly rather than failing at signing time.

### 3.5 Records

Per base spec §8, written via a single resolver `multicall`:

| Record | Value |
|---|---|
| `addr` | payout address |
| `unipay.address` | payout address |
| `unipay.chain` | `arc-testnet` |
| `unipay.asset` | `USDC` |
| `unipay.label` | display label |

An address alone never implies a chain; the destination chain is always explicit.

**ENS remains additive.** Businesses register on Sepolia while the consumer app resolves mainnet only (base spec §12.2), so a fresh name will not resolve at checkout. Nothing in the payment path may depend on ENS resolution.

---

## 4. Sub-project C — Team and subnames

### 4.1 Model

```prisma
model Employee {
  id            String   @id @default(cuid())
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name          String
  walletAddress String
  subnameLabel  String?          // "john"
  subname       String?          // "john.acme.eth"
  subnameTxHash String?
  prefChain     String   @default("arc-testnet")
  prefAsset     String   @default("USDC")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([businessId, subnameLabel])
}
```

### 4.2 ENS is enrichment, not a prerequisite

An employee can be added with only a name and an address. A subname is an optional enrichment on top. This is the load-bearing reason payroll survives an ENS failure: if B slips, C and D still operate on raw addresses.

Each subname carries its own `unipay.chain` / `unipay.asset` records, which is what allows employees to be paid on different chains — the premise §5 depends on.

Names are `john.acme.eth` (a real 2LD subname), not `john.acme.unipay.eth`. Base spec §13.5 already resolved that contradiction between the two source documents.

### 4.3 Issuance

Subname issuance prepares an unsigned call against the business's own `UserRegistry`, signed in the browser on Sepolia, followed by a resolver `multicall` for the subname's records.

**Resolved 2026-09-09 by the day 0 spike.** The issuance method, verified present in the deployed `UserRegistryImpl` bytecode as selector `0x85f3e643`:

```solidity
register(string label, address owner, IRegistry registry, address resolver,
         uint256 roleBitmap, uint64 expiry) returns (uint256)
```

**The business owns the subname token; the employee's wallet goes in the `addr` record.** This is forced, not preferred. `PublicResolverV2.canModifyName` resolves a node's owner by walking the registry from the root and authorises only that owner (or an approved operator). §4.3's flow has the business signing both the issuance and the records `multicall`, so if the employee owned the token the business could not write the employee's records at all and §4.2's per-subname `unipay.chain` / `unipay.asset` records — the premise §5 depends on — would be unreachable.

The tradeoff is real and should be stated to merchants rather than hidden: an employee does not control their own subname. Transferring it to them later is possible but out of scope here, and would cost the business the ability to update the records.

`roleBitmap` is the narrowest set that supports the operations the Team page offers, granted on the subname token to the business:

| Role | Value | Why |
|---|---|---|
| `ROLE_UNREGISTER` | `1 << 12` | revoke a subname when someone leaves |
| `ROLE_RENEW` | `1 << 16` | extend expiry |
| `ROLE_SET_RESOLVER` | `1 << 24` | repoint the name if the resolver is ever replaced |

Combined: `0x1011000`. `ROLE_SET_SUBREGISTRY` is deliberately excluded — employees have no children, so granting it would widen authority for nothing.

**Probed 2026-09-09; evidence says batching works, but it has not been executed.** `canModifyName` reads `NAME_WRAPPER.names(node)` and returns `false` when that is empty, so the question was whether a freshly issued name is known there in the same transaction. Against live Sepolia, `NAME_WRAPPER` (`0x0635513f179D50A207757E05759CbD106d7dFcE8`) returns `0x0461636d650365746800` — DNS wire format for `acme.eth` — for a registered 2LD, and empty for an unregistered one. `UserRegistry`'s constructor takes an `ILabelStore` described as "the shared label database", so the entry is written by registration itself rather than by any later process.

That means the records `multicall` can share a transaction with issuance, and the same holds for §3.2's batch C. It is inference from a read, not an executed registration — **both plans keep the two-signature split available**, and the first live registration is what confirms it.

The subname's records mirror §3.5 but point at the employee: `addr` and `unipay.address` are the employee's wallet, `unipay.chain` and `unipay.asset` are their preferred chain and asset, `unipay.label` their display name.

### 4.4 UI

`/dashboard/team` — a table of employees (name, address, subname, preferred chain, preferred asset), an add-employee form, and a per-row "issue subname" action that is disabled with an explanatory note when no ENS name is registered.

---

## 5. Sub-project D — Payroll

### 5.1 Models

```prisma
model PayrollBatch {
  id          String   @id @default(cuid())
  businessId  String
  status      PayrollBatchStatus @default(DRAFT)
  fundingChain String  @default("arc-testnet")
  totalBase   BigInt
  executedAt  DateTime?
  createdAt   DateTime @default(now())
  items       PayrollItem[]
}

model PayrollItem {
  id          String   @id @default(cuid())
  batchId     String
  employeeId  String
  amountBase  BigInt
  destChain   String
  destAsset   String
  status      PayrollItemStatus @default(PENDING)
  burnTxHash  String?
  messageHash String?
  attestation String?
  mintTxHash  String?
}

enum PayrollBatchStatus { DRAFT PREPARED SIGNING EXECUTING COMPLETED PARTIAL FAILED }
enum PayrollItemStatus  { PENDING BURNED ATTESTED MINTED FAILED }
```

Amounts are integer base units (`BigInt`, 6-decimal micro-USDC), never floats — consistent with the invoice path.

### 5.2 Route computation

Server-side, per item, returned unsigned:

- **Destination equals funding chain** → `USDC.transfer(employee, amount)`
- **Cross-chain** → one `approve(TokenMessenger, total)` for the batch, then one CCTP v2 `depositForBurn(amount, destDomain, mintRecipient, burnToken, …)` per item

Burns cannot be merged: `mintRecipient` differs per employee. A batch is therefore `1 + N` calls — one signature under EIP-5792, `N+1` without. **The UI states the signature count before the merchant commits.**

The consumer app's CCTP engine lives in `client/src/context/PaymentContext.tsx` — another app's React context, neither importable nor editable — so route computation is reimplemented server-side in NestJS. This is a known drift risk requiring coordination (base spec §12.4).

### 5.3 Destination mint

`receiveMessage` needs gas paid on the destination chain. Base spec §11's order of preference, resolved by spike question 3:

1. **Circle Bridge Kit forwarding.** If it covers our routes, no relayer key exists anywhere. Strongly preferred.
2. **A UniPay operational gas key**, server-side only, held in the secret manager — never in the database, never in a frontend bundle.

### 5.4 What the operational gas key is, precisely

If option 2 is required, its nature must not be blurred. CCTP's `receiveMessage` is permissionless and the mint recipient is **fixed at burn time**, so this key can only pay gas to complete a transfer the business has already authorised. **It cannot redirect funds or take custody.** It is categorically different from a user key.

It is nonetheless a hot key, and it is the one place where a five-day deadline and a security-sensitive component overlap. That is why spike question 3 is asked on day zero rather than discovered on day four.

**Decision (2026-09-09, from the spike): option 2 stays out of Plan 5's first cut.** Circle's forwarding service does what option 1 promised, but it is not reachable through Bridge Kit yet — Circle's own roadmap puts that at end of H1 2026. So the preferred option is unavailable and the fallback is a hot key, which is precisely the pair §1.1 wanted to know about before day four.

Plan 5 therefore builds in this order, stopping wherever the budget runs out:

1. **Same-chain Arc→Arc payroll.** No CCTP, no forwarding, no key, and it demonstrates a batch running end to end. This is §1.2's floor and it is now the plan of record, not the degraded case.
2. **Employee-claims for cross-chain.** The burn happens on Arc; the employee mints on the destination and pays their own gas. No server-side key exists in this model.
3. **CCTP forwarding called directly**, bypassing Bridge Kit, which Circle says is live for CCTP on testnet today. This preserves the no-destination-gas experience at the cost of a deliberate deviation from the base spec's Bridge Kit routing.

Introducing the operational gas key is a decision to take deliberately, with this section's constraints and a scoped key — never as a day-four improvisation to reach a demo.

For contrast, `client/src/services/relayer.ts:71` reads `VITE_RELAYER_PRIVATE_KEY`, which Vite inlines into the shipped bundle — readable by anyone who opens devtools (base spec §13.3). That file is `client/` code and out of scope, but avoiding exactly that pattern is the entire reason this key stays server-side.

### 5.5 Payroll watcher

Extends the cursor pattern already proven in `server/src/watcher/arc-watcher.service.ts`: poll Circle's Iris API for attestations on `BURNED` items, then drive `receiveMessage` and record `mintTxHash`.

Same correctness bar as the Arc watcher: idempotent on replay, resumable from its cursor after downtime, tolerant of API gaps, and it must never double-mint an item.

### 5.6 Chain scope

**Testnets only.** Arc mainnet has no public RPC until approximately 2026-09-16 (base spec §4), so funding is Arc testnet, which means every destination must also be a testnet: Base Sepolia, OP Sepolia, Arbitrum Sepolia, Ethereum Sepolia, Avalanche Fuji, Polygon Amoy, and the remaining CCTP testnet domains.

EVM only. Solana and Sui are substantially different CCTP integrations and remain deferred rather than half-built (base spec §11).

D is built chain-agnostically off a CCTP domain table, so a misbehaving testnet costs that destination, not the sub-project.

### 5.7 UI

`/dashboard/payroll` lists batches. A new batch pre-fills employees from Team with their preferred chain and asset, shows the total, a per-destination-chain breakdown, and a fee estimate, then states the signature count before execution. `/dashboard/payroll/[id]` shows per-item progress — Pending → Burned → Attested → Minted — with transaction links on the correct explorer per chain.

**Explicitly out of scope:** scheduled or recurring runs, and the session signers that would be required to execute payroll while the business is offline (base spec §5). The unqualified non-custodial claim holds only while that remains true.

---

## 6. Testing

Test-driven, per the repository's standard workflow. Unit-testable without network access:

- **A:** amount and address formatting, tabular rendering, status timeline state derivation including the skipped-`PROCESSING` case
- **B:** commitment computation, record encoding, the ≥60s block-time gate, encrypted-secret round-trip and tamper detection, resumability from each `EnsStatus`
- **C:** employee CRUD with ownership assertions, subname label uniqueness per business, correct behaviour with no ENS name registered
- **D:** route computation per destination (same-chain vs CCTP), batch call ordering and approval inclusion, `1 + N` call-count assertions, attestation polling idempotency, no double-mint on replay, cursor resume
- **Across all:** the standing assertion that no prepared-transaction endpoint ever returns or requires signing material

Integration tests against Sepolia and Arc testnet run behind an explicit flag, never in the default suite.

---

## 7. Open items

- **[UNSOURCED]** Payroll and subname requirements derive from the base spec's summary of an unavailable document (§0). If the "UniPay v2 PDF" surfaces, §4 and §5 must be reconciled against it. **Widened 2026-09-09:** `client/src/pay.md` holds no contract addresses at all and treats ENS purely as consumer-side resolution, never registration — so §3 rests on that same unavailable document, not only §4 and §5. The spike verified the contracts behave as §3 assumes; it cannot verify that §3 is what was asked for.
- ~~**[UNSOURCED]** `UserRegistryImpl` subname issuance signature — spike question 1b.~~ Fully resolved in §4.3, including the ownership model and roleBitmap. **Closed 2026-09-09:** `register(string label, address owner, IRegistry registry, address resolver, uint256 roleBitmap, uint64 expiry) returns (uint256)`, selector `0x85f3e643`, verified present in deployed bytecode. `roleBitmap` still needs a decision in Plan 4 — an employee subname should carry the narrowest role set that lets its records resolve.
- ~~**To verify on day 0:** ENSv2 Sepolia contract liveness, Arc EIP-7702 support, Circle Bridge Kit route coverage.~~ **Done 2026-09-09** — see the spike findings.
- **Probed, not executed:** `NAME_WRAPPER.names(node)` is populated for registered names and empty for unregistered ones, so records should batch with issuance (§4.3). Confirmed only by a read; the first live registration settles it.
- **Deferred by decision:** Solana and Sui payroll destinations, session signers for unattended payroll, Uniswap swap routing, Arc mainnet.

---

## 8. Build order

| # | Sub-project | Plan | Depends on |
|---|---|---|---|
| 0 | Spike | none — findings only | — |
| A | Dashboard shell | Plan 2 | merchant core (shipped) |
| B | ENS identity | Plan 3 | A |
| C | Team and subnames | Plan 4 | B for subnames; A alone for employees |
| D | Payroll | Plan 5 | C |

Each sub-project gets its own implementation plan. All work continues on `feat/business-side`.
