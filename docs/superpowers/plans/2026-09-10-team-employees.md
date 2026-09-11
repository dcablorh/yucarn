# Team (Employees) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A merchant maintains a roster of employees — name, payout address, preferred chain and asset — that payroll can read.

**Architecture:** Plain CRUD. No chain interaction, no wallet, no signing. An `Employee` row belongs to exactly one business, and every route is scoped to the authenticated business. The preferred chain is validated against a CCTP domain table that Sub-project D will reuse, so payroll never has to guess whether a destination is reachable.

**Tech Stack:** NestJS 11 + Prisma 6 + Postgres (server), Next.js 16 App Router + React 19 (business), Jest, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-09-unipay-merchant-dashboard-design.md` §4

## Why this plan is half of Sub-project C

§4.2 is explicit: *"An employee can be added with only a name and an address. A subname is an optional enrichment on top. This is the load-bearing reason payroll survives an ENS failure."*

That sentence describes a seam, and this plan cuts along it. Employees are pure CRUD and are what payroll actually reads. Subname issuance is ENS work on top, and it is the part that can slip without costing Sub-project D. Splitting them means payroll — the largest remaining item, and the one §1.2 names most likely to be incomplete on demo day — stops waiting on ENS.

**Subname issuance is therefore NOT in this plan.** The Team table still shows a Subname column and a per-row "Issue subname" action, exactly as §4.4 requires — the action renders disabled with the explanation §4.4 asks for. A later plan wires it up. The `subnameLabel`, `subname` and `subnameTxHash` columns are created here so that later plan is a pure addition, and nothing in this plan writes them.

## Global Constraints

- **`client/` is off-limits.** No file under `client/` may be created, edited, or deleted. Another developer owns it. (`business/` is a different directory and is in scope.)
- **No user private keys, seed phrases, or recovery phrases** are ever stored, requested, logged, or transmitted — encrypted or otherwise.
- **The server never signs on a merchant's behalf.** Nothing in this plan touches a chain at all.
- **Every route is scoped to the authenticated business.** No endpoint accepts a business id from the request; an employee id from the path is always checked against the caller's business before it is used.
- **ENS is additive.** Every feature here works for a business with no ENS registration.
- **Invoices and settlement stay on Arc.** An employee's preferred chain is a *payroll destination*, not a settlement chain, and nothing in the invoice path reads it.
- Amounts, when they arrive in a later plan, are integer base units carried as strings and converted with `BigInt`. Never `Number`, never a float.
- Money and addresses render in `font-mono`, which carries `tabular-nums`.
- Design tokens are exactly the seven in `business/app/globals.css`: `ground`, `card`, `line`, `ink`, `muted`, `accent`, `accent-hover`.
- Do not push, merge, or create branches without explicit instruction.
- The untracked root file `Development .pdf` is the user's — never `git add` it.

## CCTP domain table

§5.6 fixes the destination set: testnets only, EVM only. Testnet chains reuse their mainnet CCTP domain id (confirmed against Circle's supported-chains documentation), and Arc's 26 already appears in `server/src/config/chains.ts` as `ARC_CCTP_DOMAIN`, which is the consistency check that this table is keyed the same way.

| Key | Label | CCTP domain | Chain id |
|---|---|---|---|
| `arc-testnet` | Arc Testnet | 26 | 5042002 |
| `ethereum-sepolia` | Ethereum Sepolia | 0 | 11155111 |
| `avalanche-fuji` | Avalanche Fuji | 1 | 43113 |
| `op-sepolia` | OP Sepolia | 2 | 11155420 |
| `arbitrum-sepolia` | Arbitrum Sepolia | 3 | 421614 |
| `base-sepolia` | Base Sepolia | 6 | 84532 |
| `polygon-amoy` | Polygon Amoy | 7 | 80002 |
| `unichain-sepolia` | Unichain Sepolia | 10 | 1301 |
| `linea-sepolia` | Linea Sepolia | 11 | 59141 |

**The domain numbers are not load-bearing in this plan** — nothing here burns or mints, and only the *keys* are used, for validating `prefChain`. They are written down now because payroll needs them and because a table with a placeholder invites someone to fill it in from memory later.

**Sub-project D must verify every domain on-chain before its first burn**, by reading `localDomain()` from each destination's `MessageTransmitter`. A wrong domain does not fail loudly — it mints on the wrong chain.

---

## File Structure

**Server — created**
- `server/src/config/payout-chains.ts` — the table above, plus lookup helpers
- `server/src/employees/employee-input.ts` — pure validation of name, address, chain, asset
- `server/src/employees/employee-input.spec.ts`
- `server/src/employees/employees.service.ts` — CRUD, business-scoped
- `server/src/employees/employees.service.spec.ts`
- `server/src/employees/employees.controller.ts`
- `server/src/employees/dto/create-employee.dto.ts`
- `server/src/employees/dto/update-employee.dto.ts`
- `server/src/employees/employees.module.ts`

**Server — modified**
- `server/prisma/schema.prisma` — `Employee` model, `Business.employees` back-relation
- `server/src/app.module.ts` — register `EmployeesModule`

**Business — created**
- `business/lib/employees.ts` — API client hooks and types
- `business/lib/payout-chains.ts` — the chain keys and labels the form and table render
- `business/app/(merchant)/dashboard/team/page.tsx` — route shell
- `business/app/(merchant)/dashboard/team/employee-table.tsx` — the roster
- `business/app/(merchant)/dashboard/team/employee-form.tsx` — add and edit

**Business — modified**
- `business/app/(merchant)/dashboard/nav.tsx` — Team stops being "Soon"

---

### Task 1: Payout chain table and employee validation

**Files:**
- Create: `server/src/config/payout-chains.ts`
- Create: `server/src/employees/employee-input.ts`
- Test: `server/src/employees/employee-input.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PAYOUT_CHAINS`, `isPayoutChain(key: string): boolean`, `payoutChain(key: string)`, `SUPPORTED_ASSETS`, `validateEmployeeInput(input): void`, `class InvalidEmployeeError extends Error`, `normaliseAddress(address: string): string`.

- [ ] **Step 1: Write the failing test**

```ts
// server/src/employees/employee-input.spec.ts
import {
  validateEmployeeInput,
  normaliseAddress,
  InvalidEmployeeError,
} from './employee-input';

