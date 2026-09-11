# Day 0 Spike — Findings

**Spike defined in:** `docs/superpowers/specs/2026-09-09-unipay-merchant-dashboard-design.md` §1.1
**Run:** 2026-09-09, against live Sepolia (block 11,670,012) and Arc testnet (chain 5042002)
**Output:** facts and a recommendation. No code from this spike is kept; the probe scripts were throwaway.

Every on-chain claim below was read from a deployed contract or a live node, not from documentation. Where documentation is the only source, it says so.

---

## Summary

| # | Question | Answer |
|---|---|---|
| 1 | ENSv2 Sepolia contracts live? `commit` → 60s → `register`? | **Yes.** All six live; `MIN_COMMITMENT_AGE` is 60s exactly as assumed |
| 1b | Subname issuance method on `UserRegistryImpl`? | **`register(string,address,address,address,uint256,uint64)`** |
| 2 | Arc testnet supports EIP-7702? | **Yes**, confirmed by submission, not inference |
| 3 | Circle Bridge Kit forwards to our destination chains? | **No — not through Bridge Kit today.** The one unfavourable answer |

Two of three land favourably. Question 3 is the one that costs something, and it is the one the spike existed to find early.

---

## 1. ENSv2 on Sepolia — live, and the spec's assumptions mostly hold

All six contracts carry code at block 11,670,012:

| Contract | Address | Code |
|---|---|---|
| ETHRegistrar | `0xa88553f454b77203b0d036a05c894d555eaaa2cc` | 7,497 bytes |
| VerifiableFactory | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` | 1,411 bytes |
| UserRegistryImpl | `0x624a25d67b59d587752ebec8dded8827dae52050` | 17,159 bytes |
| PublicResolverV2 | `0xe7b9a25607e02da8145e4eb1836ca539e53f11f7` | 14,433 bytes |
| MockUSDC | `0x768f42455a2d082e23ceef7d51e5787c82d67a39` | 4,309 bytes |
| ETHRegistry | `0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2` | 14,730 bytes |

ENS labels these "(ENSv2 Beta)" and still documents them as non-final. Sub-project B's budget is not wrong.

### The commitment window

- `MIN_COMMITMENT_AGE()` = **60 s** — read from the registrar. Design spec §3.2's sixty-second wait is correct.
- `MAX_COMMITMENT_AGE()` = **86,400 s (24 h)** — **the design spec does not carry this.**

That second value has a design consequence. §3.3 says the flow is "resumable: closing the tab mid-registration leaves a row to continue from, never a stranded name." True only within 24 hours. A `COMMITTED` row older than that has a dead commitment and must re-commit — a new secret, a new `commit`, a new sixty seconds. Plan 3 needs that branch.

### Signatures — verified against deployed bytecode, not just source

Each was compiled to a selector and confirmed present in the deployed code:

```
ETHRegistrar
  0x1e966f07  makeCommitment(string,address,bytes32,address,address,uint64,bytes32)
  0xcff3e7c2  register(string,address,bytes32,address,address,uint64,address,bytes32)
  0x61907b12  getRegisterPrice(string,uint64,address) -> (uint256 base, uint256 premium)
  0x965306aa  isAvailable(string)
  0xf14fcbc8  commit(bytes32)
  0x16a92535  commitmentAt(bytes32)
```

Three corrections to the design spec fall out of this:

- **`makeCommitment` takes seven parameters, not eight.** It has no `paymentToken`. Spec §3.2 lists eight for `register` and implies the same shape for the commitment.
- **`referrer` is `bytes32`, not `address`.**
- **`getRegisterPrice` takes the payment token and returns a pair** — `(base, premium)`. Spec §3.3 treats it as a single value.

### Two traps that would have surfaced during implementation

**Availability is not validity.** `isAvailable("ab")` returns `true`, and then `getRegisterPrice("ab")` reverts `NotValid(string)`. A merchant typing a two-character label gets a green check followed by a revert. The Identity page must enforce label length itself rather than trusting `isAvailable`.

**Pricing a taken name reverts.** `getRegisterPrice` on an unavailable label reverts `NameNotAvailable(string)` (`0x477707e8`). The price call has to be gated behind the availability check, not fired alongside it.

### Live reads

- `isAvailable("acme")` = **false**. The spec's running example name is already taken on the beta — **pick another demo label.** `unipaydemo` is available.
- `getRegisterPrice("unipaydemo", 1 year, MockUSDC)` = **8,000,021 base units = 8.000021 USDC**, premium 0.
- MockUSDC: 6 decimals, symbol `USDC`, and `mint(address,uint256)` **succeeds from an arbitrary unfunded sender** — an open faucet. Step 2 of §3.2 is free, as assumed.

### 1b. Subname issuance — the §7 open item, closed

`UserRegistryImpl` is an ERC-1155 registry behind a UUPS proxy. The issuance method is:

```solidity
register(string label, address owner, IRegistry registry, address resolver,
         uint256 roleBitmap, uint64 expiry) returns (uint256)
