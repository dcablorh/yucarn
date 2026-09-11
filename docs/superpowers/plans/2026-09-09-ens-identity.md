# ENS Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A merchant registers `<label>.eth` on the ENSv2 Sepolia beta from the dashboard, in three wallet signatures, and the name carries UniPay payout records.

**Architecture:** The server prepares, the browser signs. Every endpoint returns unsigned `{to, data, value, chainId}` call objects; no endpoint ever returns, requests, or stores signing material. The one sensitive value this feature persists is the ENS commit secret, which is envelope-encrypted at rest with the shipped `EncryptionService` and never appears in a response or a log. Registration is a resumable state machine keyed on a `EnsRegistration` row, with the sixty-second commitment window enforced against **block** timestamps read from Sepolia, never a client clock.

**Tech Stack:** NestJS 11 + Prisma 6 + Postgres (server), Next.js 16 App Router + React 19 + Privy 3.40 + viem 2.56 (business), Jest (server tests), Vitest (business tests).

**Spec:** `docs/superpowers/specs/2026-09-09-unipay-merchant-dashboard-design.md` §3, as amended by `docs/superpowers/specs/2026-09-09-day-0-spike-findings.md`.

## Global Constraints

- **`client/` is off-limits.** No file under `client/` may be created, edited, or deleted. Another developer owns it.
- **No user private keys, seed phrases, or recovery phrases** are ever stored, requested, logged, or transmitted — encrypted or otherwise.
- **The server never signs on a merchant's behalf.** It prepares unsigned calls; the browser signs. No endpoint returns signing material.
- **The commit secret is envelope-encrypted at rest** via the existing `EncryptionService`, is never returned by any API response, and is never logged.
- **Invoices and settlement stay entirely on Arc.** ENS lives on Sepolia. Nothing in the payment path may depend on ENS resolution.
- **ENS is additive.** A business with no ENS registration must keep working exactly as it does today.
- Amounts remain integer base units carried as strings and converted with `BigInt`. Never `Number`, never a float.
- Money and addresses render in the mono face with `tabular-nums`.
- Design tokens are the seven already in `business/app/globals.css`: `ground`, `card`, `line`, `ink`, `muted`, `accent`, `accent-hover`.
- **The commitment window is enforced server-side against Sepolia block timestamps.** `MIN_COMMITMENT_AGE` is 60 s and `MAX_COMMITMENT_AGE` is 86 400 s; both bounds are checked, and a client-supplied time is never trusted.
- **Registration must never run on a polling interval.** Every state transition is initiated by an explicit merchant action.
- Contract addresses come from `server/src/config/ens.ts` only. Never retype an address inline.
- Do not push, merge, or create branches without explicit instruction.
- The untracked root file `Development .pdf` is the user's — never `git add` it.

## Contract facts (verified against deployed Sepolia bytecode, 2026-09-09)

| Contract | Address |
|---|---|
| ETHRegistrar | `0xa88553f454b77203b0d036a05c894d555eaaa2cc` |
| VerifiableFactory | `0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef` |
| UserRegistryImpl | `0x624a25d67b59d587752ebec8dded8827dae52050` |
| PublicResolverV2 | `0xe7b9a25607e02da8145e4eb1836ca539e53f11f7` |
| MockUSDC (open faucet, 6 decimals) | `0x768f42455a2d082e23ceef7d51e5787c82d67a39` |

```solidity
// ETHRegistrar
isAvailable(string label) view returns (bool)
getRegisterPrice(string label, uint64 duration, IERC20 paymentToken) view returns (uint256 base, uint256 premium)
makeCommitment(string label, address owner, bytes32 secret, IRegistry subregistry,
               address resolver, uint64 duration, bytes32 referrer) pure returns (bytes32)
commit(bytes32 commitment)
register(string label, address owner, bytes32 secret, IRegistry subregistry, address resolver,
         uint64 duration, IERC20 paymentToken, bytes32 referrer) returns (uint256)
MIN_COMMITMENT_AGE() view returns (uint256)   // 60
MAX_COMMITMENT_AGE() view returns (uint256)   // 86400

// VerifiableFactory — no address predictor exists
deployProxy(address implementation, uint256 salt, bytes data) returns (address)
event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)

// UserRegistry (behind the proxy)
initialize(address rootAccount, uint256 roleBitmap)

// PublicResolverV2
setAddr(bytes32 node, address a)
setText(bytes32 node, string key, string value)
multicall(bytes[] data) returns (bytes[])

// MockUSDC
mint(address to, uint256 amount)      // permissionless faucet
approve(address spender, uint256 amount)
```

**Two traps, both confirmed live:**
- `isAvailable("ab")` returns `true`, then `getRegisterPrice("ab")` reverts `NotValid(string)`. Availability is not validity — this plan validates labels itself.
- `getRegisterPrice` on a taken label reverts `NameNotAvailable(string)`. Price is only ever fetched after availability returns true.

**Deliberate deviation from spec §3.1:** the spec models the secret as four `Bytes` columns (`secretCipher`, `secretIv`, `secretTag`, `secretDek`). The shipped `EncryptionService.encrypt(plaintext: string): string` already returns a single self-describing envelope containing all four parts. This plan stores one `secretEnvelope String` column instead. Same security property, one column, and it reuses the audited service rather than re-implementing its layout.

---

## File Structure

**Server — created**
- `server/src/config/ens.ts` — addresses, chain id, durations, commitment bounds, `ALL_ROLES`
- `server/src/ens/ens-label.ts` — pure label validation
- `server/src/ens/ens-label.spec.ts`
- `server/src/ens/commitment-window.ts` — pure commitment timing
- `server/src/ens/commitment-window.spec.ts`
- `server/src/ens/ens-calls.ts` — pure unsigned-call builders
- `server/src/ens/ens-calls.spec.ts`
- `server/src/ens/sepolia-rpc.client.ts` — viem reads against Sepolia
- `server/src/ens/ens.service.ts` — orchestration
- `server/src/ens/ens.service.spec.ts`
- `server/src/ens/ens.controller.ts`
- `server/src/ens/dto/create-registration.dto.ts`
- `server/src/ens/dto/record-tx.dto.ts`
- `server/src/ens/ens.module.ts`

**Server — modified**
- `server/prisma/schema.prisma` — `EnsRegistration`, `EnsStatus`, `Business.ensRegistration`
- `server/src/app.module.ts` — register `EnsModule`
- `server/.env.example` — `SEPOLIA_RPC_URL`
- `server/src/config/configuration.ts` — `sepoliaRpcUrl`

**Business — created**
- `business/lib/ens.ts` — API client hooks and shared types
- `business/lib/ens-batch.ts` — EIP-5792 capability detection and dispatch
- `business/lib/ens-batch.test.ts`
- `business/app/(merchant)/dashboard/identity/page.tsx` — route shell, branches on state
- `business/app/(merchant)/dashboard/identity/claim-form.tsx` — label search, price
- `business/app/(merchant)/dashboard/identity/registration-flow.tsx` — the three signed steps
- `business/app/(merchant)/dashboard/identity/identity-card.tsx` — the registered name and its records

**Business — modified**
- `business/app/providers.tsx` — add Sepolia to `supportedChains`
- `business/app/(merchant)/dashboard/nav.tsx` — Identity stops being "Soon"

---

### Task 1: ENS configuration and label validation

**Files:**
- Create: `server/src/config/ens.ts`
- Create: `server/src/ens/ens-label.ts`
- Test: `server/src/ens/ens-label.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ENS` config object; `validateLabel(label: string): void` (throws `InvalidLabelError`); `class InvalidLabelError extends Error`; `ENS_LABEL_MIN`, `ENS_LABEL_MAX`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/ens/ens-label.spec.ts
import { validateLabel, InvalidLabelError } from './ens-label';