const valid = {
  name: 'John Abiodun',
  walletAddress: '0x1111111111111111111111111111111111111111',
  prefChain: 'arc-testnet',
  prefAsset: 'USDC',
};

describe('validateEmployeeInput', () => {
  it('accepts a complete, valid employee', () => {
    expect(() => validateEmployeeInput(valid)).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => validateEmployeeInput({ ...valid, name: '   ' })).toThrow(
      InvalidEmployeeError,
    );
  });

  it('rejects a name longer than 120 characters', () => {
    expect(() => validateEmployeeInput({ ...valid, name: 'a'.repeat(121) })).toThrow(
      InvalidEmployeeError,
    );
  });

  it('rejects an address that is not 20 bytes of hex', () => {
    expect(() => validateEmployeeInput({ ...valid, walletAddress: '0xabc' })).toThrow(
      /address/i,
    );
  });

  it('rejects an address with no 0x prefix', () => {
    expect(() =>
      validateEmployeeInput({
        ...valid,
        walletAddress: '1111111111111111111111111111111111111111',
      }),
    ).toThrow(/address/i);
  });

  it('rejects the zero address, which is a burn, not a payee', () => {
    expect(() =>
      validateEmployeeInput({
        ...valid,
        walletAddress: '0x0000000000000000000000000000000000000000',
      }),
    ).toThrow(/address/i);
  });

  it('rejects a chain outside the CCTP table', () => {
    expect(() => validateEmployeeInput({ ...valid, prefChain: 'solana' })).toThrow(
      /chain/i,
    );
  });

  it('rejects an unsupported asset', () => {
    expect(() => validateEmployeeInput({ ...valid, prefAsset: 'DAI' })).toThrow(
      /USDC/,
    );
  });

  it('accepts every chain in the table', () => {
    for (const key of [
      'arc-testnet',
      'ethereum-sepolia',
      'avalanche-fuji',
      'op-sepolia',
      'arbitrum-sepolia',
      'base-sepolia',
      'polygon-amoy',
      'unichain-sepolia',
      'linea-sepolia',
    ]) {
      expect(() => validateEmployeeInput({ ...valid, prefChain: key })).not.toThrow();
    }
  });
});