```

Selector `0x85f3e643`, present in the deployed bytecode. Supporting methods also confirmed present: `setSubregistry(uint256,address)`, `setResolver(uint256,address)`, `getExpiry(uint256)`, `latestOwnerOf(uint256)`, `getSubregistry(string)`.

Sub-project C's dependency is real and reachable. `roleBitmap` is the parameter that needs a decision when Plan 4 is written — ENSv2 supports 32 granular roles, and an employee subname should get the narrowest set that lets the record resolve.

---

## 2. Arc testnet supports EIP-7702 — confirmed by submission

Two independent signals, the second decisive.

**Header evidence.** Arc's latest block carries `requestsHash` (EIP-7685), the Prague header field, alongside `parentBeaconBlockRoot`, `blobGasUsed` and `excessBlobGas`. A Prague header means a post-Pectra chain, and EIP-7702 ships in Pectra.

**Direct evidence.** A type-4 transaction was signed locally with a throwaway unfunded key and submitted to `rpc.testnet.arc.network`. The node replied:

```
{"code":-32003,"message":"nonce too low: next nonce 44, tx nonce 0"}
```

To produce that error the node parsed the type-4 envelope, validated the signature, recovered the sender, and looked up that account's nonce. A chain without 7702 rejects the envelope itself — "transaction type not supported" — and never reaches nonce checking. The transaction was rejected and nothing was broadcast.

**Consequence.** A payroll batch can be one signature rather than N+1. The day-4 estimate improves rather than degrades, and §3.2's EIP-5792 batching plan sits on the favourable side of the fork on both chains — Sepolia has supported 7702 since Pectra too.

**One caveat the spec should record.** EIP-5792 `wallet_sendCalls` is a *wallet* capability, not a chain one. Chain support is necessary, not sufficient. Whether batching actually happens depends on Privy and the connected wallet, so Plan 3 must feature-detect `wallet_getCapabilities` at runtime and keep the six-sequential-signing fallback from §3.2 live rather than assuming the batch.

---

## 3. Circle Bridge Kit does not forward yet — the expensive answer

This one is documentation-sourced; there is no cheap on-chain probe for it.

Circle's **Crosschain Forwarding Service** does precisely what design spec §5.4 wants: it handles attestation and destination-chain settlement automatically, and *"users are not required to hold destination-chain gas."* The forwarding fee is deducted from the minted USDC on the destination side. It supports Arbitrum, Avalanche, Base, Ethereum, HyperEVM, Ink, Linea, Monad, OP Mainnet, Polygon PoS, Sei, Sonic, Unichain and World Chain.

**But it is not available through Bridge Kit.** Circle states the service is currently available for CCTP on testnet and for xReserve integrations, with the roadmap being *"by the end of H1 2026 we plan to expand forwarding support across all CCTP-enabled routes and introduce forwarding as an option within both Bridge Kit and Circle Gateway."*

So the spike's stated conditional resolves the unfavourable way: **if no, D requires a server-side operational gas key (§5.4)** — the security-sensitive component §1.1 explicitly did not want designed on day four.

CCTP testnet route coverage itself is not the problem. Testnet routes include Arc Testnet, Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia, OP Sepolia, Unichain Sepolia, Linea Sepolia, Avalanche Fuji and Polygon Amoy — matching the base spec's network list. The gap is forwarding, not reachability.

### Recommendation: do not build the relayer key

§1.2 already plans for D to degrade by *chain coverage* rather than by existence, and that mitigation now carries the weight it was written for. Three options, in the order I would take them:

1. **Same-chain Arc→Arc payroll first.** No CCTP, no forwarding, no key. This is already §1.2's floor and it demos a payroll batch running end to end.
2. **Employee-claims model for cross-chain.** The burn happens on Arc; the employee mints on the destination and pays their own gas there. Needs no server-side key at all, and it is honest about who holds custody.
3. **Call CCTP's forwarding directly**, bypassing Bridge Kit, since Circle says forwarding is live for CCTP on testnet today. This preserves the no-gas-needed experience. It costs an adapter that the base spec wanted to route through Bridge Kit, so it is a deliberate deviation, not a shortcut.

**A server-side operational gas key should not enter Plan 5's first cut.** It is a signing key held by our infrastructure, and adding one to hit a demo date is how key-custody decisions get made badly. If cross-chain payroll must be demonstrated and option 3 proves unreachable, that is a decision to take deliberately, with §5.4's envelope-encryption design and a scoped key — not a day-four improvisation.

---

## Amendments Plan 3 needs before it is written

1. **§3.2** — correct `makeCommitment` to seven parameters with no `paymentToken`; `referrer` is `bytes32`.
2. **§3.3** — `getRegisterPrice(label, duration, paymentToken)` returns `(base, premium)`; gate it behind `isAvailable`; validate label length client-side, because `isAvailable` does not.
3. **§3.3** — add the 24-hour commitment expiry to the resumable-flow design. A `COMMITTED` row past `MAX_COMMITMENT_AGE` must re-commit, not continue.
4. **§3.2** — record that EIP-5792 batching is a wallet capability to feature-detect, with the sequential fallback kept live. Chain support is confirmed on both chains and is not the constraint.
5. **§3.4** — unchanged and confirmed. Privy still needs Sepolia added; the merchant still needs Sepolia ETH for gas, since MockUSDC covers only the registration fee.
6. **§7** — close the `UserRegistryImpl` UNSOURCED item with the signature in §1b above.
7. **Demo data** — `acme.eth` is taken on the beta. Choose another label.

## What this spike did not answer

The **[UNSOURCED]** marker on payroll and subname *requirements* (§0, §7) stands. This spike verified that the contracts and chains behave as the design assumed; it says nothing about whether the design matches the missing "UniPay v2 PDF". Confirmed today: `client/src/pay.md` — the only base spec in the repo — contains no contract addresses at all and treats ENS purely as consumer-side *resolution* (`alice.eth` → address), never as registration. The entire ENS registration design in §3 rests on that same unavailable document, which is wider than §0 recorded.

---

**Sources for the documentation-only claims (§3):** Circle, ["Introducing Our New Crosschain Forwarding Service"](https://www.circle.com/blog/introducing-our-new-crosschain-forwarding-service-now-integrated-into-cctp); ENS, [Deployments](https://docs.ens.domains/learn/deployments/); [`ensdomains/contracts-v2`](https://github.com/ensdomains/contracts-v2) source for interface shapes, each verified against deployed bytecode.