describe('validateLabel', () => {
  it('accepts a plain lowercase label', () => {
    expect(() => validateLabel('unipaydemo')).not.toThrow();
  });

  it('accepts internal hyphens and digits', () => {
    expect(() => validateLabel('acme-payments-2026')).not.toThrow();
  });

  it('rejects a label shorter than three characters', () => {
    // The registrar agrees: isAvailable("ab") is true but pricing it
    // reverts NotValid(string). We refuse before either call.
    expect(() => validateLabel('ab')).toThrow(InvalidLabelError);
  });

  it('rejects uppercase', () => {
    expect(() => validateLabel('Acme')).toThrow(/lowercase/);
  });

  it('rejects a leading hyphen', () => {
    expect(() => validateLabel('-acme')).toThrow(InvalidLabelError);
  });

  it('rejects a trailing hyphen', () => {
    expect(() => validateLabel('acme-')).toThrow(InvalidLabelError);
  });

  it('rejects a dot, because a label is not a name', () => {
    expect(() => validateLabel('acme.eth')).toThrow(InvalidLabelError);
  });

  it('rejects an empty label', () => {
    expect(() => validateLabel('')).toThrow(InvalidLabelError);
  });

  it('rejects a label longer than 63 characters', () => {
    expect(() => validateLabel('a'.repeat(64))).toThrow(InvalidLabelError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/ens/ens-label.spec.ts`
Expected: FAIL — `Cannot find module './ens-label'`

- [ ] **Step 3: Write the configuration**

```ts
// server/src/config/ens.ts

/**
 * ENSv2 Sepolia beta. Every address below was verified to carry code, and
 * every signature verified present in that code, on 2026-09-09 — see
 * docs/superpowers/specs/2026-09-09-day-0-spike-findings.md.
 *
 * ENS documents these as beta and "not yet final". If a call starts
 * reverting for no reason, re-verify these before debugging anything else.
 */
export const SEPOLIA_CHAIN_ID = 11155111;

export const ENS = {
  ethRegistrar: '0xa88553f454b77203b0d036a05c894d555eaaa2cc',
  verifiableFactory: '0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef',
  userRegistryImpl: '0x624a25d67b59d587752ebec8dded8827dae52050',
  publicResolver: '0xe7b9a25607e02da8145e4eb1836ca539e53f11f7',
  mockUsdc: '0x768f42455a2d082e23ceef7d51e5787c82d67a39',
} as const;

/** Read from the deployed registrar, not assumed. */
export const MIN_COMMITMENT_AGE_SECS = 60;
export const MAX_COMMITMENT_AGE_SECS = 86_400;

/** One year, the only duration the dashboard offers. */
export const REGISTRATION_DURATION_SECS = 31_536_000n;

/** No referral programme; the registrar still requires the argument. */
export const NO_REFERRER =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

/**
 * EACBaseRolesLib.ALL_ROLES — bit 0 of every nybble. The business is the
 * root account of its own registry and holds every role in it.
 */
export const ALL_ROLES =
  0x1111111111111111111111111111111111111111111111111111111111111111n;
```

- [ ] **Step 4: Write the label validator**

```ts
// server/src/ens/ens-label.ts

export const ENS_LABEL_MIN = 3;
export const ENS_LABEL_MAX = 63;

export class InvalidLabelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLabelError';
  }
}

/**
 * Validates a label before it reaches the registrar.
 *
 * This exists because ETHRegistrar.isAvailable is not a validity check:
 * isAvailable("ab") returns true, and getRegisterPrice("ab") then reverts
 * NotValid(string). Left to the contract, a merchant would see a green
 * check followed by an unexplained revert. The rules below are the
 * conventional .eth label rules and are deliberately no looser than the
 * registrar's own.
 *
 * A label is "acme", never "acme.eth" — the name is built by the caller.
 */
export function validateLabel(label: string): void {
  if (label.length < ENS_LABEL_MIN) {
    throw new InvalidLabelError(
      `A name needs at least ${ENS_LABEL_MIN} characters`,
    );
  }
  if (label.length > ENS_LABEL_MAX) {
    throw new InvalidLabelError(
      `A name can be at most ${ENS_LABEL_MAX} characters`,
    );
  }
  if (label !== label.toLowerCase()) {
    throw new InvalidLabelError('Use lowercase letters only');
  }
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new InvalidLabelError('Use letters, digits and hyphens only');
  }
  if (label.startsWith('-') || label.endsWith('-')) {
    throw new InvalidLabelError('A name cannot start or end with a hyphen');
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx jest src/ens/ens-label.spec.ts`
Expected: PASS, 9 tests

- [ ] **Step 6: Commit**

```bash
git add server/src/config/ens.ts server/src/ens/ens-label.ts server/src/ens/ens-label.spec.ts
git commit -m "feat(server): add ENS config and label validation"
```

---

### Task 2: Commitment window

**Files:**
- Create: `server/src/ens/commitment-window.ts`
- Test: `server/src/ens/commitment-window.spec.ts`

**Interfaces:**
- Consumes: `MIN_COMMITMENT_AGE_SECS`, `MAX_COMMITMENT_AGE_SECS` from `../config/ens`.
- Produces: `type CommitmentState = 'too-new' | 'ready' | 'expired'`; `assessCommitment(committedAtSecs: number, blockNowSecs: number): { state: CommitmentState; readyAtSecs: number; expiresAtSecs: number }`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/ens/commitment-window.spec.ts
import { assessCommitment } from './commitment-window';

const COMMITTED = 1_800_000_000;

describe('assessCommitment', () => {
  it('is too new one second after committing', () => {
    expect(assessCommitment(COMMITTED, COMMITTED + 1).state).toBe('too-new');
  });

  it('is still too new at 59 seconds', () => {
    expect(assessCommitment(COMMITTED, COMMITTED + 59).state).toBe('too-new');
  });

  it('is ready at exactly 60 seconds', () => {
    // MIN_COMMITMENT_AGE is inclusive: the registrar requires >= 60.
    expect(assessCommitment(COMMITTED, COMMITTED + 60).state).toBe('ready');
  });

  it('is still ready one second before 24 hours', () => {
    expect(assessCommitment(COMMITTED, COMMITTED + 86_399).state).toBe('ready');
  });

  it('is expired at exactly 24 hours', () => {
    // MAX_COMMITMENT_AGE is exclusive: the registrar refuses at 86400.
    expect(assessCommitment(COMMITTED, COMMITTED + 86_400).state).toBe('expired');
  });

  it('is expired long after', () => {
    expect(assessCommitment(COMMITTED, COMMITTED + 200_000).state).toBe('expired');
  });

  it('reports the instants the caller needs for a countdown', () => {
    const result = assessCommitment(COMMITTED, COMMITTED + 10);
    expect(result.readyAtSecs).toBe(COMMITTED + 60);
    expect(result.expiresAtSecs).toBe(COMMITTED + 86_400);
  });

  it('treats a block timestamp before the commitment as too new', () => {
    // Chain reorgs and clock skew between reads can produce this. It is
    // never a reason to let a register call through.
    expect(assessCommitment(COMMITTED, COMMITTED - 5).state).toBe('too-new');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/ens/commitment-window.spec.ts`
Expected: FAIL — `Cannot find module './commitment-window'`

- [ ] **Step 3: Write the implementation**

```ts
// server/src/ens/commitment-window.ts
import { MAX_COMMITMENT_AGE_SECS, MIN_COMMITMENT_AGE_SECS } from '../config/ens';

export type CommitmentState = 'too-new' | 'ready' | 'expired';

export interface CommitmentAssessment {
  state: CommitmentState;
  readyAtSecs: number;
  expiresAtSecs: number;
}

/**
 * Where a commitment sits in its window, judged entirely on Sepolia block
 * timestamps. Both arguments must come from the chain: the registrar
 * compares against block.timestamp, so a server or browser clock that
 * disagrees would let us offer a register call the chain then rejects.
 *
 * The window is [committed + 60, committed + 86400). A commitment past the
 * upper bound is dead — the registrar will not honour it, and the only way
 * forward is a fresh secret and a fresh commit.
 */
export function assessCommitment(
  committedAtSecs: number,
  blockNowSecs: number,
): CommitmentAssessment {
  const readyAtSecs = committedAtSecs + MIN_COMMITMENT_AGE_SECS;
  const expiresAtSecs = committedAtSecs + MAX_COMMITMENT_AGE_SECS;

  const state: CommitmentState =
    blockNowSecs >= expiresAtSecs
      ? 'expired'
      : blockNowSecs >= readyAtSecs
        ? 'ready'
        : 'too-new';

  return { state, readyAtSecs, expiresAtSecs };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/ens/commitment-window.spec.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/ens/commitment-window.ts server/src/ens/commitment-window.spec.ts
git commit -m "feat(server): bound the ENS commitment window on both ends"
```

---

### Task 3: Unsigned call builders

**Files:**
- Create: `server/src/ens/ens-calls.ts`
- Test: `server/src/ens/ens-calls.spec.ts`

**Interfaces:**
- Consumes: `ENS`, `SEPOLIA_CHAIN_ID`, `ALL_ROLES`, `NO_REFERRER`, `REGISTRATION_DURATION_SECS` from `../config/ens`.
- Produces:
  - `interface UnsignedCall { to: string; data: string; value: string; chainId: number }`
  - `buildDeployRegistryCall(ownerAddress: string, salt: bigint): UnsignedCall`
  - `buildCommitCalls(input: { ownerAddress: string; commitment: string; priceBase: bigint }): UnsignedCall[]`
  - `buildRegisterCall(input: { label: string; ownerAddress: string; secret: string; subregistry: string; priceBase: bigint }): UnsignedCall`
  - `buildRecordsCall(input: { name: string; payoutAddress: string; label: string }): UnsignedCall`
  - `saltForRegistration(registrationId: string): bigint`

- [ ] **Step 1: Write the failing test**

```ts
// server/src/ens/ens-calls.spec.ts
import {
  buildDeployRegistryCall,
  buildCommitCalls,
  buildRegisterCall,
  buildRecordsCall,
  saltForRegistration,
} from './ens-calls';
import { ENS, SEPOLIA_CHAIN_ID } from '../config/ens';

const OWNER = '0x1111111111111111111111111111111111111111';
const SECRET = '0x' + '22'.repeat(32);
const SUBREGISTRY = '0x3333333333333333333333333333333333333333';

describe('buildDeployRegistryCall', () => {
  it('calls the factory with the UserRegistry implementation', () => {
    const call = buildDeployRegistryCall(OWNER, 42n);
    expect(call.to).toBe(ENS.verifiableFactory);
    expect(call.chainId).toBe(SEPOLIA_CHAIN_ID);
    expect(call.value).toBe('0');
    // deployProxy(address,uint256,bytes)
    expect(call.data.startsWith('0x5d84121a')).toBe(true);
    // The initialise calldata for the proxy embeds initialize(address,uint256).
    expect(call.data).toContain('cd6dc687');
    expect(call.data.toLowerCase()).toContain(OWNER.slice(2).toLowerCase());
  });
});

describe('buildCommitCalls', () => {
  it('returns mint, approve and commit in that order', () => {
    const calls = buildCommitCalls({
      ownerAddress: OWNER,
      commitment: '0x' + '44'.repeat(32),
      priceBase: 8_000_021n,
    });

    expect(calls).toHaveLength(3);
    expect(calls[0].to).toBe(ENS.mockUsdc);      // mint
    expect(calls[1].to).toBe(ENS.mockUsdc);      // approve
    expect(calls[2].to).toBe(ENS.ethRegistrar);  // commit
    expect(calls[0].data.startsWith('0x40c10f19')).toBe(true); // mint(address,uint256)
    expect(calls[1].data.startsWith('0x095ea7b3')).toBe(true); // approve(address,uint256)
    expect(calls[2].data.startsWith('0xf14fcbc8')).toBe(true); // commit(bytes32)
  });

  it('approves the registrar, not the owner', () => {
    const calls = buildCommitCalls({
      ownerAddress: OWNER,
      commitment: '0x' + '44'.repeat(32),
      priceBase: 8_000_021n,
    });
    expect(calls[1].data.toLowerCase()).toContain(ENS.ethRegistrar.slice(2).toLowerCase());
  });

  it('mints exactly the price, so no stray balance is created', () => {
    const calls = buildCommitCalls({
      ownerAddress: OWNER,
      commitment: '0x' + '44'.repeat(32),
      priceBase: 8_000_021n,
    });
    // 8000021 = 0x7a1215
    expect(calls[0].data.endsWith('7a1215')).toBe(true);
  });
});

describe('buildRegisterCall', () => {
  it('calls the registrar with the eight-argument register', () => {
    const call = buildRegisterCall({
      label: 'unipaydemo',
      ownerAddress: OWNER,
      secret: SECRET,
      subregistry: SUBREGISTRY,
      priceBase: 8_000_021n,
    });
    expect(call.to).toBe(ENS.ethRegistrar);
    // register(string,address,bytes32,address,address,uint64,address,bytes32)
    expect(call.data.startsWith('0xcff3e7c2')).toBe(true);
    expect(call.data.toLowerCase()).toContain(SUBREGISTRY.slice(2).toLowerCase());
  });
});

describe('buildRecordsCall', () => {
  it('writes addr and four text records in one resolver multicall', () => {
    const call = buildRecordsCall({
      name: 'unipaydemo.eth',
      payoutAddress: OWNER,
      label: 'Unipay Demo',
    });
    expect(call.to).toBe(ENS.publicResolver);
    expect(call.data.startsWith('0xac9650d8')).toBe(true); // multicall(bytes[])
    // setAddr(bytes32,address) once, setText(bytes32,string,string) four times.
    expect(call.data.split('d5fa2b00').length - 1).toBe(1);
    expect(call.data.split('10f13a8c').length - 1).toBe(4);
  });
});

describe('saltForRegistration', () => {
  it('is deterministic, so a retry redeploys to the same address', () => {
    expect(saltForRegistration('reg_abc')).toBe(saltForRegistration('reg_abc'));
  });

  it('differs between registrations', () => {
    expect(saltForRegistration('reg_abc')).not.toBe(saltForRegistration('reg_def'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/ens/ens-calls.spec.ts`
Expected: FAIL — `Cannot find module './ens-calls'`

- [ ] **Step 3: Write the implementation**

```ts
// server/src/ens/ens-calls.ts
import {
  encodeFunctionData,
  keccak256,
  namehash,
  toHex,
  type Address,
  type Hex,
} from 'viem';
import {
  ALL_ROLES,
  ENS,
  NO_REFERRER,
  REGISTRATION_DURATION_SECS,
  SEPOLIA_CHAIN_ID,
} from '../config/ens';

/**
 * What every ENS endpoint hands the browser. The server builds these; it
 * never signs them. `value` is a decimal string because these cross the
 * wire as JSON and BigInt does not survive that trip.
 */
export interface UnsignedCall {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

const call = (to: string, data: Hex): UnsignedCall => ({
  to,
  data,
  value: '0',
  chainId: SEPOLIA_CHAIN_ID,
});

const FACTORY_ABI = [
  {
    type: 'function',
    name: 'deployProxy',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'implementation', type: 'address' },
      { name: 'salt', type: 'uint256' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const;

const USER_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'initialize',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'rootAccount', type: 'address' },
      { name: 'roleBitmap', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

const REGISTRAR_ABI = [
  {
    type: 'function',
    name: 'commit',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'commitment', type: 'bytes32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'secret', type: 'bytes32' },
      { name: 'subregistry', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'duration', type: 'uint64' },
      { name: 'paymentToken', type: 'address' },
      { name: 'referrer', type: 'bytes32' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const RESOLVER_ABI = [
  {
    type: 'function',
    name: 'setAddr',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'a', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setText',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'node', type: 'bytes32' },
      { name: 'key', type: 'string' },
      { name: 'value', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'multicall',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'data', type: 'bytes[]' }],
    outputs: [{ type: 'bytes[]' }],
  },
] as const;

/**
 * CREATE2 salt for the business's registry proxy.
 *
 * Derived from the registration id rather than randomly, so a retry after a
 * failed or lost deployment targets the same address instead of stranding
 * the previous one. The factory exposes no address predictor, so the
 * address itself is still only knowable from the ProxyDeployed event.
 */
export function saltForRegistration(registrationId: string): bigint {
  return BigInt(keccak256(toHex(registrationId)));
}

export function buildDeployRegistryCall(ownerAddress: string, salt: bigint): UnsignedCall {
  const initData = encodeFunctionData({
    abi: USER_REGISTRY_ABI,
    functionName: 'initialize',
    // The business is the root account of its own registry and holds every
    // role in it. Nothing here grants UniPay any authority over the name.
    args: [ownerAddress as Address, ALL_ROLES],
  });

  return call(
    ENS.verifiableFactory,
    encodeFunctionData({
      abi: FACTORY_ABI,
      functionName: 'deployProxy',
      args: [ENS.userRegistryImpl as Address, salt, initData],
    }),
  );
}

/**
 * Mint the fee, approve the registrar, commit. Batchable as one
 * wallet_sendCalls: none of the three needs a previous one's return value.
 *
 * MockUSDC is an open faucet on this testnet, so the mint costs nothing but
 * gas. Exactly the price is minted — leaving a stray balance behind would
 * be untidy and would mask a pricing bug.
 */
export function buildCommitCalls(input: {
  ownerAddress: string;
  commitment: string;
  priceBase: bigint;
}): UnsignedCall[] {
  return [
    call(
      ENS.mockUsdc,
      encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [input.ownerAddress as Address, input.priceBase],
      }),
    ),
    call(
      ENS.mockUsdc,
      encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [ENS.ethRegistrar as Address, input.priceBase],
      }),
    ),
    call(
      ENS.ethRegistrar,
      encodeFunctionData({
        abi: REGISTRAR_ABI,
        functionName: 'commit',
        args: [input.commitment as Hex],
      }),
    ),
  ];
}

export function buildRegisterCall(input: {
  label: string;
  ownerAddress: string;
  secret: string;
  subregistry: string;
  priceBase: bigint;
}): UnsignedCall {
  return call(
    ENS.ethRegistrar,
    encodeFunctionData({
      abi: REGISTRAR_ABI,
      functionName: 'register',
      args: [
        input.label,
        input.ownerAddress as Address,
        input.secret as Hex,
        input.subregistry as Address,
        ENS.publicResolver as Address,
        REGISTRATION_DURATION_SECS,
        ENS.mockUsdc as Address,
        NO_REFERRER,
      ],
    }),
  );
}

/**
 * Spec §3.5's five records, written as one resolver multicall.
 *
 * An address alone never implies a chain, so the destination chain and
 * asset are always explicit alongside it.
 */
export function buildRecordsCall(input: {
  name: string;
  payoutAddress: string;
  label: string;
}): UnsignedCall {
  const node = namehash(input.name);

  const texts: [string, string][] = [
    ['unipay.address', input.payoutAddress],
    ['unipay.chain', 'arc-testnet'],
    ['unipay.asset', 'USDC'],
    ['unipay.label', input.label],
  ];

  const inner: Hex[] = [
    encodeFunctionData({
      abi: RESOLVER_ABI,
      functionName: 'setAddr',
      args: [node, input.payoutAddress as Address],
    }),
    ...texts.map(([key, value]) =>
      encodeFunctionData({
        abi: RESOLVER_ABI,
        functionName: 'setText',
        args: [node, key, value],
      }),
    ),
  ];

  return call(
    ENS.publicResolver,
    encodeFunctionData({ abi: RESOLVER_ABI, functionName: 'multicall', args: [inner] }),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/ens/ens-calls.spec.ts`
Expected: PASS, 8 tests

If a selector assertion fails, do not change the assertion to match the code. Recompute the selector with `npx tsx -e "import {toFunctionSelector} from 'viem'; console.log(toFunctionSelector('mint(address,uint256)'))"` and fix whichever side is wrong.

- [ ] **Step 5: Commit**

```bash
git add server/src/ens/ens-calls.ts server/src/ens/ens-calls.spec.ts
git commit -m "feat(server): build the unsigned ENS registration calls"
```

---

### Task 4: Prisma model and Sepolia configuration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Modify: `server/src/config/configuration.ts`
- Modify: `server/.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma model `EnsRegistration` and enum `EnsStatus`; `AppConfig.sepoliaRpcUrl: string`.

- [ ] **Step 1: Add the model to the schema**

Append to `server/prisma/schema.prisma`:

```prisma
enum EnsStatus {
  DRAFT
  REGISTRY_DEPLOYED
  COMMITTED
  REGISTERED
  FAILED
}

model EnsRegistration {
  id             String    @id @default(cuid())
  businessId     String    @unique
  business       Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  label          String
  name           String
  status         EnsStatus @default(DRAFT)
  ownerAddress   String
  subregistry    String?
  resolver       String?
  priceBase      BigInt
  /// Envelope-encrypted commit secret (see EncryptionService). Never
  /// returned by an API response and never logged.
  secretEnvelope String
  deployTxHash   String?
  commitTxHash   String?
  /// Seconds since epoch, taken from the Sepolia BLOCK the commit landed
  /// in. Never a client or server clock — the registrar compares against
  /// block.timestamp, so anything else can disagree with the chain.
  committedAt    Int?
  registerTxHash String?
  recordsTxHash  String?
  durationSecs   Int
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
```

Add the back-relation to the existing `Business` model, immediately after `invoices  Invoice[]`:

```prisma
  ensRegistration EnsRegistration?
```

- [ ] **Step 2: Generate the migration**

```bash
cd server && npx prisma migrate dev --name add_ens_registration
```

Expected: a new folder under `server/prisma/migrations/`, and `prisma generate` runs automatically.

If no database is reachable, run `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` and report BLOCKED rather than inventing a migration by hand.

- [ ] **Step 3: Add the Sepolia RPC to configuration**

In `server/src/config/configuration.ts`, add to the `AppConfig` interface after `merchantTreasuryAddress`:

```ts
  sepoliaRpcUrl: string;
```

and to the returned object in `loadConfiguration`, after `merchantTreasuryAddress`:

```ts
    // ENS lives on Sepolia. Invoices and settlement stay on Arc; this URL
    // is only ever used for read calls and gas estimates against ENS.
    sepoliaRpcUrl: env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com',
```

- [ ] **Step 4: Document the variable**

Add to `server/.env.example`, after `MERCHANT_TREASURY_ADDRESS`:

```
SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
```

- [ ] **Step 5: Verify the build and existing tests**

Run: `cd server && npx tsc --noEmit && npm test`
Expected: compiles; all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add server/prisma server/src/config/configuration.ts server/.env.example
git commit -m "feat(server): add the EnsRegistration model and Sepolia config"
```

---

### Task 5: Sepolia read client

**Files:**
- Create: `server/src/ens/sepolia-rpc.client.ts`

**Interfaces:**
- Consumes: `ENS`, `REGISTRATION_DURATION_SECS`, `NO_REFERRER` from `../config/ens`; `loadConfiguration` from `../config/configuration`.
- Produces: `class SepoliaRpcClient` with
  - `isAvailable(label: string): Promise<boolean>`
  - `getRegisterPrice(label: string): Promise<bigint>` — returns `base + premium`
  - `makeCommitment(input: { label: string; owner: string; secret: string; subregistry: string }): Promise<string>`
  - `getBlockTimestamp(): Promise<number>`
  - `getTransactionBlockTimestamp(txHash: string): Promise<number>`
  - `getDeployedProxyAddress(txHash: string): Promise<string>`

- [ ] **Step 1: Write the implementation**

There is no unit test for this task: every method is a thin pass-through to viem against a live chain, and a test that mocks viem would assert only that the mock was called. Task 6 covers the logic that uses it, with this client mocked. Correctness here is verified by the manual check in Step 2.

```ts
// server/src/ens/sepolia-rpc.client.ts
import { Injectable } from '@nestjs/common';
import { createPublicClient, http, parseAbiItem, type Address, type Hex, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { ENS, NO_REFERRER, REGISTRATION_DURATION_SECS } from '../config/ens';
import { loadConfiguration } from '../config/configuration';

const PROXY_DEPLOYED = parseAbiItem(
  'event ProxyDeployed(address indexed sender, address indexed proxyAddress, uint256 salt, address implementation)',
);

const REGISTRAR_ABI = [
  {
    type: 'function',
    name: 'isAvailable',
    stateMutability: 'view',
    inputs: [{ name: 'label', type: 'string' }],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'getRegisterPrice',
    stateMutability: 'view',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'duration', type: 'uint64' },
      { name: 'paymentToken', type: 'address' },
    ],
    outputs: [
      { name: 'base', type: 'uint256' },
      { name: 'premium', type: 'uint256' },
    ],
  },
  {
    type: 'function',
    name: 'makeCommitment',
    stateMutability: 'pure',
    inputs: [
      { name: 'label', type: 'string' },
      { name: 'owner', type: 'address' },
      { name: 'secret', type: 'bytes32' },
      { name: 'subregistry', type: 'address' },
      { name: 'resolver', type: 'address' },
      { name: 'duration', type: 'uint64' },
      { name: 'referrer', type: 'bytes32' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
] as const;

/**
 * Read-only access to Sepolia for ENS. Mirrors ArcRpcClient's shape.
 *
 * Nothing here signs. The one method that could have been computed locally
 * — makeCommitment — is deliberately an eth_call against the registrar's
 * own pure function instead: a commitment hash we derive ourselves and the
 * registrar disagrees with produces a register that reverts sixty seconds
 * later, with no way to tell which side was wrong.
 */
@Injectable()
export class SepoliaRpcClient {
  private readonly client: PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(loadConfiguration().sepoliaRpcUrl),
  });

  isAvailable(label: string): Promise<boolean> {
    return this.client.readContract({
      address: ENS.ethRegistrar as Address,
      abi: REGISTRAR_ABI,
      functionName: 'isAvailable',
      args: [label],
    });
  }

  /**
   * Total cost in MockUSDC base units. Reverts NameNotAvailable for a taken
   * label, so callers must check isAvailable first.
   */
  async getRegisterPrice(label: string): Promise<bigint> {
    const [base, premium] = await this.client.readContract({
      address: ENS.ethRegistrar as Address,
      abi: REGISTRAR_ABI,
      functionName: 'getRegisterPrice',
      args: [label, REGISTRATION_DURATION_SECS, ENS.mockUsdc as Address],
    });
    return base + premium;
  }

  makeCommitment(input: {
    label: string;
    owner: string;
    secret: string;
    subregistry: string;
  }): Promise<string> {
    return this.client.readContract({
      address: ENS.ethRegistrar as Address,
      abi: REGISTRAR_ABI,
      functionName: 'makeCommitment',
      args: [
        input.label,
        input.owner as Address,
        input.secret as Hex,
        input.subregistry as Address,
        ENS.publicResolver as Address,
        REGISTRATION_DURATION_SECS,
        NO_REFERRER,
      ],
    });
  }

  async getBlockTimestamp(): Promise<number> {
    const block = await this.client.getBlock({ blockTag: 'latest' });
    return Number(block.timestamp);
  }

  /** The block timestamp of the block a transaction landed in. */
  async getTransactionBlockTimestamp(txHash: string): Promise<number> {
    const receipt = await this.client.getTransactionReceipt({ hash: txHash as Hex });
    const block = await this.client.getBlock({ blockNumber: receipt.blockNumber });
    return Number(block.timestamp);
  }

  /**
   * The proxy address from a deployProxy receipt.
   *
   * VerifiableFactory exposes no address predictor, so the event is the
   * only way to learn where the registry landed.
   */
  async getDeployedProxyAddress(txHash: string): Promise<string> {
    const receipt = await this.client.getTransactionReceipt({ hash: txHash as Hex });
    const logs = await this.client.getLogs({
      address: ENS.verifiableFactory as Address,
      event: PROXY_DEPLOYED,
      blockHash: receipt.blockHash,
    });

    const match = logs.find(
      (log) => log.transactionHash?.toLowerCase() === txHash.toLowerCase(),
    );
    if (!match?.args.proxyAddress) {
      throw new Error('No ProxyDeployed event found in that transaction');
    }
    return match.args.proxyAddress;
  }
}
```

- [ ] **Step 2: Verify against the live chain**

```bash
cd server && npx tsc --noEmit
```

Then confirm the reads work against Sepolia:

```bash
cd server && npx ts-node -e "
import { SepoliaRpcClient } from './src/ens/sepolia-rpc.client';
(async () => {
  const c = new SepoliaRpcClient();
  console.log('available(unipaydemo):', await c.isAvailable('unipaydemo'));
  console.log('price:', (await c.getRegisterPrice('unipaydemo')).toString());
  console.log('block ts:', await c.getBlockTimestamp());
})();
"
```

Expected: `available(unipaydemo): true`, a price near `8000021`, and a plausible Unix timestamp. If `unipaydemo` has been taken since this plan was written, try another label — a `false` here is not a failure of the code.

- [ ] **Step 3: Commit**

```bash
git add server/src/ens/sepolia-rpc.client.ts
git commit -m "feat(server): add the Sepolia read client for ENS"
```

---

### Task 6: EnsService

**Files:**
- Create: `server/src/ens/ens.service.ts`
- Test: `server/src/ens/ens.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `EncryptionService`, `SepoliaRpcClient`, `validateLabel`, `assessCommitment`, all four call builders, `saltForRegistration`.
- Produces: `class EnsService` with
  - `checkAvailability(label: string): Promise<{ label: string; available: boolean; priceBase: string | null }>`
  - `createRegistration(business: Business, label: string): Promise<RegistrationView & { calls: UnsignedCall[] }>`
  - `recordDeployment(businessId: string, txHash: string): Promise<RegistrationView & { calls: UnsignedCall[] }>`
  - `recordCommit(businessId: string, txHash: string): Promise<RegistrationView>`
  - `getRegistration(businessId: string): Promise<RegistrationView | null>`
  - `getRegisterCalls(businessId: string): Promise<RegistrationView & { calls: UnsignedCall[] }>`
  - `recordRegistered(businessId: string, txHash: string, recordsTxHash: string | null): Promise<RegistrationView>`
  - `interface RegistrationView` — the projection below, which **never** includes `secretEnvelope`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/ens/ens.service.spec.ts
import { EnsStatus } from '@prisma/client';
import { EnsService } from './ens.service';

const business = { id: 'biz_1', walletAddress: '0x1111111111111111111111111111111111111111' } as never;

function build(overrides: {
  registration?: Record<string, unknown> | null;
  blockNow?: number;
  committedAtBlock?: number;
} = {}) {
  const prisma = {
    ensRegistration: {
      findUnique: jest.fn().mockResolvedValue(overrides.registration ?? null),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'reg_1', ...data })),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ ...(overrides.registration ?? {}), ...data }),
      ),
    },
  };
  const encryption = {
    encrypt: jest.fn().mockReturnValue('v1.envelope'),
    decrypt: jest.fn().mockReturnValue('0x' + '22'.repeat(32)),
  };
  const rpc = {
    isAvailable: jest.fn().mockResolvedValue(true),
    getRegisterPrice: jest.fn().mockResolvedValue(8_000_021n),
    makeCommitment: jest.fn().mockResolvedValue('0x' + '44'.repeat(32)),
    getBlockTimestamp: jest.fn().mockResolvedValue(overrides.blockNow ?? 1_800_000_100),
    getTransactionBlockTimestamp: jest.fn().mockResolvedValue(overrides.committedAtBlock ?? 1_800_000_000),
    getDeployedProxyAddress: jest.fn().mockResolvedValue('0x3333333333333333333333333333333333333333'),
  };
  const service = new EnsService(prisma as never, encryption as never, rpc as never);
  return { service, prisma, encryption, rpc };
}

describe('checkAvailability', () => {
  it('reports a free label with its price', async () => {
    const { service } = build();
    await expect(service.checkAvailability('unipaydemo')).resolves.toEqual({
      label: 'unipaydemo',
      available: true,
      priceBase: '8000021',
    });
  });

  it('does not price a taken label', async () => {
    // getRegisterPrice reverts NameNotAvailable for a taken name, so it
    // must not be called at all.
    const { service, rpc } = build();
    rpc.isAvailable.mockResolvedValue(false);
    const result = await service.checkAvailability('acme');
    expect(result).toEqual({ label: 'acme', available: false, priceBase: null });
    expect(rpc.getRegisterPrice).not.toHaveBeenCalled();
  });

  it('rejects an invalid label before touching the chain', async () => {
    const { service, rpc } = build();
    await expect(service.checkAvailability('ab')).rejects.toThrow();
    expect(rpc.isAvailable).not.toHaveBeenCalled();
  });
});

describe('createRegistration', () => {
  it('encrypts the secret and never returns it', async () => {
    const { service, encryption } = build();
    const result = await service.createRegistration(business, 'unipaydemo');

    expect(encryption.encrypt).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain('v1.envelope');
    expect(result).not.toHaveProperty('secretEnvelope');
  });

  it('returns only the registry deployment call', async () => {
    // The subregistry address is not knowable until this lands, so mint,
    // approve and commit cannot be in the same batch.
    const { service } = build();
    const result = await service.createRegistration(business, 'unipaydemo');
    expect(result.calls).toHaveLength(1);
    expect(result.status).toBe(EnsStatus.DRAFT);
  });

  it('refuses a second registration for the same business', async () => {
    const { service } = build({ registration: { id: 'reg_1', status: EnsStatus.REGISTERED } });
    await expect(service.createRegistration(business, 'other')).rejects.toThrow(/already/i);
  });
});

describe('recordDeployment', () => {
  it('stores the proxy address and returns mint, approve and commit', async () => {
    const { service, prisma } = build({
      registration: {
        id: 'reg_1', businessId: 'biz_1', label: 'unipaydemo', name: 'unipaydemo.eth',
        status: EnsStatus.DRAFT, ownerAddress: business.walletAddress,
        priceBase: 8_000_021n, secretEnvelope: 'v1.envelope', durationSecs: 31_536_000,
      },
    });

    const result = await service.recordDeployment('biz_1', '0x' + 'ab'.repeat(32));

    expect(prisma.ensRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subregistry: '0x3333333333333333333333333333333333333333',
          status: EnsStatus.REGISTRY_DEPLOYED,
        }),
      }),
    );
    expect(result.calls).toHaveLength(3);
  });
});

describe('recordCommit', () => {
  it('takes committedAt from the block, not the request', async () => {
    const { service, prisma, rpc } = build({
      registration: {
        id: 'reg_1', status: EnsStatus.REGISTRY_DEPLOYED,
        subregistry: '0x3333333333333333333333333333333333333333',
      },
      committedAtBlock: 1_777_777_777,
    });

    await service.recordCommit('biz_1', '0x' + 'cd'.repeat(32));

    expect(rpc.getTransactionBlockTimestamp).toHaveBeenCalled();
    expect(prisma.ensRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ committedAt: 1_777_777_777 }) }),
    );
  });
});

describe('getRegisterCalls', () => {
  const committed = {
    id: 'reg_1', businessId: 'biz_1', label: 'unipaydemo', name: 'unipaydemo.eth',
    status: EnsStatus.COMMITTED, ownerAddress: business.walletAddress,
    subregistry: '0x3333333333333333333333333333333333333333',
    priceBase: 8_000_021n, secretEnvelope: 'v1.envelope',
    committedAt: 1_800_000_000, durationSecs: 31_536_000,
  };

  it('refuses before sixty seconds have passed on chain', async () => {
    const { service } = build({ registration: committed, blockNow: 1_800_000_030 });
    await expect(service.getRegisterCalls('biz_1')).rejects.toThrow(/not ready|wait/i);
  });

  it('returns register and records once ready', async () => {
    const { service } = build({ registration: committed, blockNow: 1_800_000_070 });
    const result = await service.getRegisterCalls('biz_1');
    expect(result.calls).toHaveLength(2);
  });

  it('refuses a commitment past MAX_COMMITMENT_AGE and marks it for re-commit', async () => {
    const { service, prisma } = build({ registration: committed, blockNow: 1_800_090_000 });
    await expect(service.getRegisterCalls('biz_1')).rejects.toThrow(/expired/i);
    // The name was never at risk; only the commitment died. The row goes
    // back to a state the merchant can restart from.
    expect(prisma.ensRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: EnsStatus.REGISTRY_DEPLOYED, committedAt: null }),
      }),
    );
  });

  it('decrypts the secret only when it is actually needed', async () => {
    const { service, encryption } = build({ registration: committed, blockNow: 1_800_000_030 });
    await expect(service.getRegisterCalls('biz_1')).rejects.toThrow();
    expect(encryption.decrypt).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/ens/ens.service.spec.ts`
Expected: FAIL — `Cannot find module './ens.service'`

- [ ] **Step 3: Write the implementation**

```ts
// server/src/ens/ens.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { EnsStatus, type Business, type EnsRegistration } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../crypto/encryption.service';
import { SepoliaRpcClient } from './sepolia-rpc.client';
import { validateLabel, InvalidLabelError } from './ens-label';
import { assessCommitment } from './commitment-window';
import { REGISTRATION_DURATION_SECS, ENS } from '../config/ens';
import {
  buildCommitCalls,
  buildDeployRegistryCall,
  buildRecordsCall,
  buildRegisterCall,
  saltForRegistration,
  type UnsignedCall,
} from './ens-calls';

/**
 * What the browser is allowed to see. The commit secret is deliberately
 * absent, and this projection is the only shape any ENS endpoint returns.
 */
export interface RegistrationView {
  id: string;
  label: string;
  name: string;
  status: EnsStatus;
  ownerAddress: string;
  subregistry: string | null;
  priceBase: string;
  readyAtSecs: number | null;
  expiresAtSecs: number | null;
  deployTxHash: string | null;
  commitTxHash: string | null;
  registerTxHash: string | null;
  recordsTxHash: string | null;
}

@Injectable()
export class EnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly rpc: SepoliaRpcClient,
  ) {}

  private view(row: EnsRegistration, blockNowSecs?: number): RegistrationView {
    const window =
      row.committedAt !== null ? assessCommitment(row.committedAt, blockNowSecs ?? 0) : null;

    return {
      id: row.id,
      label: row.label,
      name: row.name,
      status: row.status,
      ownerAddress: row.ownerAddress,
      subregistry: row.subregistry,
      priceBase: row.priceBase.toString(),
      readyAtSecs: window?.readyAtSecs ?? null,
      expiresAtSecs: window?.expiresAtSecs ?? null,
      deployTxHash: row.deployTxHash,
      commitTxHash: row.commitTxHash,
      registerTxHash: row.registerTxHash,
      recordsTxHash: row.recordsTxHash,
    };
  }

  private async require(businessId: string): Promise<EnsRegistration> {
    const row = await this.prisma.ensRegistration.findUnique({ where: { businessId } });
    if (!row) throw new NotFoundException('No ENS registration in progress');
    return row;
  }

  async checkAvailability(label: string) {
    try {
      validateLabel(label);
    } catch (cause) {
      if (cause instanceof InvalidLabelError) throw new BadRequestException(cause.message);
      throw cause;
    }

    const available = await this.rpc.isAvailable(label);
    // Pricing a taken label reverts NameNotAvailable, so this call is
    // gated rather than run alongside the availability check.
    const priceBase = available ? (await this.rpc.getRegisterPrice(label)).toString() : null;

    return { label, available, priceBase };
  }

  async createRegistration(business: Business, label: string) {
    try {
      validateLabel(label);
    } catch (cause) {
      if (cause instanceof InvalidLabelError) throw new BadRequestException(cause.message);
      throw cause;
    }

    const existing = await this.prisma.ensRegistration.findUnique({
      where: { businessId: business.id },
    });
    if (existing) {
      throw new ConflictException('This business already has an ENS registration');
    }

    if (!(await this.rpc.isAvailable(label))) {
      throw new ConflictException(`${label}.eth is already taken`);
    }
    const priceBase = await this.rpc.getRegisterPrice(label);

    // 32 random bytes, encrypted before they touch the database and never
    // returned to anyone. This is the one genuinely sensitive value the
    // feature persists.
    const secret = `0x${randomBytes(32).toString('hex')}`;

    const row = await this.prisma.ensRegistration.create({
      data: {
        businessId: business.id,
        label,
        name: `${label}.eth`,
        status: EnsStatus.DRAFT,
        ownerAddress: business.walletAddress,
        priceBase,
        secretEnvelope: this.encryption.encrypt(secret),
        durationSecs: Number(REGISTRATION_DURATION_SECS),
      },
    });

    return {
      ...this.view(row),
      calls: [buildDeployRegistryCall(business.walletAddress, saltForRegistration(row.id))],
    };
  }

  /**
   * Step 1 landed. Read the registry address out of the ProxyDeployed
   * event — the factory has no predictor, so this is the only source —
   * then hand back the batch that can now be built against it.
   */
  async recordDeployment(businessId: string, txHash: string) {
    const row = await this.require(businessId);
    const subregistry = await this.rpc.getDeployedProxyAddress(txHash);

    const commitment = await this.rpc.makeCommitment({
      label: row.label,
      owner: row.ownerAddress,
      secret: this.encryption.decrypt(row.secretEnvelope),
      subregistry,
    });

    const updated = await this.prisma.ensRegistration.update({
      where: { businessId },
      data: {
        subregistry,
        resolver: ENS.publicResolver,
        deployTxHash: txHash,
        status: EnsStatus.REGISTRY_DEPLOYED,
      },
    });

    return {
      ...this.view(updated),
      calls: buildCommitCalls({
        ownerAddress: row.ownerAddress,
        commitment,
        priceBase: row.priceBase,
      }),
    };
  }

  async recordCommit(businessId: string, txHash: string): Promise<RegistrationView> {
    const row = await this.require(businessId);

    // From the block, never from the request. The registrar compares
    // against block.timestamp, so any other clock can disagree with the
    // chain and let us offer a register call that then reverts.
    const committedAt = await this.rpc.getTransactionBlockTimestamp(txHash);

    const updated = await this.prisma.ensRegistration.update({
      where: { businessId },
      data: { commitTxHash: txHash, committedAt, status: EnsStatus.COMMITTED },
    });

    return this.view(updated, await this.rpc.getBlockTimestamp());
  }

  async getRegistration(businessId: string): Promise<RegistrationView | null> {
    const row = await this.prisma.ensRegistration.findUnique({ where: { businessId } });
    if (!row) return null;
    return this.view(row, await this.rpc.getBlockTimestamp());
  }

  async getRegisterCalls(businessId: string) {
    const row = await this.require(businessId);
    if (row.status !== EnsStatus.COMMITTED || row.committedAt === null || !row.subregistry) {
      throw new BadRequestException('This registration has no live commitment');
    }

    const blockNow = await this.rpc.getBlockTimestamp();
    const { state } = assessCommitment(row.committedAt, blockNow);

    if (state === 'expired') {
      // The name was never at risk — only the commitment died. Reset to
      // the last good state so the merchant can commit again.
      await this.prisma.ensRegistration.update({
        where: { businessId },
        data: { status: EnsStatus.REGISTRY_DEPLOYED, committedAt: null, commitTxHash: null },
      });
      throw new BadRequestException(
        'That commitment expired after 24 hours. Commit again to continue — the name is still yours to claim.',
      );
    }

    if (state === 'too-new') {
      throw new BadRequestException('The commitment is not ready yet. Wait for the countdown to finish.');
    }

    // Decrypted only here, only after the window check passed, and only
    // into the register call the browser is about to sign.
    const secret = this.encryption.decrypt(row.secretEnvelope);

    return {
      ...this.view(row, blockNow),
      calls: [
        buildRegisterCall({
          label: row.label,
          ownerAddress: row.ownerAddress,
          secret,
          subregistry: row.subregistry,
          priceBase: row.priceBase,
        }),
        buildRecordsCall({
          name: row.name,
          payoutAddress: row.ownerAddress,
          label: row.label,
        }),
      ],
    };
  }

  async recordRegistered(
    businessId: string,
    txHash: string,
    recordsTxHash: string | null,
  ): Promise<RegistrationView> {
    await this.require(businessId);
    const updated = await this.prisma.ensRegistration.update({
      where: { businessId },
      data: { registerTxHash: txHash, recordsTxHash, status: EnsStatus.REGISTERED },
    });
    return this.view(updated);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/ens/ens.service.spec.ts`
Expected: PASS, 12 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/ens/ens.service.ts server/src/ens/ens.service.spec.ts
git commit -m "feat(server): orchestrate ENS registration"
```

---

### Task 7: Controller, DTOs and module wiring

**Files:**
- Create: `server/src/ens/dto/create-registration.dto.ts`
- Create: `server/src/ens/dto/record-tx.dto.ts`
- Create: `server/src/ens/ens.controller.ts`
- Create: `server/src/ens/ens.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `EnsService`, `PrivyAuthGuard`, `CurrentBusiness`.
- Produces: routes `GET /ens/availability`, `POST /ens/registrations`, `GET /ens/registrations/me`, `POST /ens/registrations/me/deployed`, `POST /ens/registrations/me/committed`, `POST /ens/registrations/me/register-calls`, `POST /ens/registrations/me/registered`.

- [ ] **Step 1: Write the DTOs**

```ts
// server/src/ens/dto/create-registration.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRegistrationDto {
  // Shape only. The real rules live in validateLabel, which the service
  // applies — this keeps a 10 MB body from reaching it.
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  label!: string;
}
```

```ts
// server/src/ens/dto/record-tx.dto.ts
import { IsOptional, Matches } from 'class-validator';

const TX_HASH = /^0x[a-fA-F0-9]{64}$/;

export class RecordTxDto {
  @Matches(TX_HASH, { message: 'txHash must be a 32-byte hex hash' })
  txHash!: string;

  /** Present only when the records multicall was signed separately. */
  @IsOptional()
  @Matches(TX_HASH, { message: 'recordsTxHash must be a 32-byte hex hash' })
  recordsTxHash?: string;
}
```

- [ ] **Step 2: Write the controller**

```ts
// server/src/ens/ens.controller.ts
import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import type { Business } from '@prisma/client';
import { EnsService } from './ens.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RecordTxDto } from './dto/record-tx.dto';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { CurrentBusiness } from '../auth/current-business.decorator';

/**
 * Server-prepares / browser-signs throughout. Every response body is either
 * a RegistrationView or that view plus unsigned {to, data, value, chainId}
 * calls. No route returns signing material, and none ever will.
 *
 * A business has at most one registration, so the routes address it as
 * "me" rather than by id — there is no id a merchant could pass that would
 * reach another business's row.
 */
@Controller('ens')
@UseGuards(PrivyAuthGuard)
export class EnsController {
  constructor(private readonly ens: EnsService) {}

  @Get('availability')
  availability(@Query('label') label: string) {
    return this.ens.checkAvailability(label ?? '');
  }

  @Post('registrations')
  create(@CurrentBusiness() business: Business, @Body() dto: CreateRegistrationDto) {
    return this.ens.createRegistration(business, dto.label);
  }

  @Get('registrations/me')
  get(@CurrentBusiness() business: Business) {
    return this.ens.getRegistration(business.id);
  }

  @Post('registrations/me/deployed')
  deployed(@CurrentBusiness() business: Business, @Body() dto: RecordTxDto) {
    return this.ens.recordDeployment(business.id, dto.txHash);
  }

  @Post('registrations/me/committed')
  committed(@CurrentBusiness() business: Business, @Body() dto: RecordTxDto) {
    return this.ens.recordCommit(business.id, dto.txHash);
  }

  @Post('registrations/me/register-calls')
  registerCalls(@CurrentBusiness() business: Business) {
    return this.ens.getRegisterCalls(business.id);
  }

  @Post('registrations/me/registered')
  registered(@CurrentBusiness() business: Business, @Body() dto: RecordTxDto) {
    return this.ens.recordRegistered(business.id, dto.txHash, dto.recordsTxHash ?? null);
  }
}
```

- [ ] **Step 3: Wire the module**

```ts
// server/src/ens/ens.module.ts
import { Module } from '@nestjs/common';
import { EnsService } from './ens.service';
import { EnsController } from './ens.controller';
import { SepoliaRpcClient } from './sepolia-rpc.client';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EnsController],
  providers: [EnsService, SepoliaRpcClient],
  exports: [EnsService],
})
export class EnsModule {}
```

In `server/src/app.module.ts`, add the import beside the others:

```ts
import { EnsModule } from './ens/ens.module';
```

and add `EnsModule,` to the `imports` array, immediately after `InvoicesModule,`.

- [ ] **Step 4: Verify the app graph boots and every test passes**

Run: `cd server && npx tsc --noEmit && npm test && npm run lint`
Expected: compiles; all tests pass; lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/src/ens server/src/app.module.ts
git commit -m "feat(server): expose the ENS registration endpoints"
```

---

### Task 8: Business API client and Sepolia provider support

**Files:**
- Create: `business/lib/ens.ts`
- Modify: `business/app/providers.tsx`

**Interfaces:**
- Consumes: `useApi`'s `request` pattern from `business/lib/api.ts`.
- Produces:
  - `type EnsStatus = 'DRAFT' | 'REGISTRY_DEPLOYED' | 'COMMITTED' | 'REGISTERED' | 'FAILED'`
  - `interface UnsignedCall { to: string; data: string; value: string; chainId: number }`
  - `interface Registration { ... }` mirroring `RegistrationView`
  - `interface Availability { label: string; available: boolean; priceBase: string | null }`
  - `useEnsApi()` returning `checkAvailability`, `createRegistration`, `getRegistration`, `recordDeployed`, `recordCommitted`, `getRegisterCalls`, `recordRegistered`

- [ ] **Step 1: Add Sepolia to the Privy provider**

In `business/app/providers.tsx`, change the import:

```tsx
import { sepolia } from 'viem/chains';
import { arcTestnet } from '@/lib/chains';
```

and the config:

```tsx
        defaultChain: arcTestnet,
        // Sepolia is here only so a merchant can register an ENS name.
        // Invoices and settlement stay entirely on Arc — nothing in the
        // payment path touches Sepolia, and Arc stays the default chain.
        supportedChains: [arcTestnet, sepolia],
```

- [ ] **Step 2: Write the API client**

```tsx
// business/lib/ens.ts
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';
import { ApiError } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type EnsStatus = 'DRAFT' | 'REGISTRY_DEPLOYED' | 'COMMITTED' | 'REGISTERED' | 'FAILED';

/** An unsigned call the server prepared. The browser is what signs it. */
export interface UnsignedCall {
  to: string;
  data: string;
  value: string;
  chainId: number;
}

export interface Registration {
  id: string;
  label: string;
  name: string;
  status: EnsStatus;
  ownerAddress: string;
  subregistry: string | null;
  priceBase: string;
  readyAtSecs: number | null;
  expiresAtSecs: number | null;
  deployTxHash: string | null;
  commitTxHash: string | null;
  registerTxHash: string | null;
  recordsTxHash: string | null;
}

export interface Availability {
  label: string;
  available: boolean;
  priceBase: string | null;
}

type WithCalls = Registration & { calls: UnsignedCall[] };

export function useEnsApi() {
  const { getAccessToken } = usePrivy();

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
      const token = await getAccessToken();
      const response = await fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
      });
      if (!response.ok) throw new ApiError(response.status, await response.text());
      return response.json() as Promise<T>;
    },
    [getAccessToken],
  );

  return useMemo(
    () => ({
      checkAvailability: (label: string) =>
        request<Availability>(`/ens/availability?label=${encodeURIComponent(label)}`),

      createRegistration: (label: string) =>
        request<WithCalls>('/ens/registrations', {
          method: 'POST',
          body: JSON.stringify({ label }),
        }),

      getRegistration: () => request<Registration | null>('/ens/registrations/me'),

      recordDeployed: (txHash: string) =>
        request<WithCalls>('/ens/registrations/me/deployed', {
          method: 'POST',
          body: JSON.stringify({ txHash }),
        }),

      recordCommitted: (txHash: string) =>
        request<Registration>('/ens/registrations/me/committed', {
          method: 'POST',
          body: JSON.stringify({ txHash }),
        }),

      getRegisterCalls: () =>
        request<WithCalls>('/ens/registrations/me/register-calls', { method: 'POST' }),

      recordRegistered: (txHash: string, recordsTxHash?: string) =>
        request<Registration>('/ens/registrations/me/registered', {
          method: 'POST',
          body: JSON.stringify({ txHash, recordsTxHash }),
        }),
    }),
    [request],
  );
}
```

- [ ] **Step 3: Verify**

Run: `cd business && npx tsc --noEmit && npm run lint`
Expected: compiles, lint clean.

- [ ] **Step 4: Commit**

```bash
git add business/lib/ens.ts business/app/providers.tsx
git commit -m "feat(business): add the ENS API client and Sepolia support"
```

---

### Task 9: EIP-5792 batching with a sequential fallback

**Files:**
- Create: `business/lib/ens-batch.ts`
- Test: `business/lib/ens-batch.test.ts`

**Interfaces:**
- Consumes: `UnsignedCall` from `./ens`.
- Produces:
  - `supportsBatching(capabilities: unknown, chainId: number): boolean`
  - `type SendResult = { txHashes: string[] }`
  - `sendCalls(provider: Eip1193Provider, from: string, chainId: number, calls: UnsignedCall[]): Promise<SendResult>`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { supportsBatching } from './ens-batch';

const SEPOLIA = 11155111;
const HEX = '0xaa36a7'; // 11155111

describe('supportsBatching', () => {
  it('accepts a wallet that declares atomic support for the chain', () => {
    expect(supportsBatching({ [HEX]: { atomic: { status: 'supported' } } }, SEPOLIA)).toBe(true);
  });

  it('accepts "ready", which is atomic for a single batch', () => {
    expect(supportsBatching({ [HEX]: { atomic: { status: 'ready' } } }, SEPOLIA)).toBe(true);
  });

  it('rejects an unsupported status', () => {
    expect(supportsBatching({ [HEX]: { atomic: { status: 'unsupported' } } }, SEPOLIA)).toBe(false);
  });

  it('rejects capabilities for a different chain', () => {
    expect(supportsBatching({ '0x1': { atomic: { status: 'supported' } } }, SEPOLIA)).toBe(false);
  });

  it('rejects an empty capability set', () => {
    expect(supportsBatching({}, SEPOLIA)).toBe(false);
  });

  it('rejects undefined, which is what a wallet without the method gives us', () => {
    expect(supportsBatching(undefined, SEPOLIA)).toBe(false);
  });

  it('rejects a malformed response rather than throwing', () => {
    // Wallets are third-party code; a shape we did not expect must
    // degrade to the sequential path, never crash the page.
    expect(supportsBatching('nonsense', SEPOLIA)).toBe(false);
    expect(supportsBatching({ [HEX]: null }, SEPOLIA)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd business && npx vitest run lib/ens-batch.test.ts`
Expected: FAIL — cannot resolve `./ens-batch`

- [ ] **Step 3: Write the implementation**

```ts
// business/lib/ens-batch.ts
import type { UnsignedCall } from './ens';

/** The slice of EIP-1193 this module needs. */
export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

export interface SendResult {
  txHashes: string[];
}

/**
 * Whether this wallet will batch for this chain.
 *
 * Chain support for EIP-7702 is necessary but not sufficient: wallet_sendCalls
 * is a wallet capability, and Sepolia supporting 7702 says nothing about
 * whether the connected wallet implements EIP-5792. Both Arc and Sepolia
 * support 7702 (verified 2026-09-09), so this check is entirely about the
 * wallet.
 *
 * Anything unrecognised returns false. Wallets are third-party code and a
 * surprising shape must degrade to sequential signing, never throw.
 */
export function supportsBatching(capabilities: unknown, chainId: number): boolean {
  if (typeof capabilities !== 'object' || capabilities === null) return false;

  const key = `0x${chainId.toString(16)}`;
  const forChain = (capabilities as Record<string, unknown>)[key];
  if (typeof forChain !== 'object' || forChain === null) return false;

  const atomic = (forChain as Record<string, unknown>).atomic;
  if (typeof atomic !== 'object' || atomic === null) return false;

  const status = (atomic as Record<string, unknown>).status;
  return status === 'supported' || status === 'ready';
}

/**
 * Sends a group of prepared calls, batched into one signature where the
 * wallet allows it and signed one at a time where it does not.
 *
 * The sequential path is a live code path, not a contingency: most wallets
 * still do not implement EIP-5792, and a merchant on one of them must
 * still be able to register a name. Order is preserved either way, because
 * approve must precede commit and register must precede setting records.
 */
export async function sendCalls(
  provider: Eip1193Provider,
  from: string,
  chainId: number,
  calls: UnsignedCall[],
): Promise<SendResult> {
  if (calls.length === 0) return { txHashes: [] };

  let capabilities: unknown;
  try {
    capabilities = await provider.request({
      method: 'wallet_getCapabilities',
      params: [from],
    });
  } catch {
    // An unimplemented method rejects. That is a "no", not a failure.
    capabilities = undefined;
  }

  if (calls.length > 1 && supportsBatching(capabilities, chainId)) {
    const id = await provider.request({
      method: 'wallet_sendCalls',
      params: [
        {
          version: '2.0.0',
          chainId: `0x${chainId.toString(16)}`,
          from,
          atomicRequired: true,
          calls: calls.map((call) => ({ to: call.to, data: call.data, value: '0x0' })),
        },
      ],
    });

    const status = await waitForCallsStatus(provider, id);
    return { txHashes: status };
  }

  const txHashes: string[] = [];
  for (const call of calls) {
    const hash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [{ from, to: call.to, data: call.data, value: '0x0' }],
    })) as string;
    txHashes.push(hash);
  }
  return { txHashes };
}

/**
 * Polls wallet_getCallsStatus until the batch settles.
 *
 * This polls a wallet, not our own state machine — the constraint that
 * registration never runs on a timer is about our transitions, each of
 * which stays merchant-initiated.
 */
async function waitForCallsStatus(provider: Eip1193Provider, id: unknown): Promise<string[]> {
  const deadline = Date.now() + 120_000;

  while (Date.now() < deadline) {
    const result = (await provider.request({
      method: 'wallet_getCallsStatus',
      params: [id],
    })) as { status?: number | string; receipts?: { transactionHash: string }[] } | null;

    const status = result?.status;
    const settled = status === 200 || status === 'success' || status === 'CONFIRMED';
    if (settled && result?.receipts?.length) {
      return result.receipts.map((receipt) => receipt.transactionHash);
    }
    if (status === 500 || status === 'failure' || status === 'FAILED') {
      throw new Error('The wallet reported the batch failed');
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error('Timed out waiting for the wallet to confirm the batch');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd business && npx vitest run lib/ens-batch.test.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add business/lib/ens-batch.ts business/lib/ens-batch.test.ts
git commit -m "feat(business): batch ENS calls where the wallet allows it"
```

---

### Task 10: Identity page — claim form

**Files:**
- Create: `business/app/(merchant)/dashboard/identity/claim-form.tsx`
- Create: `business/app/(merchant)/dashboard/identity/page.tsx`
- Modify: `business/app/(merchant)/dashboard/nav.tsx`

**Interfaces:**
- Consumes: `useEnsApi`, `Registration`, `Availability` from `@/lib/ens`; `useBusiness` from `@/lib/business-context`; `formatUsdc` from `@/lib/format`.
- Produces: `<ClaimForm onClaimed={(registration: Registration) => void} />`; the `/dashboard/identity` route.

- [ ] **Step 1: Write the claim form**

```tsx
// business/app/(merchant)/dashboard/identity/claim-form.tsx
'use client';

import { useState } from 'react';
import { useEnsApi, type Availability, type Registration } from '@/lib/ens';
import { formatUsdc } from '@/lib/format';

/**
 * Searches for a name and starts a registration.
 *
 * The label is validated here as well as on the server, because
 * ETHRegistrar.isAvailable is not a validity check: it returns true for
 * labels the registrar then refuses to price. Checking locally means a
 * merchant never sees a green tick followed by a revert.
 */
function localLabelError(label: string): string | null {
  if (label.length < 3) return 'A name needs at least 3 characters';
  if (label.length > 63) return 'A name can be at most 63 characters';
  if (label !== label.toLowerCase()) return 'Use lowercase letters only';
  if (!/^[a-z0-9-]+$/.test(label)) return 'Use letters, digits and hyphens only';
  if (label.startsWith('-') || label.endsWith('-')) {
    return 'A name cannot start or end with a hyphen';
  }
  return null;
}

export function ClaimForm({ onClaimed }: { onClaimed: (registration: Registration) => void }) {
  const { checkAvailability, createRegistration } = useEnsApi();

  const [label, setLabel] = useState('');
  const [result, setResult] = useState<Availability | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const localError = label ? localLabelError(label) : null;

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);
    if (localError) return;

    setBusy(true);
    try {
      setResult(await checkAvailability(label));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setError(null);
    setBusy(true);
    try {
      onClaimed(await createRegistration(label));
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <div>
      <form onSubmit={search} className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center rounded-md border border-line bg-card px-3">
            <input
              value={label}
              onChange={(event) => {
                setLabel(event.target.value.trim());
                setResult(null);
              }}
              placeholder="yourbusiness"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-2.5 font-mono outline-none"
            />
            <span className="shrink-0 font-mono text-muted">.eth</span>
          </div>
          {localError && <p className="mt-2 text-red-600">{localError}</p>}
        </div>
        <button
          type="submit"
          disabled={busy || !label || !!localError}
          className="shrink-0 rounded-md border border-line px-4 py-2.5 font-medium hover:bg-stone-50 disabled:opacity-40"
        >
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>

      {result && (
        <div className="mt-4 rounded-lg border border-line bg-card p-5">
          {result.available ? (
            <>
              <p>
                <span className="font-mono font-medium">{result.label}.eth</span> is available.
              </p>
              {result.priceBase && (
                <p className="mt-1 text-muted">
                  <span className="font-mono">{formatUsdc(BigInt(result.priceBase))}</span> test
                  USDC for one year, minted for you from the ENS faucet.
                </p>
              )}
              <button
                onClick={claim}
                disabled={busy}
                className="mt-4 rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
              >
                {busy ? 'Starting…' : `Claim ${result.label}.eth`}
              </button>
            </>
          ) : (
            <p className="text-muted">
              <span className="font-mono text-ink">{result.label}.eth</span> is taken. Try another
              name.
            </p>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// business/app/(merchant)/dashboard/identity/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEnsApi, type Registration } from '@/lib/ens';
import { ClaimForm } from './claim-form';

export default function IdentityPage() {
  const { getRegistration } = useEnsApi();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRegistration(await getRegistration());
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [getRegistration]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-3xl px-8 py-10">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Identity</h1>
        <p className="mt-1 text-muted">
          An ENS name your customers can use instead of an address. Registered on Sepolia;
          invoices and settlement stay on Arc.
        </p>
      </header>

      {error && <p className="mt-6 text-red-600">{error}</p>}

      <section className="mt-8">
        {!loaded ? (
          <p className="text-muted">Loading…</p>
        ) : registration ? (
          <p className="rounded-lg border border-line bg-card p-5 font-mono">
            {registration.name} — {registration.status}
          </p>
        ) : (
          <ClaimForm onClaimed={setRegistration} />
        )}
      </section>
    </main>
  );
}
```

Task 11 replaces the placeholder in the `registration ?` branch with the real flow. Leave it exactly as written here so Task 11 has a known starting point.

- [ ] **Step 3: Enable the nav entry**

In `business/app/(merchant)/dashboard/nav.tsx`, change the Identity row in `PRIMARY` from

```tsx
  { href: '/dashboard/identity', label: 'Identity', soon: true },
```

to

```tsx
  { href: '/dashboard/identity', label: 'Identity' },
```

- [ ] **Step 4: Verify**

Run: `cd business && npx tsc --noEmit && npm test && npm run build`
Expected: compiles; 52 tests pass; build emits a `/dashboard/identity` route.

- [ ] **Step 5: Commit**

```bash
git add "business/app/(merchant)/dashboard/identity" "business/app/(merchant)/dashboard/nav.tsx"
git commit -m "feat(business): add the identity page and name search"
```

---

### Task 11: Registration flow

**Files:**
- Create: `business/app/(merchant)/dashboard/identity/registration-flow.tsx`
- Create: `business/app/(merchant)/dashboard/identity/identity-card.tsx`
- Modify: `business/app/(merchant)/dashboard/identity/page.tsx`

**Interfaces:**
- Consumes: `useEnsApi`, `Registration`, `UnsignedCall` from `@/lib/ens`; `sendCalls` from `@/lib/ens-batch`; `useWallets` from `@privy-io/react-auth`; `sepolia` from `viem/chains`.
- Produces: `<RegistrationFlow registration={...} onChange={(r: Registration) => void} />`; `<IdentityCard registration={...} />`.

- [ ] **Step 1: Write the registered-state card**

```tsx
// business/app/(merchant)/dashboard/identity/identity-card.tsx
'use client';

import type { Registration } from '@/lib/ens';

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

/**
 * The finished state. Records are shown explicitly because an address on
 * its own never implies a chain — a customer reading this name needs to
 * see that the payout lands as USDC on Arc.
 */
export function IdentityCard({ registration }: { registration: Registration }) {
  const records: [string, string][] = [
    ['addr', registration.ownerAddress],
    ['unipay.address', registration.ownerAddress],
    ['unipay.chain', 'arc-testnet'],
    ['unipay.asset', 'USDC'],
    ['unipay.label', registration.label],
  ];

  return (
    <div>
      <div className="rounded-lg border border-line bg-card p-6">
        <p className="text-[11px] uppercase tracking-wide text-muted">Your name</p>
        <p className="mt-2 font-mono text-2xl font-medium tracking-tight">{registration.name}</p>
        {registration.registerTxHash && (
          <a
            href={`${SEPOLIA_EXPLORER}/tx/${registration.registerTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block truncate font-mono text-[11px] text-accent hover:underline"
          >
            {registration.registerTxHash}
          </a>
        )}
      </div>

      <div className="mt-6 rounded-lg border border-line bg-card p-6">
        <p className="text-[11px] uppercase tracking-wide text-muted">Records</p>
        <dl className="mt-4 space-y-3">
          {records.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="shrink-0 font-mono text-muted">{key}</dt>
              <dd className="min-w-0 truncate font-mono">{value}</dd>
            </div>
          ))}
        </dl>
        {!registration.recordsTxHash && (
          <p className="mt-4 text-muted">
            Records were written in the same transaction as the registration.
          </p>
        )}
      </div>

      <p className="mt-6 text-muted">
        This name is registered on the ENSv2 Sepolia beta. Wallets that resolve mainnet ENS will
        not find it yet, so nothing in your payment flow depends on it.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write the flow**