describe('normaliseAddress', () => {
  it('lowercases so two spellings of one address compare equal', () => {
    // Employees are matched against on-chain events later. Storing mixed
    // case would make a string comparison miss.
    expect(normaliseAddress('0xAbCdEf1111111111111111111111111111111111')).toBe(
      '0xabcdef1111111111111111111111111111111111',
    );
  });

  it('leaves an already-lowercase address alone', () => {
    expect(normaliseAddress('0x1111111111111111111111111111111111111111')).toBe(
      '0x1111111111111111111111111111111111111111',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/employees/employee-input.spec.ts`
Expected: FAIL — `Cannot find module './employee-input'`

- [ ] **Step 3: Write the chain table**

```ts
// server/src/config/payout-chains.ts

/**
 * Where payroll can send USDC.
 *
 * Testnets only and EVM only, per spec §5.6: funding is Arc testnet, so
 * every destination must be a testnet too. A CCTP testnet reuses its
 * mainnet domain id, which is why these numbers look like mainnet's.
 *
 * Arc's domain 26 agrees with ARC_CCTP_DOMAIN in ./chains.ts — that
 * agreement is the check that this table is keyed the same way the
 * settlement path already is.
 *
 * NOTHING IN THIS PLAN USES `domain`. Payroll does, and payroll must
 * verify every one of these against the destination's MessageTransmitter
 * `localDomain()` before its first burn. A wrong domain mints on the
 * wrong chain, silently.
 */
export interface PayoutChain {
  key: string;
  label: string;
  domain: number;
  chainId: number;
}

export const PAYOUT_CHAINS: readonly PayoutChain[] = [
  { key: 'arc-testnet', label: 'Arc Testnet', domain: 26, chainId: 5042002 },
  { key: 'ethereum-sepolia', label: 'Ethereum Sepolia', domain: 0, chainId: 11155111 },
  { key: 'avalanche-fuji', label: 'Avalanche Fuji', domain: 1, chainId: 43113 },
  { key: 'op-sepolia', label: 'OP Sepolia', domain: 2, chainId: 11155420 },
  { key: 'arbitrum-sepolia', label: 'Arbitrum Sepolia', domain: 3, chainId: 421614 },
  { key: 'base-sepolia', label: 'Base Sepolia', domain: 6, chainId: 84532 },
  { key: 'polygon-amoy', label: 'Polygon Amoy', domain: 7, chainId: 80002 },
  { key: 'unichain-sepolia', label: 'Unichain Sepolia', domain: 10, chainId: 1301 },
  { key: 'linea-sepolia', label: 'Linea Sepolia', domain: 11, chainId: 59141 },
] as const;

/** The only asset UniPay moves. */
export const SUPPORTED_ASSETS = ['USDC'] as const;

export function payoutChain(key: string): PayoutChain | undefined {
  return PAYOUT_CHAINS.find((chain) => chain.key === key);
}

export function isPayoutChain(key: string): boolean {
  return payoutChain(key) !== undefined;
}
```

- [ ] **Step 4: Write the validator**

```ts
// server/src/employees/employee-input.ts
import { isPayoutChain, SUPPORTED_ASSETS } from '../config/payout-chains';

export const EMPLOYEE_NAME_MAX = 120;

export class InvalidEmployeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmployeeError';
  }
}

export interface EmployeeInput {
  name: string;
  walletAddress: string;
  prefChain: string;
  prefAsset: string;
}

/**
 * Lowercases an address.
 *
 * Payroll matches employees against on-chain events, and an EVM address has
 * two equally valid spellings — checksummed and lowercase. Storing whichever
 * the merchant happened to paste would make a later string comparison miss
 * an employee who is genuinely there.
 */
export function normaliseAddress(address: string): string {
  return address.toLowerCase();
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

export function validateEmployeeInput(input: EmployeeInput): void {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new InvalidEmployeeError('Enter the employee’s name');
  }
  if (name.length > EMPLOYEE_NAME_MAX) {
    throw new InvalidEmployeeError(
      `A name can be at most ${EMPLOYEE_NAME_MAX} characters`,
    );
  }

  if (!ADDRESS.test(input.walletAddress)) {
    throw new InvalidEmployeeError(
      'Enter a wallet address as 0x followed by 40 hex characters',
    );
  }
  if (normaliseAddress(input.walletAddress) === ZERO) {
    // Paying the zero address burns the money. No employee is there.
    throw new InvalidEmployeeError('That address cannot receive a payment');
  }

  if (!isPayoutChain(input.prefChain)) {
    throw new InvalidEmployeeError('Choose a chain UniPay can pay out on');
  }

  if (!SUPPORTED_ASSETS.includes(input.prefAsset as (typeof SUPPORTED_ASSETS)[number])) {
    throw new InvalidEmployeeError('UniPay pays in USDC');
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd server && npx jest src/employees/employee-input.spec.ts`
Expected: PASS, 11 tests

- [ ] **Step 6: Commit**

```bash
git add server/src/config/payout-chains.ts server/src/employees/employee-input.ts server/src/employees/employee-input.spec.ts
git commit -m "feat(server): add the payout chain table and employee validation"
```

---

### Task 2: Employee model and migration

**Files:**
- Modify: `server/prisma/schema.prisma`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma model `Employee`; `Business.employees` back-relation.

- [ ] **Step 1: Add the model**

Append to `server/prisma/schema.prisma`:

```prisma
model Employee {
  id            String   @id @default(cuid())
  businessId    String
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  name          String
  /// Stored lowercase. Payroll matches this against on-chain events, and an
  /// EVM address has two valid spellings — see normaliseAddress.
  walletAddress String
  /// Written by a later plan. Nothing in the Team plan sets these.
  subnameLabel  String?
  subname       String?
  subnameTxHash String?
  prefChain     String   @default("arc-testnet")
  prefAsset     String   @default("USDC")
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([businessId, subnameLabel])
  @@index([businessId])
}
```

Add the back-relation to the existing `Business` model, immediately after `ensRegistration EnsRegistration?`:

```prisma
  employees       Employee[]
```

- [ ] **Step 2: Generate the migration**

```bash
cd server && npx prisma migrate dev --name add_employee
```

Expected: a new folder under `server/prisma/migrations/`, and `prisma generate` runs automatically.

Postgres is reachable; if it is not, report BLOCKED rather than hand-writing a migration.

- [ ] **Step 3: Check the unique constraint's null behaviour**

`@@unique([businessId, subnameLabel])` comes from spec §4.1. In Postgres, `NULL` values are distinct in a unique index, so many employees per business may have a `NULL` `subnameLabel` — which is exactly what this plan needs, since it never sets one. Confirm the generated SQL creates a plain unique index and does not add a `NOT NULL`:

```bash
cd server && grep -A2 -i "unique" prisma/migrations/*add_employee/migration.sql
```

Expected: a `CREATE UNIQUE INDEX` on `("businessId", "subnameLabel")`, with `subnameLabel` nullable in the `CREATE TABLE` above it.

- [ ] **Step 4: Verify the build and existing tests**

Run: `cd server && npx tsc --noEmit && npm test`
Expected: compiles; every existing test still passes.

- [ ] **Step 5: Commit**

```bash
git add server/prisma
git commit -m "feat(server): add the Employee model"
```

---

### Task 3: EmployeesService

**Files:**
- Create: `server/src/employees/employees.service.ts`
- Test: `server/src/employees/employees.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`; `validateEmployeeInput`, `normaliseAddress`, `InvalidEmployeeError` from `./employee-input`.
- Produces: `class EmployeesService` with
  - `list(businessId: string): Promise<Employee[]>`
  - `create(businessId: string, input: EmployeeInput): Promise<Employee>`
  - `update(businessId: string, id: string, input: EmployeeInput): Promise<Employee>`
  - `remove(businessId: string, id: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// server/src/employees/employees.service.spec.ts
import { EmployeesService } from './employees.service';

const input = {
  name: 'John Abiodun',
  walletAddress: '0xAbCdEf1111111111111111111111111111111111',
  prefChain: 'base-sepolia',
  prefAsset: 'USDC',
};

function build(existing: Record<string, unknown> | null = null) {
  const prisma = {
    employee: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(existing),
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'emp_1', ...data }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'emp_1', ...data }),
      ),
      delete: jest.fn().mockResolvedValue({ id: 'emp_1' }),
    },
  };
  return { service: new EmployeesService(prisma as never), prisma };
}

describe('create', () => {
  it('stores the address lowercased', async () => {
    const { service, prisma } = build();
    await service.create('biz_1', input);
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletAddress: '0xabcdef1111111111111111111111111111111111',
        }),
      }),
    );
  });

  it('trims the name', async () => {
    const { service, prisma } = build();
    await service.create('biz_1', { ...input, name: '  John Abiodun  ' });
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'John Abiodun' }),
      }),
    );
  });

  it('binds the employee to the calling business', async () => {
    const { service, prisma } = build();
    await service.create('biz_1', input);
    expect(prisma.employee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ businessId: 'biz_1' }),
      }),
    );
  });

  it('rejects invalid input before touching the database', async () => {
    const { service, prisma } = build();
    await expect(service.create('biz_1', { ...input, walletAddress: '0xabc' })).rejects.toThrow();
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  it('never writes subname fields', async () => {
    // Subname issuance is a later plan. If this ever starts writing them,
    // that plan's migration assumptions break.
    const { service, prisma } = build();
    await service.create('biz_1', input);
    const { data } = prisma.employee.create.mock.calls[0][0];
    expect(data).not.toHaveProperty('subname');
    expect(data).not.toHaveProperty('subnameLabel');
    expect(data).not.toHaveProperty('subnameTxHash');
  });
});

describe('update', () => {
  it('refuses an employee belonging to another business', async () => {
    // findFirst returns null because the {id, businessId} pair does not match.
    const { service, prisma } = build(null);
    await expect(service.update('biz_1', 'emp_other', input)).rejects.toThrow();
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  it('scopes its ownership lookup by business, not by id alone', async () => {
    const { service, prisma } = build({ id: 'emp_1', businessId: 'biz_1' });
    await service.update('biz_1', 'emp_1', input);
    expect(prisma.employee.findFirst).toHaveBeenCalledWith({
      where: { id: 'emp_1', businessId: 'biz_1' },
    });
  });

  it('applies the same normalisation as create', async () => {
    const { service, prisma } = build({ id: 'emp_1', businessId: 'biz_1' });
    await service.update('biz_1', 'emp_1', input);
    expect(prisma.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          walletAddress: '0xabcdef1111111111111111111111111111111111',
        }),
      }),
    );
  });
});

describe('remove', () => {
  it('refuses an employee belonging to another business', async () => {
    const { service, prisma } = build(null);
    await expect(service.remove('biz_1', 'emp_other')).rejects.toThrow();
    expect(prisma.employee.delete).not.toHaveBeenCalled();
  });

  it('deletes one owned employee', async () => {
    const { service, prisma } = build({ id: 'emp_1', businessId: 'biz_1' });
    await service.remove('biz_1', 'emp_1');
    expect(prisma.employee.delete).toHaveBeenCalledWith({ where: { id: 'emp_1' } });
  });
});

describe('list', () => {
  it('lists only the calling business’s employees, oldest first', async () => {
    const { service, prisma } = build();
    await service.list('biz_1');
    expect(prisma.employee.findMany).toHaveBeenCalledWith({
      where: { businessId: 'biz_1' },
      orderBy: { createdAt: 'asc' },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/employees/employees.service.spec.ts`
Expected: FAIL — `Cannot find module './employees.service'`

- [ ] **Step 3: Write the implementation**

```ts
// server/src/employees/employees.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Employee } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvalidEmployeeError,
  normaliseAddress,
  validateEmployeeInput,
  type EmployeeInput,
} from './employee-input';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Every mutating method starts here.
   *
   * The lookup is by {id, businessId} rather than by id alone, so an
   * employee id belonging to another business simply does not resolve.
   * That is the whole tenancy story for this service — there is no path
   * that reads an employee without also naming whose it must be.
   */
  private async requireOwned(businessId: string, id: string): Promise<Employee> {
    const employee = await this.prisma.employee.findFirst({
      where: { id, businessId },
    });
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  private clean(input: EmployeeInput) {
    try {
      validateEmployeeInput(input);
    } catch (cause) {
      if (cause instanceof InvalidEmployeeError) {
        throw new BadRequestException(cause.message);
      }
      throw cause;
    }

    return {
      name: input.name.trim(),
      walletAddress: normaliseAddress(input.walletAddress),
      prefChain: input.prefChain,
      prefAsset: input.prefAsset,
    };
  }

  list(businessId: string): Promise<Employee[]> {
    return this.prisma.employee.findMany({
      where: { businessId },
      orderBy: { createdAt: 'asc' },
    });
  }

  create(businessId: string, input: EmployeeInput): Promise<Employee> {
    return this.prisma.employee.create({
      data: { businessId, ...this.clean(input) },
    });
  }

  async update(businessId: string, id: string, input: EmployeeInput): Promise<Employee> {
    await this.requireOwned(businessId, id);
    return this.prisma.employee.update({
      where: { id },
      data: this.clean(input),
    });
  }

  async remove(businessId: string, id: string): Promise<void> {
    await this.requireOwned(businessId, id);
    await this.prisma.employee.delete({ where: { id } });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd server && npx jest src/employees/employees.service.spec.ts`
Expected: PASS, 11 tests

- [ ] **Step 5: Commit**

```bash
git add server/src/employees/employees.service.ts server/src/employees/employees.service.spec.ts
git commit -m "feat(server): add business-scoped employee CRUD"
```

---

### Task 4: Controller, DTOs and module wiring

**Files:**
- Create: `server/src/employees/dto/create-employee.dto.ts`
- Create: `server/src/employees/dto/update-employee.dto.ts`
- Create: `server/src/employees/employees.controller.ts`
- Create: `server/src/employees/employees.module.ts`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `EmployeesService`, `PrivyAuthGuard`, `CurrentBusiness`.
- Produces: routes `GET /employees`, `POST /employees`, `PATCH /employees/:id`, `DELETE /employees/:id`.

- [ ] **Step 1: Write the DTOs**

```ts
// server/src/employees/dto/create-employee.dto.ts
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Shape only. The real rules live in validateEmployeeInput, which the
 * service applies — this keeps an oversized body from reaching it.
 */
export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(42)
  @MaxLength(42)
  walletAddress!: string;

  @IsString()
  @MaxLength(40)
  prefChain!: string;

  @IsString()
  @MaxLength(16)
  prefAsset!: string;
}
```

```ts
// server/src/employees/dto/update-employee.dto.ts
import { CreateEmployeeDto } from './create-employee.dto';

/**
 * A full replacement, not a patch. The Team form always submits every
 * field, and a partial update would need per-field merge rules that
 * nothing asks for.
 */
export class UpdateEmployeeDto extends CreateEmployeeDto {}
```

- [ ] **Step 2: Write the controller**

```ts
// server/src/employees/employees.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { Business, Employee } from '@prisma/client';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { CurrentBusiness } from '../auth/current-business.decorator';

/**
 * An employee id does appear in the path here, unlike the ENS routes.
 * That is safe because the service resolves it as {id, businessId} — an
 * id belonging to another business does not resolve, so there is nothing
 * a merchant can name that reaches someone else's roster.
 */
@Controller('employees')
@UseGuards(PrivyAuthGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  list(@CurrentBusiness() business: Business): Promise<Employee[]> {
    return this.employees.list(business.id);
  }

  @Post()
  create(
    @CurrentBusiness() business: Business,
    @Body() dto: CreateEmployeeDto,
  ): Promise<Employee> {
    return this.employees.create(business.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentBusiness() business: Business,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ): Promise<Employee> {
    return this.employees.update(business.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentBusiness() business: Business,
    @Param('id') id: string,
  ): Promise<void> {
    return this.employees.remove(business.id, id);
  }
}
```

- [ ] **Step 3: Wire the module**

```ts
// server/src/employees/employees.module.ts
import { Module } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { EmployeesController } from './employees.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
```

In `server/src/app.module.ts`, add the import beside the others:

```ts
import { EmployeesModule } from './employees/employees.module';
```

and add `EmployeesModule,` to the `imports` array, immediately after `EnsModule,`.

- [ ] **Step 4: Verify the app graph boots and every test passes**

Run: `cd server && npx tsc --noEmit && npm test`
Expected: compiles; all tests pass.

- [ ] **Step 5: Commit**

```bash
git add server/src/employees server/src/app.module.ts
git commit -m "feat(server): expose the employee routes"
```

---

### Task 5: Business API client and chain list

**Files:**
- Create: `business/lib/payout-chains.ts`
- Create: `business/lib/employees.ts`

**Interfaces:**
- Consumes: `ApiError` from `business/lib/api.ts`.
- Produces:
  - `PAYOUT_CHAINS`, `payoutChainLabel(key: string): string`
  - `interface Employee`, `interface EmployeeInput`
  - `useEmployeesApi()` returning `list`, `create`, `update`, `remove`

- [ ] **Step 1: Write the chain list**

```ts
// business/lib/payout-chains.ts

/**
 * Mirrors server/src/config/payout-chains.ts. Only the key and label are
 * here — the CCTP domain is a server concern and the browser has no use
 * for it.
 *
 * If the server's table gains a chain, this one has to gain it too; the
 * server rejects anything it does not know, so the failure is a clear
 * 400 rather than a silent mismatch.
 */
export const PAYOUT_CHAINS = [
  { key: 'arc-testnet', label: 'Arc Testnet' },
  { key: 'ethereum-sepolia', label: 'Ethereum Sepolia' },
  { key: 'avalanche-fuji', label: 'Avalanche Fuji' },
  { key: 'op-sepolia', label: 'OP Sepolia' },
  { key: 'arbitrum-sepolia', label: 'Arbitrum Sepolia' },
  { key: 'base-sepolia', label: 'Base Sepolia' },
  { key: 'polygon-amoy', label: 'Polygon Amoy' },
  { key: 'unichain-sepolia', label: 'Unichain Sepolia' },
  { key: 'linea-sepolia', label: 'Linea Sepolia' },
] as const;

export function payoutChainLabel(key: string): string {
  return PAYOUT_CHAINS.find((chain) => chain.key === key)?.label ?? key;
}
```

- [ ] **Step 2: Write the API client**

```tsx
// business/lib/employees.ts
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useMemo } from 'react';
import { ApiError } from './api';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface Employee {
  id: string;
  name: string;
  walletAddress: string;
  subname: string | null;
  prefChain: string;
  prefAsset: string;
  createdAt: string;
}

export interface EmployeeInput {
  name: string;
  walletAddress: string;
  prefChain: string;
  prefAsset: string;
}

export function useEmployeesApi() {
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

      // DELETE answers 204 with no body; parsing that throws.
      const body = await response.text();
      return (body ? JSON.parse(body) : null) as T;
    },
    [getAccessToken],
  );

  return useMemo(
    () => ({
      list: () => request<Employee[]>('/employees'),

      create: (input: EmployeeInput) =>
        request<Employee>('/employees', {
          method: 'POST',
          body: JSON.stringify(input),
        }),

      update: (id: string, input: EmployeeInput) =>
        request<Employee>(`/employees/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        }),

      remove: (id: string) =>
        request<null>(`/employees/${id}`, { method: 'DELETE' }),
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
git add business/lib/payout-chains.ts business/lib/employees.ts
git commit -m "feat(business): add the employees API client"
```

---

### Task 6: Team page and roster table

**Files:**
- Create: `business/app/(merchant)/dashboard/team/employee-table.tsx`
- Create: `business/app/(merchant)/dashboard/team/page.tsx`
- Modify: `business/app/(merchant)/dashboard/nav.tsx`

**Interfaces:**
- Consumes: `useEmployeesApi`, `Employee` from `@/lib/employees`; `payoutChainLabel` from `@/lib/payout-chains`.
- Produces: `<EmployeeTable employees onEdit onRemove hasEnsName />`; the `/dashboard/team` route.

- [ ] **Step 1: Write the table**

```tsx
// business/app/(merchant)/dashboard/team/employee-table.tsx
'use client';

import { useState } from 'react';
import type { Employee } from '@/lib/employees';
import { payoutChainLabel } from '@/lib/payout-chains';

/** 0x1234…abcd — enough to recognise a wallet in a dense row. */
function shortenAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}

export function EmployeeTable({
  employees,
  hasEnsName,
  onEdit,
  onRemove,
}: {
  employees: Employee[];
  hasEnsName: boolean;
  onEdit: (employee: Employee) => void;
  onRemove: (employee: Employee) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-card">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Wallet</th>
            <th className="px-4 py-3 font-medium">Subname</th>
            <th className="px-4 py-3 font-medium">Pays on</th>
            <th className="px-4 py-3 font-medium">Asset</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr
              key={employee.id}
              className="h-11 border-b border-line last:border-0 hover:bg-stone-50"
            >
              <td className="px-4 font-medium">{employee.name}</td>
              <td className="px-4 font-mono text-[11px] text-muted">
                {shortenAddress(employee.walletAddress)}
              </td>
              <td className="px-4">
                {employee.subname ? (
                  <span className="font-mono">{employee.subname}</span>
                ) : (
                  // Issuing subnames is a later plan. The control is shown
                  // rather than hidden so the roster reads as finished, and
                  // it says plainly why it cannot be used yet.
                  <span
                    className="text-muted"
                    title={
                      hasEnsName
                        ? 'Subname issuing is not available yet'
                        : 'Register an ENS name on the Identity page first'
                    }
                  >
                    —
                  </span>
                )}
              </td>
              <td className="px-4 whitespace-nowrap">{payoutChainLabel(employee.prefChain)}</td>
              <td className="px-4">{employee.prefAsset}</td>
              <td className="px-4 whitespace-nowrap text-right">
                <button
                  onClick={() => onEdit(employee)}
                  className="text-muted hover:text-ink"
                >
                  Edit
                </button>
                {confirming === employee.id ? (
                  <>
                    <button
                      onClick={() => {
                        setConfirming(null);
                        onRemove(employee);
                      }}
                      className="ml-3 font-medium text-red-600 hover:underline"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="ml-3 text-muted hover:text-ink"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirming(employee.id)}
                    className="ml-3 text-muted hover:text-ink"
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// business/app/(merchant)/dashboard/team/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEmployeesApi, type Employee } from '@/lib/employees';
import { EmployeeTable } from './employee-table';

export default function TeamPage() {
  const api = useEmployeesApi();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setEmployees(await api.list());
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoaded(true);
    }
  }, [api]);

  useEffect(() => {
    // Async: every setState lands after an await, never synchronously here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function remove(employee: Employee) {
    setError(null);
    try {
      await api.remove(employee.id);
      setEmployees((current) => current.filter((row) => row.id !== employee.id));
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-8 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Team</h1>
          <p className="mt-1 text-muted">
            Everyone payroll can pay, and where they want to be paid.
          </p>
        </div>
      </header>

      {error && <p className="mt-6 text-red-600">{error}</p>}

      <section className="mt-8">
        {!loaded ? (
          <p className="text-muted">Loading your team…</p>
        ) : employees.length === 0 ? (
          <div className="rounded-lg border border-line bg-card px-6 py-12 text-center">
            <p className="font-medium">No one on the team yet</p>
            <p className="mt-1 text-muted">
              Add someone with a name and a wallet address. An ENS subname is optional.
            </p>
          </div>
        ) : (
          <EmployeeTable
            employees={employees}
            hasEnsName={false}
            onEdit={() => {}}
            onRemove={remove}
          />
        )}
      </section>
    </main>
  );
}
```

Task 7 replaces the `onEdit={() => {}}` no-op and adds the add-employee form. Leave it exactly as written here so Task 7 has a known starting point.

- [ ] **Step 3: Enable the nav entry**

In `business/app/(merchant)/dashboard/nav.tsx`, change the Team row in `PRIMARY` from

```tsx
  { href: '/dashboard/team', label: 'Team', soon: true },
```

to

```tsx
  { href: '/dashboard/team', label: 'Team' },
```

- [ ] **Step 4: Verify**

Run: `cd business && npx tsc --noEmit && npm test && npm run lint && npm run build`
Expected: compiles; the existing 68 tests still pass; build emits a `/dashboard/team` route.

- [ ] **Step 5: Commit**

```bash
git add "business/app/(merchant)/dashboard/team" "business/app/(merchant)/dashboard/nav.tsx"
git commit -m "feat(business): add the team roster page"
```

---

### Task 7: Add and edit an employee

**Files:**
- Create: `business/app/(merchant)/dashboard/team/employee-form.tsx`
- Modify: `business/app/(merchant)/dashboard/team/page.tsx`

**Interfaces:**
- Consumes: `EmployeeInput`, `Employee` from `@/lib/employees`; `PAYOUT_CHAINS` from `@/lib/payout-chains`.
- Produces: `<EmployeeForm initial busy error onSubmit onCancel />`.

- [ ] **Step 1: Write the form**

```tsx
// business/app/(merchant)/dashboard/team/employee-form.tsx
'use client';

import { useState } from 'react';
import type { Employee, EmployeeInput } from '@/lib/employees';
import { PAYOUT_CHAINS } from '@/lib/payout-chains';

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

/**
 * Mirrors validateEmployeeInput on the server. Duplicated deliberately:
 * a merchant pasting a truncated address should be told before a round
 * trip, and the server still refuses the same input if this is bypassed.
 */
function localError(input: EmployeeInput): string | null {
  if (input.name.trim().length === 0) return 'Enter a name';
  if (input.name.trim().length > 120) return 'That name is too long';
  if (!ADDRESS.test(input.walletAddress)) {
    return 'A wallet address is 0x followed by 40 hex characters';
  }
  if (input.walletAddress.toLowerCase() === ZERO) {
    return 'That address cannot receive a payment';
  }
  return null;
}

export function EmployeeForm({
  initial,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial?: Employee;
  busy: boolean;
  error: string | null;
  onSubmit: (input: EmployeeInput) => void;
  onCancel: () => void;
}) {
  const [input, setInput] = useState<EmployeeInput>({
    name: initial?.name ?? '',
    walletAddress: initial?.walletAddress ?? '',
    prefChain: initial?.prefChain ?? 'arc-testnet',
    prefAsset: initial?.prefAsset ?? 'USDC',
  });
  const [touched, setTouched] = useState(false);

  const invalid = localError(input);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!invalid) onSubmit(input);
      }}
      className="rounded-lg border border-line bg-card p-6"
    >
      <h2 className="font-medium">{initial ? 'Edit employee' : 'Add someone to the team'}</h2>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">Name</span>
          <input
            value={input.name}
            onChange={(event) => setInput({ ...input, name: event.target.value })}
            maxLength={120}
            placeholder="John Abiodun"
            className="rounded-md border border-line px-3 py-2.5"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">
            Wallet address
          </span>
          <input
            value={input.walletAddress}
            onChange={(event) =>
              setInput({ ...input, walletAddress: event.target.value.trim() })
            }
            placeholder="0x…"
            autoComplete="off"
            className="rounded-md border border-line px-3 py-2.5 font-mono text-[11px]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">Pays on</span>
          <select
            value={input.prefChain}
            onChange={(event) => setInput({ ...input, prefChain: event.target.value })}
            className="rounded-md border border-line bg-card px-3 py-2.5"
          >
            {PAYOUT_CHAINS.map((chain) => (
              <option key={chain.key} value={chain.key}>
                {chain.label}
              </option>
            ))}
          </select>
          <span className="text-muted">
            Where this person receives USDC. It does not affect how you are paid.
          </span>
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted">Asset</span>
          <input
            value={input.prefAsset}
            readOnly
            className="rounded-md border border-line bg-ground px-3 py-2.5 text-muted"
          />
        </label>
      </div>

      {touched && invalid && <p className="mt-4 text-red-600">{invalid}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}

      <div className="mt-6 flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        >
          {busy ? 'Saving…' : initial ? 'Save changes' : 'Add to team'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 text-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 2: Wire the page**

In `business/app/(merchant)/dashboard/team/page.tsx`, add the imports:

```tsx
import { EmployeeForm } from './employee-form';
import type { EmployeeInput } from '@/lib/employees';
```

Add state beside the others:

```tsx
  // null = closed; 'new' = adding; an Employee = editing that person.
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
```

Add the submit handler beside `remove`:

```tsx
  async function submit(input: EmployeeInput) {
    setFormError(null);
    setBusy(true);
    try {
      if (editing === 'new') {
        const created = await api.create(input);
        setEmployees((current) => [...current, created]);
      } else if (editing) {
        const updated = await api.update(editing.id, input);
        setEmployees((current) =>
          current.map((row) => (row.id === updated.id ? updated : row)),
        );
      }
      setEditing(null);
    } catch (cause) {
      setFormError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }
```

Add an "Add employee" button to the header, after the `<div>` holding the title:

```tsx
        {!editing && (
          <button
            onClick={() => {
              setFormError(null);
              setEditing('new');
            }}
            className="rounded-md bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover"
          >
            Add employee
          </button>
        )}
```

Render the form above the roster, immediately inside `<section className="mt-8">`:

```tsx
        {editing && (
          <div className="mb-6">
            <EmployeeForm
              // Remounts when the target changes, so the fields reset to
              // the person being edited rather than keeping the last one's.
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? undefined : editing}
              busy={busy}
              error={formError}
              onSubmit={submit}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
```

Replace the empty-state block's closing so the table's `onEdit` is real:

```tsx
          <EmployeeTable
            employees={employees}
            hasEnsName={false}
            onEdit={(employee) => {
              setFormError(null);
              setEditing(employee);
            }}
            onRemove={remove}
          />
```

Finally, change the empty-state branch so it does not hide the form — the condition becomes `employees.length === 0 && !editing`.

- [ ] **Step 3: Verify**

Run: `cd business && npx tsc --noEmit && npm test && npm run lint && npm run build`
Expected: compiles; the existing 68 tests still pass; build clean.

- [ ] **Step 4: Manual check**

With `npm run dev` and the server running, confirm: adding a person appends a row; editing one pre-fills the form with that person's values and updates the row in place; editing a second person after the first shows the second person's values, not the first's; removing asks for confirmation and drops the row.

If the form shows stale values when switching between two employees, the `key` prop in Step 2 was omitted.

- [ ] **Step 5: Commit**

```bash
git add "business/app/(merchant)/dashboard/team"
git commit -m "feat(business): add and edit team members"
```

---

## Self-Review

**1. Spec coverage.**

| Spec §4 requirement | Task |
|---|---|
| `Employee` model with all fields from §4.1 | 2 |
| `@@unique([businessId, subnameLabel])` | 2 (with its null-behaviour check) |
| §4.2 an employee needs only a name and an address | 1, 3, 7 |
| §4.2 per-employee preferred chain and asset | 1, 2, 7 |
| §4.4 table of name, address, subname, chain, asset | 6 |
| §4.4 add-employee form | 7 |
| §4.4 per-row subname action, disabled with an explanation | 6 |
| §4.3 subname issuance | **Deliberately deferred to a later plan** — see "Why this plan is half of Sub-project C" |
| §5.6 destination chain set | 1 |

The one intentional gap is §4.3, argued for at the top of this document rather than silently dropped.

**2. Placeholder scan.** No "TBD", no "handle errors appropriately", no "similar to Task N". Every code step carries its code. Tasks 6 and 7 have no unit tests because this project has no component-test harness; both say so and substitute build gates plus, for Task 7, a specific manual check with the symptom to look for.

**3. Type consistency.** `EmployeeInput` has the same four fields on both sides (server `employee-input.ts`, browser `employees.ts`). `Employee` on the browser is a subset of the Prisma model, omitting `businessId`, `subnameLabel`, `subnameTxHash` and `updatedAt`, none of which the UI renders. `PAYOUT_CHAINS` keys are identical in `server/src/config/payout-chains.ts` and `business/lib/payout-chains.ts` — nine entries, same order; the server rejects any key it does not know, so a divergence fails as a 400 rather than silently. `payoutChainLabel` is produced in Task 5 and consumed in Task 6. `EmployeeTable`'s props are fixed in Task 6 and Task 7 supplies a real `onEdit` for the no-op left there.

**One known rough edge:** Task 6 ships `hasEnsName={false}` hardcoded, so the subname column's tooltip always reads as though no ENS name is registered. Wiring it to the real registration is a one-line change that belongs with the subname plan, which is the only thing that makes the distinction actionable.