```tsx
// business/app/(merchant)/dashboard/identity/registration-flow.tsx
'use client';

import { useWallets } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { sepolia } from 'viem/chains';
import { useEnsApi, type Registration, type UnsignedCall } from '@/lib/ens';
import { sendCalls } from '@/lib/ens-batch';

type StepKey = 'deploy' | 'commit' | 'register';

const STEPS: { key: StepKey; title: string; detail: string }[] = [
  { key: 'deploy', title: 'Create your registry', detail: 'One transaction on Sepolia.' },
  {
    key: 'commit',
    title: 'Reserve the name',
    detail: 'Mints the test fee, approves it, and commits. Then a sixty-second wait ENS requires.',
  },
  {
    key: 'register',
    title: 'Register and set records',
    detail: 'Claims the name and writes your payout records.',
  },
];

function currentStep(registration: Registration): StepKey {
  if (registration.status === 'DRAFT') return 'deploy';
  if (registration.status === 'REGISTRY_DEPLOYED') return 'commit';
  return 'register';
}

/** Seconds remaining until `target`, floored at zero. */
function useCountdown(targetSecs: number | null): number {
  const [remaining, setRemaining] = useState(() =>
    targetSecs === null ? 0 : Math.max(0, targetSecs - Math.floor(Date.now() / 1000)),
  );

  useEffect(() => {
    if (targetSecs === null) return;
    const tick = () =>
      setRemaining(Math.max(0, targetSecs - Math.floor(Date.now() / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetSecs]);

  return remaining;
}

export function RegistrationFlow({
  registration,
  onChange,
}: {
  registration: Registration;
  onChange: (registration: Registration) => void;
}) {
  const { wallets } = useWallets();
  const api = useEnsApi();

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const step = currentStep(registration);
  // The countdown runs off readyAtSecs, which the server derived from the
  // Sepolia BLOCK the commit landed in. It is a real deadline, not a
  // spinner — and the server re-checks it before it will hand over the
  // register call, so a fast local clock buys nothing.
  const remaining = useCountdown(step === 'register' ? registration.readyAtSecs : null);
  const wallet = wallets[0];

  async function run(
    label: string,
    calls: UnsignedCall[],
    then: (txHashes: string[]) => Promise<Registration>,
  ) {
    if (!wallet) {
      setError('Connect a wallet first.');
      return;
    }
    setError(null);
    setBusy(label);
    try {
      // ENS is on Sepolia. Arc remains the settlement chain and the
      // default; this switch is scoped to the registration.
      await wallet.switchChain(sepolia.id);
      const provider = await wallet.getEthereumProvider();
      const { txHashes } = await sendCalls(provider, wallet.address, sepolia.id, calls);
      onChange(await then(txHashes));
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(null);
    }
  }

  const deploy = () =>
    run('deploy', pendingCalls, async (txHashes) => {
      const next = await api.recordDeployed(txHashes[0]);
      setPendingCalls(next.calls);
      return next;
    });

  const commit = () =>
    run('commit', pendingCalls, async (txHashes) =>
      // The commit is the last call in the batch, so its hash is the one
      // the server needs to read a block timestamp from.
      api.recordCommitted(txHashes[txHashes.length - 1]),
    );

  const register = async () => {
    if (!wallet) {
      setError('Connect a wallet first.');
      return;
    }
    setError(null);
    setBusy('register');
    try {
      const prepared = await api.getRegisterCalls();
      await wallet.switchChain(sepolia.id);
      const provider = await wallet.getEthereumProvider();
      const { txHashes } = await sendCalls(
        provider,
        wallet.address,
        sepolia.id,
        prepared.calls,
      );
      onChange(await api.recordRegistered(txHashes[0], txHashes[1]));
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(null);
    }
  };

  const [pendingCalls, setPendingCalls] = useState<UnsignedCall[]>([]);

  return (
    <div>
      <div className="rounded-lg border border-line bg-card p-6">
        <p className="text-[11px] uppercase tracking-wide text-muted">Claiming</p>
        <p className="mt-2 font-mono text-2xl font-medium tracking-tight">{registration.name}</p>
      </div>

      <ol className="mt-6 space-y-3">
        {STEPS.map((entry, index) => {
          const done = STEPS.findIndex((s) => s.key === step) > index;
          const active = entry.key === step;

          return (
            <li
              key={entry.key}
              className={`rounded-lg border p-5 ${
                active ? 'border-accent bg-card' : 'border-line bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    done ? 'bg-emerald-500' : active ? 'bg-accent' : 'bg-stone-300'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className={done || active ? 'font-medium' : 'text-muted'}>{entry.title}</p>
                  <p className="mt-1 text-muted">{entry.detail}</p>

                  {active && entry.key === 'deploy' && (
                    <button
                      onClick={deploy}
                      disabled={busy !== null || pendingCalls.length === 0}
                      className="mt-4 rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                    >
                      {busy === 'deploy' ? 'Confirm in your wallet…' : 'Create registry'}
                    </button>
                  )}

                  {active && entry.key === 'commit' && (
                    <button
                      onClick={commit}
                      disabled={busy !== null || pendingCalls.length === 0}
                      className="mt-4 rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                    >
                      {busy === 'commit' ? 'Confirm in your wallet…' : 'Reserve the name'}
                    </button>
                  )}

                  {active && entry.key === 'register' && (
                    <>
                      {remaining > 0 ? (
                        <p className="mt-4 font-mono text-lg">
                          {remaining}s
                          <span className="ml-2 font-sans text-muted">
                            until ENS will accept the registration
                          </span>
                        </p>
                      ) : (
                        <button
                          onClick={register}
                          disabled={busy !== null}
                          className="mt-4 rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                        >
                          {busy === 'register'
                            ? 'Confirm in your wallet…'
                            : `Register ${registration.name}`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      <p className="mt-6 text-muted">
        Each step is one wallet signature if your wallet supports batching, and a few if it does
        not. You need Sepolia ETH for gas — the name itself is paid for with test USDC that ENS
        mints for you.
      </p>
    </div>
  );
}

/** Wallet rejections are the common case and deserve plain wording. */
function readableError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (/user rejected|denied|4001/i.test(message)) return 'You cancelled that step.';
  if (/insufficient funds/i.test(message)) {
    return 'That wallet has no Sepolia ETH for gas. Fund it from a Sepolia faucet and try again.';
  }
  return message;
}
```

**Note for the implementer:** the `pendingCalls` state above is declared after its first use, which TypeScript will reject. Move the `const [pendingCalls, setPendingCalls] = useState<UnsignedCall[]>([]);` declaration up so it sits immediately after the `busy`/`error` state declarations, and initialise it from the calls the page passes in — see Step 3, which threads them through as a prop.

- [ ] **Step 3: Thread the initial calls through the page**

Change `RegistrationFlow`'s props to include the calls that came back with the registration:

```tsx
export function RegistrationFlow({
  registration,
  initialCalls,
  onChange,
}: {
  registration: Registration;
  initialCalls: UnsignedCall[];
  onChange: (registration: Registration) => void;
}) {
```

and initialise the state from it, immediately after `const [error, setError] = useState<string | null>(null);`:

```tsx
  const [pendingCalls, setPendingCalls] = useState<UnsignedCall[]>(initialCalls);
```

Then replace the placeholder branch in `business/app/(merchant)/dashboard/identity/page.tsx`. Add the imports:

```tsx
import { RegistrationFlow } from './registration-flow';
import { IdentityCard } from './identity-card';
import type { UnsignedCall } from '@/lib/ens';
```

Add the state, beside the others:

```tsx
  const [calls, setCalls] = useState<UnsignedCall[]>([]);
```

Change the `ClaimForm` usage so it captures the calls that come back with the new registration:

```tsx
          <ClaimForm
            onClaimed={(created) => {
              setCalls(created.calls);
              setRegistration(created);
            }}
          />
```

and update `ClaimForm`'s prop type in `claim-form.tsx` so it passes the calls along:

```tsx
export function ClaimForm({
  onClaimed,
}: {
  onClaimed: (registration: Registration & { calls: UnsignedCall[] }) => void;
}) {
```

with `import { useEnsApi, type Availability, type Registration, type UnsignedCall } from '@/lib/ens';`.

Finally, replace the placeholder `<p>` branch with:

```tsx
        ) : registration ? (
          registration.status === 'REGISTERED' ? (
            <IdentityCard registration={registration} />
          ) : (
            <RegistrationFlow
              registration={registration}
              initialCalls={calls}
              onChange={setRegistration}
            />
          )
        ) : (
```

- [ ] **Step 4: Verify**

Run: `cd business && npx tsc --noEmit && npm test && npm run build`
Expected: compiles; 52 tests pass; build clean.

If `tsc` reports that `pendingCalls` is used before declaration, the Step 2 note was not applied — move the declaration up rather than reordering the functions.

- [ ] **Step 5: Commit**

```bash
git add "business/app/(merchant)/dashboard/identity"
git commit -m "feat(business): drive the three-signature ENS registration"
```

---

### Task 12: Resume a registration mid-flight

**Files:**
- Modify: `business/app/(merchant)/dashboard/identity/registration-flow.tsx`

**Interfaces:**
- Consumes: everything from Task 11.
- Produces: no new exports.

A merchant who closes the tab after deploying the registry comes back to a row in `REGISTRY_DEPLOYED` with `pendingCalls` empty, because those calls only ever existed in the previous page's memory. The buttons are disabled and the flow is stuck. This task fixes that.

- [ ] **Step 1: Reproduce the defect**

Run `cd business && npm run dev`, start a registration, complete the deploy step, then reload the page. The "Reserve the name" button is disabled with nothing explaining why.

- [ ] **Step 2: Re-fetch the calls when they are missing**

In `registration-flow.tsx`, add a "recover" action for the case where the flow resumes without calls in memory. Add it immediately after the `run` function:

```tsx
  /**
   * Rebuilds the calls for the current step.
   *
   * The unsigned calls live in page memory, not the database, so a reload
   * mid-registration arrives with none. Re-deriving them from the on-chain
   * deployment is cheap and keeps the flow resumable, which is the whole
   * point of persisting a row.
   *
   * Merchant-initiated, like every other transition here — nothing polls.
   */
  async function recoverCalls() {
    if (!registration.deployTxHash) return;
    setError(null);
    setBusy('recover');
    try {
      const next = await api.recordDeployed(registration.deployTxHash);
      setPendingCalls(next.calls);
      onChange(next);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setBusy(null);
    }
  }
```

- [ ] **Step 3: Offer it where the buttons would be dead**

Replace the commit-step button block with one that branches on whether calls are in hand:

```tsx
                  {active && entry.key === 'commit' && (
                    pendingCalls.length > 0 ? (
                      <button
                        onClick={commit}
                        disabled={busy !== null}
                        className="mt-4 rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
                      >
                        {busy === 'commit' ? 'Confirm in your wallet…' : 'Reserve the name'}
                      </button>
                    ) : (
                      <button
                        onClick={recoverCalls}
                        disabled={busy !== null}
                        className="mt-4 rounded-md border border-line px-4 py-2 font-medium hover:bg-stone-50 disabled:opacity-40"
                      >
                        {busy === 'recover' ? 'Picking up where you left off…' : 'Continue'}
                      </button>
                    )
                  )}
```

- [ ] **Step 4: Verify the fix**

Repeat Step 1's reproduction. Expected: after the reload, a "Continue" button appears; pressing it fetches the calls and the "Reserve the name" button becomes live.

Run: `cd business && npx tsc --noEmit && npm test && npm run build`
Expected: compiles; 52 tests pass; build clean.

- [ ] **Step 5: Commit**

```bash
git add "business/app/(merchant)/dashboard/identity/registration-flow.tsx"
git commit -m "fix(business): let a reloaded ENS registration continue"
```

---

## Self-Review

**1. Spec coverage.**

| Spec §3 requirement | Task |
|---|---|
| `EnsRegistration` model, envelope-encrypted secret | 4 (with the documented single-column deviation) |
| Six transactions, grouped as three signatures | 3, 9, 11 |
| EIP-5792 batching with a sequential fallback | 9 |
| `GET /ens/availability` — `isAvailable` + `getRegisterPrice` | 6, 7 |
| `POST /ens/registrations` — secret, encrypt, commitment, calls | 6, 7 |
| `committed` endpoint sets `committedAt` from the **block** | 6, 7 |
| `GET` registration with server-supplied `readyAt` | 6, 7 |
| `register-calls` re-checks the window server-side | 6 |
| `registered` marks `REGISTERED` | 6, 7 |
| Sixty-second window as a first-class countdown | 11 |
| Resumable flow | 12 |
| 24-hour commitment expiry with a re-commit branch | 2, 6 |
| Label validity checked independently of `isAvailable` | 1, 10 |
| §3.4 Privy gains Sepolia | 8 |
| §3.4 zero Sepolia gas balance stated plainly | 11 (`readableError`) |
| §3.5 five records via one resolver multicall | 3, 11 |
| ENS stays additive, never on the payment path | Global Constraints; 8, 11 |

No gaps.

**2. Placeholder scan.** No "TBD", no "handle errors appropriately", no "similar to Task N". Every code step carries the code. Task 5 has no unit test and says why, with a live verification step in its place.

**3. Type consistency.** `UnsignedCall` is defined once in Task 3 and re-declared structurally in Task 8 for the browser — same four fields, same types. `RegistrationView` (server, Task 6) and `Registration` (browser, Task 8) carry identical field names. `EnsStatus` has the same five members in Task 4's Prisma enum and Task 8's TypeScript union. `saltForRegistration` is produced in Task 3 and consumed in Task 6. `supportsBatching`/`sendCalls` are produced in Task 9 and consumed in Task 11. Task 11's `pendingCalls` ordering defect is called out in the task itself with the fix, and Task 12 depends on that state existing.

**One known rough edge, deliberately left in:** Task 11 writes `RegistrationFlow` with a state declaration below its first use, and the same task then instructs the implementer to move it. This is written as a two-step edit rather than a clean single listing because Step 3 changes the component's props at the same point — collapsing them would mean printing the whole component twice.
