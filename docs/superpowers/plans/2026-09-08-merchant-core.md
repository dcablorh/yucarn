# UniPay Merchant Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A business can log in, create an invoice, share it as a link or QR code, and see it marked Paid once USDC lands on Arc.

**Architecture:** A NestJS + Prisma + Postgres API owns invoices and settlement. A Next.js dashboard authenticates with Privy and talks to that API over HTTP. A scheduled watcher polls Arc for USDC `Transfer` events and is the only thing that may mark an invoice `PAID`. Each open invoice is assigned a unique sub-cent amount nonce so an incoming transfer maps to exactly one invoice.

**Tech Stack:** NestJS 11, Prisma 6 + PostgreSQL, viem, `@privy-io/server-auth`, `@privy-io/react-auth`, Next.js 16.3.4 + React 19, Tailwind v4, Jest 30.

**Spec:** `docs/superpowers/specs/2026-09-08-unipay-business-side-design.md`

## Global Constraints

- **`client/` MUST NOT be modified.** Another developer owns it. No file under `client/` is created, edited, or deleted by this plan.
- **No monorepo tooling.** `business/` and `server/` stay independent npm projects with their own lockfiles. Do not add a root `package.json` or workspaces.
- **No user private keys, seed phrases, or recovery phrases** are ever stored, requested, logged, or transmitted — encrypted or otherwise.
- **The server never signs on a user's behalf** in this plan. It prepares data; the browser signs.
- All sensitive persisted values use envelope encryption at rest (Task 2) and are never returned by an API or written to a log.
- **Amounts are integer base units** (`bigint`, 6-decimal micro-USDC). Never floats, never `number`.
- Arc testnet: chain ID `5042002`, RPC `https://rpc.testnet.arc.network`, USDC ERC-20 `0x3600000000000000000000000000000000000000` (6 decimals), CCTP domain `26`.
- Only the watcher (Task 9) may set status `PAID`.
- Run all server commands from `server/`, all dashboard commands from `business/`.

---

## File Structure

**`server/`**

| Path | Responsibility |
|---|---|
| `prisma/schema.prisma` | Business, Invoice, WatcherCursor models |
| `src/config/configuration.ts` | Typed env loading + fail-fast validation |
| `src/config/chains.ts` | Arc chain + USDC constants |
| `src/prisma/prisma.service.ts` | Prisma lifecycle |
| `src/crypto/encryption.service.ts` | Envelope encryption (AES-256-GCM) |
| `src/auth/privy.service.ts` | Privy token verification |
| `src/auth/privy-auth.guard.ts` | Route guard + business provisioning |
| `src/auth/current-business.decorator.ts` | `@CurrentBusiness()` param decorator |
| `src/invoices/invoice-state.ts` | Pure status transition rules |
| `src/invoices/amount-nonce.service.ts` | Nonce allocation and release |
| `src/invoices/invoices.service.ts` | Invoice orchestration |
| `src/invoices/invoices.controller.ts` | Authenticated invoice routes |
| `src/invoices/public-invoices.controller.ts` | Unauthenticated invoice + callback routes |
| `src/watcher/transfer-matcher.ts` | Pure transfer→invoice matching |
| `src/watcher/arc-watcher.service.ts` | Scheduled Arc log polling |

**`business/`**

| Path | Responsibility |
|---|---|
| `app/providers.tsx` | Privy client provider |
| `app/page.tsx` | Landing / login (modify) |
| `app/layout.tsx` | Wrap in providers (modify) |
| `app/dashboard/page.tsx` | Invoice list |
| `app/dashboard/invoices/new/page.tsx` | Create invoice form |
| `app/i/[id]/page.tsx` | Public invoice page + QR |
| `lib/api.ts` | Typed fetch client |
| `lib/format.ts` | Base-unit ↔ display conversion |

---

## Task 1: Server foundation — config, Prisma, health

**Files:**
- Create: `server/prisma/schema.prisma`, `server/src/config/configuration.ts`, `server/src/config/chains.ts`, `server/src/prisma/prisma.service.ts`, `server/src/prisma/prisma.module.ts`, `server/.env.example`
- Modify: `server/src/app.module.ts`, `server/src/main.ts`
- Test: `server/src/config/configuration.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `loadConfiguration(env: NodeJS.ProcessEnv): AppConfig`; `PrismaService` (injectable, extends `PrismaClient`); constants `ARC_CHAIN_ID`, `ARC_RPC_URL`, `ARC_USDC_ADDRESS`, `USDC_DECIMALS`

- [ ] **Step 1: Install dependencies**

```bash
cd server
npm install @nestjs/config @nestjs/schedule @prisma/client class-validator class-transformer viem nanoid
npm install -D prisma
```

- [ ] **Step 2: Write the failing test**

Create `server/src/config/configuration.spec.ts`:

```typescript
import { loadConfiguration } from './configuration';

const validEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/unipay',
  ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'),
  PRIVY_APP_ID: 'app-id',
  PRIVY_APP_SECRET: 'app-secret',
  MERCHANT_TREASURY_ADDRESS: '0x127c1A164b00639FAA338E38F3150b12D313420A',
};

describe('loadConfiguration', () => {
  it('returns typed config when every required variable is present', () => {
    const config = loadConfiguration(validEnv as NodeJS.ProcessEnv);
    expect(config.databaseUrl).toBe('postgresql://localhost:5432/unipay');
    expect(config.privy.appId).toBe('app-id');
  });

  it('throws naming the variable when one is missing', () => {
    const { PRIVY_APP_SECRET, ...incomplete } = validEnv;
    expect(() => loadConfiguration(incomplete as NodeJS.ProcessEnv)).toThrow(
      /PRIVY_APP_SECRET/,
    );
  });

  it('rejects a master key that is not 32 bytes', () => {
    const badEnv = { ...validEnv, ENCRYPTION_MASTER_KEY: Buffer.alloc(16).toString('base64') };
    expect(() => loadConfiguration(badEnv as NodeJS.ProcessEnv)).toThrow(/32 bytes/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx jest src/config/configuration.spec.ts`
Expected: FAIL — cannot find module `./configuration`

- [ ] **Step 4: Write the implementation**

Create `server/src/config/configuration.ts`:

```typescript
export interface AppConfig {
  databaseUrl: string;
  encryptionMasterKey: Buffer;
  privy: { appId: string; appSecret: string };
  merchantTreasuryAddress: string;
  port: number;
  corsOrigins: string[];
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const masterKey = Buffer.from(required(env, 'ENCRYPTION_MASTER_KEY'), 'base64');
  if (masterKey.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must decode to exactly 32 bytes');
  }

  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    encryptionMasterKey: masterKey,
    privy: {
      appId: required(env, 'PRIVY_APP_ID'),
      appSecret: required(env, 'PRIVY_APP_SECRET'),
    },
    merchantTreasuryAddress: required(env, 'MERCHANT_TREASURY_ADDRESS'),
    port: Number(env.PORT ?? 3001),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
  };
}
```

Create `server/src/config/chains.ts`:

```typescript
export const ARC_CHAIN_ID = 5042002;
export const ARC_CHAIN_KEY = 'arc-testnet';
export const ARC_RPC_URL = 'https://rpc.testnet.arc.network';
export const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';
export const ARC_CCTP_DOMAIN = 26;

/** Arc's USDC ERC-20 view. Native gas is the same funds at 18 decimals. */
export const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;
export const USDC_DECIMALS = 6;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest src/config/configuration.spec.ts`
Expected: PASS, 3 tests

- [ ] **Step 6: Create the Prisma schema**

Create `server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Business {
  id            String    @id @default(cuid())
  privyUserId   String    @unique
  walletAddress String
  name          String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  invoices      Invoice[]

  @@index([walletAddress])
}

enum InvoiceStatus {
  PENDING
  PROCESSING
  PAID
  EXPIRED
  UNDERPAID
  FAILED
}

model Invoice {
  id           String        @id
  businessId   String
  business     Business      @relation(fields: [businessId], references: [id], onDelete: Cascade)
  amountBase   BigInt
  nonce        Int
  activeNonce  Int?
  payableBase  BigInt
  destChain    String        @default("arc-testnet")
  asset        String        @default("USDC")
  recipient    String
  description  String?
  status       InvoiceStatus @default(PENDING)
  sourceTxHash String?
  destTxHash   String?
  paidAt       DateTime?
  expiresAt    DateTime
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@unique([businessId, activeNonce])
  @@index([businessId, status])
  @@index([status, destChain])
}

model WatcherCursor {
  chain     String   @id
  lastBlock BigInt
  updatedAt DateTime @updatedAt
}
```

`activeNonce` holds the nonce while the invoice is open and is set to `NULL` when it closes. Postgres treats `NULL`s as distinct in a unique index, so `@@unique([businessId, activeNonce])` enforces "unique nonce among open invoices" without a partial index.

- [ ] **Step 7: Create `.env.example` and run the migration**

Create `server/.env.example`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/unipay"
ENCRYPTION_MASTER_KEY=""   # openssl rand -base64 32
PRIVY_APP_ID=""
PRIVY_APP_SECRET=""
MERCHANT_TREASURY_ADDRESS="0x0000000000000000000000000000000000000000"
PORT=3001
CORS_ORIGINS="http://localhost:3000"
```

Then:

```bash
cd server
cp .env.example .env       # fill in real values, including a generated master key
npx prisma migrate dev --name init
```

Expected: migration applied, Prisma Client generated.

- [ ] **Step 8: Add the Prisma service and wire the app module**

Create `server/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

Create `server/src/prisma/prisma.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Replace `server/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { loadConfiguration } from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [() => loadConfiguration()] }),
    ScheduleModule.forRoot(),
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- [ ] **Step 9: Enable CORS, validation, and BigInt serialization**

Replace `server/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadConfiguration } from './config/configuration';

// BigInt is not JSON-serializable by default; invoice amounts are BigInt.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const config = loadConfiguration();
  const app = await NestFactory.create(AppModule);

  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  await app.listen(config.port);
}

void bootstrap();
```

- [ ] **Step 10: Verify the server boots**

Run: `cd server && npm run start:dev`
Expected: starts on port 3001 with no errors. `curl localhost:3001` returns `Hello World!`. Stop the server.

- [ ] **Step 11: Commit**

```bash
cd /home/yussif/Desktop/unipay
git add server/ docs/
git commit -m "feat(server): add config, Prisma schema, and app bootstrap"
```

---

## Task 2: Envelope encryption service

**Files:**
- Create: `server/src/crypto/encryption.service.ts`, `server/src/crypto/crypto.module.ts`
- Test: `server/src/crypto/encryption.service.spec.ts`

**Interfaces:**
- Consumes: `AppConfig.encryptionMasterKey` from Task 1
- Produces: `EncryptionService.encrypt(plaintext: string): string` and `EncryptionService.decrypt(envelope: string): string`. The envelope is a single self-describing string safe to store in one text column.

- [ ] **Step 1: Write the failing test**

Create `server/src/crypto/encryption.service.spec.ts`:

```typescript
import { EncryptionService } from './encryption.service';

const masterKey = Buffer.alloc(32, 7);

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService(masterKey);
  });

  it('round-trips a value', () => {
    const envelope = service.encrypt('super-secret');
    expect(service.decrypt(envelope)).toBe('super-secret');
  });

  it('never emits the plaintext in the envelope', () => {
    expect(service.encrypt('super-secret')).not.toContain('super-secret');
  });

  it('produces a different envelope each time for the same input', () => {
    expect(service.encrypt('same')).not.toBe(service.encrypt('same'));
  });

  it('rejects a tampered ciphertext', () => {
    const parts = service.encrypt('super-secret').split('.');
    parts[5] = Buffer.from('tampered-ciphertext').toString('base64url');
    expect(() => service.decrypt(parts.join('.'))).toThrow();
  });

  it('rejects an envelope encrypted under a different master key', () => {
    const envelope = new EncryptionService(Buffer.alloc(32, 9)).encrypt('secret');
    expect(() => service.decrypt(envelope)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/crypto/encryption.service.spec.ts`
Expected: FAIL — cannot find module `./encryption.service`

- [ ] **Step 3: Write the implementation**

Create `server/src/crypto/encryption.service.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const ENCRYPTION_MASTER_KEY = 'ENCRYPTION_MASTER_KEY';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

/**
 * Envelope encryption. A fresh data key (DEK) encrypts the plaintext; the
 * master key encrypts the DEK. Rotating the master key only requires
 * re-wrapping DEKs, not re-encrypting ciphertext.
 *
 * Envelope layout: v1.<wrappedDek>.<dekIv>.<dekTag>.<iv>.<ciphertext>.<tag>
 */
@Injectable()
export class EncryptionService {
  constructor(@Inject(ENCRYPTION_MASTER_KEY) private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error('Encryption master key must be exactly 32 bytes');
    }
  }

  encrypt(plaintext: string): string {
    const dek = randomBytes(32);

    const dekIv = randomBytes(12);
    const dekCipher = createCipheriv(ALGORITHM, this.masterKey, dekIv);
    const wrappedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
    const dekTag = dekCipher.getAuthTag();

    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, dek, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return [VERSION, wrappedDek, dekIv, dekTag, iv, ciphertext, tag]
      .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
      .join('.');
  }

  decrypt(envelope: string): string {
    const [version, wrappedDek, dekIv, dekTag, iv, ciphertext, tag] = envelope.split('.');
    if (version !== VERSION) {
      throw new Error(`Unsupported encryption envelope version: ${version}`);
    }

    const dekDecipher = createDecipheriv(
      ALGORITHM,
      this.masterKey,
      Buffer.from(dekIv, 'base64url'),
    );
    dekDecipher.setAuthTag(Buffer.from(dekTag, 'base64url'));
    const dek = Buffer.concat([
      dekDecipher.update(Buffer.from(wrappedDek, 'base64url')),
      dekDecipher.final(),
    ]);

    const decipher = createDecipheriv(ALGORITHM, dek, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
```

Create `server/src/crypto/crypto.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { EncryptionService, ENCRYPTION_MASTER_KEY } from './encryption.service';
import { loadConfiguration } from '../config/configuration';

@Global()
@Module({
  providers: [
    { provide: ENCRYPTION_MASTER_KEY, useFactory: () => loadConfiguration().encryptionMasterKey },
    EncryptionService,
  ],
  exports: [EncryptionService],
})
export class CryptoModule {}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/crypto/encryption.service.spec.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Register the module**

In `server/src/app.module.ts`, add `import { CryptoModule } from './crypto/crypto.module';` and add `CryptoModule` to the `imports` array after `PrismaModule`.

- [ ] **Step 6: Commit**

```bash
git add server/
git commit -m "feat(server): add envelope encryption service"
```

---

## Task 3: Privy authentication guard

**Files:**
- Create: `server/src/auth/privy.service.ts`, `server/src/auth/privy-auth.guard.ts`, `server/src/auth/current-business.decorator.ts`, `server/src/auth/auth.module.ts`, `server/src/auth/auth.controller.ts`
- Test: `server/src/auth/privy-auth.guard.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 1)
- Produces: `PrivyAuthGuard` (attaches `request.business`); `@CurrentBusiness()` decorator returning `Business`; `PrivyService.verifyAccessToken(token: string): Promise<{ userId: string }>`

- [ ] **Step 1: Install the Privy server SDK**

```bash
cd server && npm install @privy-io/server-auth
```

- [ ] **Step 2: Write the failing test**

Create `server/src/auth/privy-auth.guard.spec.ts`:

```typescript
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrivyAuthGuard } from './privy-auth.guard';

function contextWithHeader(authorization?: string): ExecutionContext {
  const request: Record<string, unknown> = { headers: authorization ? { authorization } : {} };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PrivyAuthGuard', () => {
  const business = { id: 'biz_1', privyUserId: 'did:privy:abc', walletAddress: '0xabc' };

  const privy = { verifyAccessToken: jest.fn() };
  const prisma = { business: { findUnique: jest.fn(), create: jest.fn() } };

  const guard = new PrivyAuthGuard(privy as never, prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('rejects a request with no Authorization header', async () => {
    await expect(guard.canActivate(contextWithHeader())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token Privy refuses', async () => {
    privy.verifyAccessToken.mockRejectedValue(new Error('bad token'));
    await expect(guard.canActivate(contextWithHeader('Bearer nope'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the existing business to the request', async () => {
    privy.verifyAccessToken.mockResolvedValue({ userId: 'did:privy:abc' });
    prisma.business.findUnique.mockResolvedValue(business);

    const context = contextWithHeader('Bearer good');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().business).toEqual(business);
    expect(prisma.business.create).not.toHaveBeenCalled();
  });

  it('rejects a first-time user until they register a wallet', async () => {
    privy.verifyAccessToken.mockResolvedValue({ userId: 'did:privy:new' });
    prisma.business.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(contextWithHeader('Bearer good'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd server && npx jest src/auth/privy-auth.guard.spec.ts`
Expected: FAIL — cannot find module `./privy-auth.guard`

- [ ] **Step 4: Write the implementation**

Create `server/src/auth/privy.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { loadConfiguration } from '../config/configuration';

@Injectable()
export class PrivyService {
  private readonly client: PrivyClient;

  constructor() {
    const { privy } = loadConfiguration();
    this.client = new PrivyClient(privy.appId, privy.appSecret);
  }

  async verifyAccessToken(token: string): Promise<{ userId: string }> {
    const claims = await this.client.verifyAuthToken(token);
    return { userId: claims.userId };
  }
}
```

Create `server/src/auth/privy-auth.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrivyService } from './privy.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PrivyAuthGuard implements CanActivate {
  constructor(
    private readonly privy: PrivyService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers?.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let userId: string;
    try {
      ({ userId } = await this.privy.verifyAccessToken(header.slice('Bearer '.length)));
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const business = await this.prisma.business.findUnique({ where: { privyUserId: userId } });
    if (!business) {
      throw new UnauthorizedException('No business registered for this account');
    }

    request.business = business;
    return true;
  }
}
```

Create `server/src/auth/current-business.decorator.ts`:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Business } from '@prisma/client';

export const CurrentBusiness = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Business =>
    context.switchToHttp().getRequest().business,
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest src/auth/privy-auth.guard.spec.ts`
Expected: PASS, 4 tests

- [ ] **Step 6: Add the registration endpoint**

A first-time user has a verified Privy token but no `Business` row, so registration cannot sit behind the guard. It verifies the token itself.

Create `server/src/auth/auth.controller.ts`:

```typescript
import { Body, Controller, Get, Headers, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsEthereumAddress, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Business } from '@prisma/client';
import { PrivyService } from './privy.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrivyAuthGuard } from './privy-auth.guard';
import { CurrentBusiness } from './current-business.decorator';

class RegisterBusinessDto {
  @IsEthereumAddress()
  walletAddress!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly privy: PrivyService,
    private readonly prisma: PrismaService,
  ) {}

  /** Idempotent: creates the business on first call, updates the wallet after. */
  @Post('register')
  async register(
    @Headers('authorization') authorization: string | undefined,
    @Body() dto: RegisterBusinessDto,
  ): Promise<Business> {
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    let userId: string;
    try {
      ({ userId } = await this.privy.verifyAccessToken(
        authorization.slice('Bearer '.length),
      ));
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    return this.prisma.business.upsert({
      where: { privyUserId: userId },
      create: {
        privyUserId: userId,
        walletAddress: dto.walletAddress.toLowerCase(),
        name: dto.name,
      },
      update: { walletAddress: dto.walletAddress.toLowerCase(), name: dto.name },
    });
  }

  @Get('me')
  @UseGuards(PrivyAuthGuard)
  me(@CurrentBusiness() business: Business): Business {
    return business;
  }
}
```

Create `server/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrivyService } from './privy.service';
import { PrivyAuthGuard } from './privy-auth.guard';
import { AuthController } from './auth.controller';

@Module({
  controllers: [AuthController],
  providers: [PrivyService, PrivyAuthGuard],
  exports: [PrivyService, PrivyAuthGuard],
})
export class AuthModule {}
```

Register `AuthModule` in `server/src/app.module.ts` imports.

- [ ] **Step 7: Run the full suite**

Run: `cd server && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/
git commit -m "feat(server): add Privy auth guard and business registration"
```

---

## Task 4: Invoice state machine

**Files:**
- Create: `server/src/invoices/invoice-state.ts`
- Test: `server/src/invoices/invoice-state.spec.ts`

**Interfaces:**
- Consumes: `InvoiceStatus` enum from `@prisma/client` (Task 1)
- Produces: `canTransition(from, to): boolean`; `assertTransition(from, to): void` (throws `InvalidTransitionError`); `isOpen(status): boolean`; `class InvalidTransitionError extends Error`

Pure module — no database, no network.

- [ ] **Step 1: Write the failing test**

Create `server/src/invoices/invoice-state.spec.ts`:

```typescript
import { InvoiceStatus } from '@prisma/client';
import { canTransition, assertTransition, isOpen, InvalidTransitionError } from './invoice-state';

describe('invoice state machine', () => {
  it('allows the happy path', () => {
    expect(canTransition(InvoiceStatus.PENDING, InvoiceStatus.PROCESSING)).toBe(true);
    expect(canTransition(InvoiceStatus.PROCESSING, InvoiceStatus.PAID)).toBe(true);
  });

  it('allows PENDING to jump straight to PAID', () => {
    // The consumer app does not yet report PROCESSING, so the watcher
    // observes settlement without an intermediate transition.
    expect(canTransition(InvoiceStatus.PENDING, InvoiceStatus.PAID)).toBe(true);
  });

  it('treats PAID as terminal', () => {
    for (const status of Object.values(InvoiceStatus)) {
      expect(canTransition(InvoiceStatus.PAID, status)).toBe(false);
    }
  });

  it('refuses to walk backwards', () => {
    expect(canTransition(InvoiceStatus.PROCESSING, InvoiceStatus.PENDING)).toBe(false);
  });

  it('refuses to reopen an expired invoice', () => {
    expect(canTransition(InvoiceStatus.EXPIRED, InvoiceStatus.PAID)).toBe(false);
  });

  it('throws a descriptive error on an illegal transition', () => {
    expect(() => assertTransition(InvoiceStatus.PAID, InvoiceStatus.PENDING)).toThrow(
      InvalidTransitionError,
    );
    expect(() => assertTransition(InvoiceStatus.PAID, InvoiceStatus.PENDING)).toThrow(
      /PAID.*PENDING/,
    );
  });

  it('reports which statuses are open', () => {
    expect(isOpen(InvoiceStatus.PENDING)).toBe(true);
    expect(isOpen(InvoiceStatus.PROCESSING)).toBe(true);
    expect(isOpen(InvoiceStatus.PAID)).toBe(false);
    expect(isOpen(InvoiceStatus.EXPIRED)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/invoices/invoice-state.spec.ts`
Expected: FAIL — cannot find module `./invoice-state`

- [ ] **Step 3: Write the implementation**

Create `server/src/invoices/invoice-state.ts`:

```typescript
import { InvoiceStatus } from '@prisma/client';

export class InvalidTransitionError extends Error {
  constructor(from: InvoiceStatus, to: InvoiceStatus) {
    super(`Illegal invoice transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

const TRANSITIONS: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  [InvoiceStatus.PENDING]: [
    InvoiceStatus.PROCESSING,
    InvoiceStatus.PAID,
    InvoiceStatus.UNDERPAID,
    InvoiceStatus.EXPIRED,
    InvoiceStatus.FAILED,
  ],
  [InvoiceStatus.PROCESSING]: [
    InvoiceStatus.PAID,
    InvoiceStatus.UNDERPAID,
    InvoiceStatus.FAILED,
  ],
  [InvoiceStatus.UNDERPAID]: [InvoiceStatus.PAID, InvoiceStatus.EXPIRED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.EXPIRED]: [],
  [InvoiceStatus.FAILED]: [],
};

const OPEN_STATUSES: readonly InvoiceStatus[] = [
  InvoiceStatus.PENDING,
  InvoiceStatus.PROCESSING,
  InvoiceStatus.UNDERPAID,
];

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: InvoiceStatus, to: InvoiceStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

/** Open invoices hold an activeNonce and are candidates for settlement matching. */
export function isOpen(status: InvoiceStatus): boolean {
  return OPEN_STATUSES.includes(status);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/invoices/invoice-state.spec.ts`
Expected: PASS, 7 tests

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat(server): add invoice state machine"
```

---

## Task 5: Amount nonce allocation

**Files:**
- Create: `server/src/invoices/amount-nonce.ts`
- Test: `server/src/invoices/amount-nonce.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `NONCE_MIN = 1`, `NONCE_MAX = 9999`, `pickNonce(taken: ReadonlySet<number>): number` (throws `NonceSpaceExhaustedError`), `applyNonce(amountBase: bigint, nonce: number): bigint`, `class NonceSpaceExhaustedError extends Error`

Pure module. The database enforces uniqueness via `@@unique([businessId, activeNonce])`; this module chooses a candidate and the service retries on constraint violation (Task 6).

- [ ] **Step 1: Write the failing test**

Create `server/src/invoices/amount-nonce.spec.ts`:

```typescript
import {
  pickNonce,
  applyNonce,
  NONCE_MIN,
  NONCE_MAX,
  NonceSpaceExhaustedError,
} from './amount-nonce';

describe('amount nonce', () => {
  it('picks a nonce inside the sub-cent range', () => {
    const nonce = pickNonce(new Set());
    expect(nonce).toBeGreaterThanOrEqual(NONCE_MIN);
    expect(nonce).toBeLessThanOrEqual(NONCE_MAX);
  });

  it('never picks a nonce already taken', () => {
    const taken = new Set<number>();
    for (let i = NONCE_MIN; i < NONCE_MAX; i++) taken.add(i);
    expect(pickNonce(taken)).toBe(NONCE_MAX);
  });

  it('throws rather than reusing when the space is exhausted', () => {
    const taken = new Set<number>();
    for (let i = NONCE_MIN; i <= NONCE_MAX; i++) taken.add(i);
    expect(() => pickNonce(taken)).toThrow(NonceSpaceExhaustedError);
  });

  it('adds the nonce so the merchant is never underpaid', () => {
    // 100 USDC = 100_000_000 base units
    expect(applyNonce(100_000_000n, 417)).toBe(100_000_417n);
  });

  it('keeps the surcharge strictly below one cent', () => {
    const oneCent = 10_000n;
    expect(applyNonce(100_000_000n, NONCE_MAX) - 100_000_000n).toBeLessThan(oneCent);
  });

  it('rejects a nonce outside the range', () => {
    expect(() => applyNonce(100_000_000n, 0)).toThrow(/range/);
    expect(() => applyNonce(100_000_000n, NONCE_MAX + 1)).toThrow(/range/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/invoices/amount-nonce.spec.ts`
Expected: FAIL — cannot find module `./amount-nonce`

- [ ] **Step 3: Write the implementation**

Create `server/src/invoices/amount-nonce.ts`:

```typescript
/**
 * Each open invoice for a business gets a unique sub-cent surcharge so an
 * incoming USDC transfer maps to exactly one invoice. USDC has 6 decimals,
 * so 1..9999 base units is 0.000001..0.009999 USDC — always under one cent.
 *
 * The nonce is ADDED, never subtracted: the merchant is always paid at least
 * the amount requested.
 */
export const NONCE_MIN = 1;
export const NONCE_MAX = 9999;

export class NonceSpaceExhaustedError extends Error {
  constructor() {
    super(
      `All ${NONCE_MAX} amount nonces are in use for this business; ` +
        'close an open invoice before creating another',
    );
    this.name = 'NonceSpaceExhaustedError';
  }
}

export function pickNonce(taken: ReadonlySet<number>): number {
  const available: number[] = [];
  for (let candidate = NONCE_MIN; candidate <= NONCE_MAX; candidate++) {
    if (!taken.has(candidate)) available.push(candidate);
  }

  if (available.length === 0) {
    throw new NonceSpaceExhaustedError();
  }

  return available[Math.floor(Math.random() * available.length)];
}

export function applyNonce(amountBase: bigint, nonce: number): bigint {
  if (!Number.isInteger(nonce) || nonce < NONCE_MIN || nonce > NONCE_MAX) {
    throw new Error(`Nonce ${nonce} is outside the range ${NONCE_MIN}..${NONCE_MAX}`);
  }
  return amountBase + BigInt(nonce);
}
```

Nonces are chosen at random rather than sequentially so a payment link does not leak how many invoices a merchant has issued.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/invoices/amount-nonce.spec.ts`
Expected: PASS, 6 tests

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat(server): add amount nonce allocation"
```

---

## Task 6: Invoice service and authenticated routes

**Files:**
- Create: `server/src/invoices/invoices.service.ts`, `server/src/invoices/invoices.controller.ts`, `server/src/invoices/dto/create-invoice.dto.ts`, `server/src/invoices/invoices.module.ts`
- Test: `server/src/invoices/invoices.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 1), `pickNonce`/`applyNonce` (Task 5), `isOpen` (Task 4)
- Produces: `InvoicesService.create(business, dto): Promise<Invoice>`, `.listForBusiness(businessId): Promise<Invoice[]>`, `.getOwned(businessId, id): Promise<Invoice>`, `.getPublic(id): Promise<PublicInvoice>`

- [ ] **Step 1: Write the failing test**

Create `server/src/invoices/invoices.service.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';

const business = { id: 'biz_1', walletAddress: '0xmerchant', privyUserId: 'did:privy:a' } as never;

describe('InvoicesService', () => {
  const prisma = {
    invoice: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
  };
  const service = new InvoicesService(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('adds a nonce to the requested amount and stores both', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    prisma.invoice.create.mockImplementation(({ data }) => Promise.resolve(data));

    const invoice = await service.create(business, { amount: '100', description: 'Coffee' });

    expect(invoice.amountBase).toBe(100_000_000n);
    expect(invoice.payableBase).toBe(100_000_000n + BigInt(invoice.nonce));
    expect(invoice.payableBase).toBeGreaterThan(invoice.amountBase);
    expect(invoice.activeNonce).toBe(invoice.nonce);
    expect(invoice.status).toBe(InvoiceStatus.PENDING);
    expect(invoice.recipient).toBe('0xmerchant');
  });

  it('never reuses a nonce held by an open invoice', async () => {
    const taken = Array.from({ length: 9998 }, (_, i) => ({ activeNonce: i + 1 }));
    prisma.invoice.findMany.mockResolvedValue(taken);
    prisma.invoice.create.mockImplementation(({ data }) => Promise.resolve(data));

    const invoice = await service.create(business, { amount: '5' });

    expect(invoice.nonce).toBe(9999);
  });

  it('rejects a non-positive amount', async () => {
    await expect(service.create(business, { amount: '0' })).rejects.toThrow(/greater than zero/);
  });

  it('rejects an amount with more than six decimal places', async () => {
    await expect(service.create(business, { amount: '1.0000001' })).rejects.toThrow(/decimal/);
  });

  it('refuses to return another business’s invoice', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv_1', businessId: 'biz_OTHER' });
    await expect(service.getOwned('biz_1', 'inv_1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('omits internal fields from the public view', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv_1',
      businessId: 'biz_1',
      amountBase: 100_000_000n,
      payableBase: 100_000_417n,
      nonce: 417,
      activeNonce: 417,
      recipient: '0xmerchant',
      destChain: 'arc-testnet',
      asset: 'USDC',
      status: InvoiceStatus.PENDING,
      description: 'Coffee',
      expiresAt: new Date(),
      business: { name: 'Acme' },
    });

    const view = await service.getPublic('inv_1');

    expect(view).not.toHaveProperty('nonce');
    expect(view).not.toHaveProperty('activeNonce');
    expect(view).not.toHaveProperty('businessId');
    expect(view.payableBase).toBe(100_000_417n);
    expect(view.businessName).toBe('Acme');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/invoices/invoices.service.spec.ts`
Expected: FAIL — cannot find module `./invoices.service`

- [ ] **Step 3: Write the DTO**

Create `server/src/invoices/dto/create-invoice.dto.ts`:

```typescript
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateInvoiceDto {
  /** Decimal USDC string, e.g. "100" or "12.50". Never a float. */
  @Matches(/^\d+(\.\d{1,6})?$/, {
    message: 'amount must be a decimal with at most 6 decimal places',
  })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  description?: string;
}
```

- [ ] **Step 4: Write the service**

Create `server/src/invoices/invoices.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Business, Invoice } from '@prisma/client';
import { InvoiceStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { pickNonce, applyNonce } from './amount-nonce';
import { isOpen } from './invoice-state';
import { ARC_CHAIN_KEY, USDC_DECIMALS } from '../config/chains';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';

const OPEN_STATUSES = Object.values(InvoiceStatus).filter(isOpen);
const INVOICE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PublicInvoice {
  id: string;
  businessName: string | null;
  amountBase: bigint;
  payableBase: bigint;
  recipient: string;
  destChain: string;
  asset: string;
  status: InvoiceStatus;
  description: string | null;
  expiresAt: Date;
}

/** "12.5" -> 12_500_000n. Rejects floats and excess precision. */
export function parseUsdcAmount(amount: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) {
    throw new Error('Amount must be a decimal with at most 6 decimal places');
  }

  const [whole, fraction = ''] = amount.split('.');
  const base = BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) +
    BigInt(fraction.padEnd(USDC_DECIMALS, '0'));

  if (base <= 0n) {
    throw new Error('Amount must be greater than zero');
  }
  return base;
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(business: Business, dto: CreateInvoiceDto): Promise<Invoice> {
    const amountBase = parseUsdcAmount(dto.amount);

    const open = await this.prisma.invoice.findMany({
      where: { businessId: business.id, status: { in: OPEN_STATUSES } },
      select: { activeNonce: true },
    });

    const taken = new Set(
      open.map((row) => row.activeNonce).filter((n): n is number => n !== null),
    );
    const nonce = pickNonce(taken);

    return this.prisma.invoice.create({
      data: {
        id: nanoid(12),
        businessId: business.id,
        amountBase,
        nonce,
        activeNonce: nonce,
        payableBase: applyNonce(amountBase, nonce),
        recipient: business.walletAddress,
        destChain: ARC_CHAIN_KEY,
        asset: 'USDC',
        description: dto.description,
        status: InvoiceStatus.PENDING,
        expiresAt: new Date(Date.now() + INVOICE_TTL_MS),
      },
    });
  }

  listForBusiness(businessId: string): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOwned(businessId: string, id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.businessId !== businessId) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async getPublic(id: string): Promise<PublicInvoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { business: { select: { name: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return {
      id: invoice.id,
      businessName: invoice.business.name,
      amountBase: invoice.amountBase,
      payableBase: invoice.payableBase,
      recipient: invoice.recipient,
      destChain: invoice.destChain,
      asset: invoice.asset,
      status: invoice.status,
      description: invoice.description,
      expiresAt: invoice.expiresAt,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest src/invoices/invoices.service.spec.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Add the authenticated controller and module**

Create `server/src/invoices/invoices.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import type { Business, Invoice } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PrivyAuthGuard } from '../auth/privy-auth.guard';
import { CurrentBusiness } from '../auth/current-business.decorator';

@Controller('invoices')
@UseGuards(PrivyAuthGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Post()
  create(@CurrentBusiness() business: Business, @Body() dto: CreateInvoiceDto): Promise<Invoice> {
    return this.invoices.create(business, dto);
  }

  @Get()
  list(@CurrentBusiness() business: Business): Promise<Invoice[]> {
    return this.invoices.listForBusiness(business.id);
  }

  @Get(':id')
  get(@CurrentBusiness() business: Business, @Param('id') id: string): Promise<Invoice> {
    return this.invoices.getOwned(business.id, id);
  }
}
```

Create `server/src/invoices/invoices.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoicesController } from './invoices.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
```

Register `InvoicesModule` in `server/src/app.module.ts` imports.

- [ ] **Step 7: Run the full suite**

Run: `cd server && npm test`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/
git commit -m "feat(server): add invoice creation and retrieval"
```

---

## Task 7: Public invoice route and payment callback

**Files:**
- Create: `server/src/invoices/public-invoices.controller.ts`, `server/src/invoices/dto/report-payment.dto.ts`
- Modify: `server/src/invoices/invoices.service.ts`, `server/src/invoices/invoices.module.ts`
- Test: `server/src/invoices/report-payment.spec.ts`

**Interfaces:**
- Consumes: `InvoicesService.getPublic` (Task 6), `assertTransition` (Task 4)
- Produces: `InvoicesService.reportPayment(id, sourceTxHash): Promise<Invoice>`; routes `GET /public/invoices/:id` and `POST /public/invoices/:id/payments`

Both routes are unauthenticated — a customer paying an invoice has no UniPay account. Per the spec, the callback may only move `PENDING → PROCESSING`; it can never mark an invoice paid.

- [ ] **Step 1: Write the failing test**

Create `server/src/invoices/report-payment.spec.ts`:

```typescript
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';

describe('InvoicesService.reportPayment', () => {
  const prisma = {
    invoice: { findUnique: jest.fn(), update: jest.fn() },
  };
  const service = new InvoicesService(prisma as never);

  beforeEach(() => jest.resetAllMocks());

  it('moves a pending invoice to PROCESSING and records the source hash', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv_1', status: InvoiceStatus.PENDING });
    prisma.invoice.update.mockImplementation(({ data }) => Promise.resolve(data));

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(result.status).toBe(InvoiceStatus.PROCESSING);
    expect(result.sourceTxHash).toBe('0xdeadbeef');
  });

  it('cannot mark an invoice PAID', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv_1', status: InvoiceStatus.PENDING });
    prisma.invoice.update.mockImplementation(({ data }) => Promise.resolve(data));

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(result.status).not.toBe(InvoiceStatus.PAID);
  });

  it('is idempotent when already processing', async () => {
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'inv_1',
      status: InvoiceStatus.PROCESSING,
      sourceTxHash: '0xdeadbeef',
    });

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(result.status).toBe(InvoiceStatus.PROCESSING);
  });

  it('leaves an already-paid invoice untouched', async () => {
    prisma.invoice.findUnique.mockResolvedValue({ id: 'inv_1', status: InvoiceStatus.PAID });

    const result = await service.reportPayment('inv_1', '0xdeadbeef');

    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(result.status).toBe(InvoiceStatus.PAID);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/invoices/report-payment.spec.ts`
Expected: FAIL — `service.reportPayment is not a function`

- [ ] **Step 3: Add the method to InvoicesService**

Append to the `InvoicesService` class in `server/src/invoices/invoices.service.ts`:

```typescript
  /**
   * Called by the consumer checkout app after it broadcasts a payment.
   * Advisory only: it may move PENDING -> PROCESSING and nothing else.
   * Only the Arc watcher may set PAID.
   */
  async reportPayment(id: string, sourceTxHash: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.PENDING) {
      return invoice as Invoice;
    }

    assertTransition(invoice.status, InvoiceStatus.PROCESSING);

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.PROCESSING, sourceTxHash },
    });
  }
```

Update the import at the top of the file:

```typescript
import { isOpen, assertTransition } from './invoice-state';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/invoices/report-payment.spec.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Add the public controller**

Create `server/src/invoices/dto/report-payment.dto.ts`:

```typescript
import { Matches } from 'class-validator';

export class ReportPaymentDto {
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'sourceTxHash must be a 32-byte hex hash' })
  sourceTxHash!: string;
}
```

Create `server/src/invoices/public-invoices.controller.ts`:

```typescript
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { Invoice } from '@prisma/client';
import { InvoicesService, type PublicInvoice } from './invoices.service';
import { ReportPaymentDto } from './dto/report-payment.dto';

/**
 * Unauthenticated. A customer paying an invoice has no UniPay account.
 *
 * POST /payments is the integration contract for the consumer checkout app
 * (see spec §12). Nothing in this system depends on it being called.
 */
@Controller('public/invoices')
export class PublicInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get(':id')
  get(@Param('id') id: string): Promise<PublicInvoice> {
    return this.invoices.getPublic(id);
  }

  @Post(':id/payments')
  reportPayment(@Param('id') id: string, @Body() dto: ReportPaymentDto): Promise<Invoice> {
    return this.invoices.reportPayment(id, dto.sourceTxHash);
  }
}
```

Add `PublicInvoicesController` to the `controllers` array in `server/src/invoices/invoices.module.ts`.

- [ ] **Step 6: Run the full suite**

Run: `cd server && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "feat(server): add public invoice route and payment callback"
```

---

## Task 8: Transfer matcher

**Files:**
- Create: `server/src/watcher/transfer-matcher.ts`
- Test: `server/src/watcher/transfer-matcher.spec.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `interface ObservedTransfer { to: string; valueBase: bigint; txHash: string; blockNumber: bigint }`, `interface MatchableInvoice { id: string; recipient: string; payableBase: bigint }`, `interface TransferMatch { invoiceId: string; txHash: string; valueBase: bigint }`, `matchTransfers(transfers, invoices): TransferMatch[]`

Pure module — no database, no network. Exact-amount matching is what the amount nonce buys, and it is sound because the consumer app guarantees exact net delivery.

- [ ] **Step 1: Write the failing test**

Create `server/src/watcher/transfer-matcher.spec.ts`:

```typescript
import { matchTransfers } from './transfer-matcher';

const invoice = (id: string, payableBase: bigint, recipient = '0xmerchant') => ({
  id,
  recipient,
  payableBase,
});

const transfer = (to: string, valueBase: bigint, txHash = '0xtx') => ({
  to,
  valueBase,
  txHash,
  blockNumber: 1n,
});

describe('matchTransfers', () => {
  it('matches an exact amount to the right invoice', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_000_417n)],
      [invoice('inv_a', 100_000_417n), invoice('inv_b', 100_000_918n)],
    );
    expect(matches).toEqual([
      { invoiceId: 'inv_a', txHash: '0xtx', valueBase: 100_000_417n },
    ]);
  });

  it('distinguishes same-amount invoices by their nonce', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_000_918n)],
      [invoice('inv_a', 100_000_417n), invoice('inv_b', 100_000_918n)],
    );
    expect(matches.map((m) => m.invoiceId)).toEqual(['inv_b']);
  });

  it('ignores a transfer to a different recipient', () => {
    expect(
      matchTransfers(
        [transfer('0xsomeone_else', 100_000_417n)],
        [invoice('inv_a', 100_000_417n)],
      ),
    ).toEqual([]);
  });

  it('compares recipients case-insensitively', () => {
    const matches = matchTransfers(
      [transfer('0xMERCHANT', 100_000_417n)],
      [invoice('inv_a', 100_000_417n, '0xmerchant')],
    );
    expect(matches).toHaveLength(1);
  });

  it('ignores an amount that does not match any invoice', () => {
    expect(
      matchTransfers([transfer('0xmerchant', 99_000_000n)], [invoice('inv_a', 100_000_417n)]),
    ).toEqual([]);
  });

  it('never credits one invoice twice within a run', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_000_417n, '0xtx1'), transfer('0xmerchant', 100_000_417n, '0xtx2')],
      [invoice('inv_a', 100_000_417n)],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].txHash).toBe('0xtx1');
  });

  it('matches several invoices in one batch', () => {
    const matches = matchTransfers(
      [transfer('0xmerchant', 100_000_417n, '0xtx1'), transfer('0xmerchant', 50_000_918n, '0xtx2')],
      [invoice('inv_a', 100_000_417n), invoice('inv_b', 50_000_918n)],
    );
    expect(matches.map((m) => m.invoiceId).sort()).toEqual(['inv_a', 'inv_b']);
  });

  it('returns nothing when there are no open invoices', () => {
    expect(matchTransfers([transfer('0xmerchant', 100_000_417n)], [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/watcher/transfer-matcher.spec.ts`
Expected: FAIL — cannot find module `./transfer-matcher`

- [ ] **Step 3: Write the implementation**

Create `server/src/watcher/transfer-matcher.ts`:

```typescript
export interface ObservedTransfer {
  to: string;
  valueBase: bigint;
  txHash: string;
  blockNumber: bigint;
}

export interface MatchableInvoice {
  id: string;
  recipient: string;
  payableBase: bigint;
}

export interface TransferMatch {
  invoiceId: string;
  txHash: string;
  valueBase: bigint;
}

const key = (recipient: string, amount: bigint): string =>
  `${recipient.toLowerCase()}:${amount.toString()}`;

/**
 * Matches observed USDC transfers to open invoices on exact amount and
 * recipient. Exactness is safe because every open invoice carries a unique
 * sub-cent nonce and the consumer app guarantees exact net delivery.
 *
 * Each invoice is credited at most once per run; the earliest transfer wins.
 */
export function matchTransfers(
  transfers: readonly ObservedTransfer[],
  invoices: readonly MatchableInvoice[],
): TransferMatch[] {
  const byAmount = new Map<string, MatchableInvoice>();
  for (const invoice of invoices) {
    byAmount.set(key(invoice.recipient, invoice.payableBase), invoice);
  }

  const credited = new Set<string>();
  const matches: TransferMatch[] = [];

  for (const transfer of transfers) {
    const invoice = byAmount.get(key(transfer.to, transfer.valueBase));
    if (!invoice || credited.has(invoice.id)) continue;

    credited.add(invoice.id);
    matches.push({
      invoiceId: invoice.id,
      txHash: transfer.txHash,
      valueBase: transfer.valueBase,
    });
  }

  return matches;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/watcher/transfer-matcher.spec.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Commit**

```bash
git add server/
git commit -m "feat(server): add transfer-to-invoice matcher"
```

---

## Task 9: Arc settlement watcher

**Files:**
- Create: `server/src/watcher/arc-watcher.service.ts`, `server/src/watcher/watcher.module.ts`
- Test: `server/src/watcher/arc-watcher.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 1), `matchTransfers` (Task 8), `isOpen` (Task 4), Arc constants (Task 1)
- Produces: `ArcWatcherService.pollOnce(): Promise<number>` returning the number of invoices marked paid

The scheduled entry point delegates to `pollOnce()` so the logic is testable without timers.

- [ ] **Step 1: Write the failing test**

Create `server/src/watcher/arc-watcher.service.spec.ts`:

```typescript
import { InvoiceStatus } from '@prisma/client';
import { ArcWatcherService } from './arc-watcher.service';

describe('ArcWatcherService.pollOnce', () => {
  const prisma = {
    watcherCursor: { findUnique: jest.fn(), upsert: jest.fn() },
    invoice: { findMany: jest.fn(), updateMany: jest.fn() },
  };
  const rpc = { getBlockNumber: jest.fn(), getTransferLogs: jest.fn() };

  const service = new ArcWatcherService(prisma as never, rpc as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.watcherCursor.upsert.mockResolvedValue({});
    prisma.invoice.updateMany.mockResolvedValue({ count: 1 });
  });

  it('does nothing when there are no open invoices', async () => {
    prisma.invoice.findMany.mockResolvedValue([]);
    rpc.getBlockNumber.mockResolvedValue(100n);

    expect(await service.pollOnce()).toBe(0);
    expect(rpc.getTransferLogs).not.toHaveBeenCalled();
  });

  it('marks a matched invoice PAID and clears its active nonce', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 100_000_417n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);
    rpc.getTransferLogs.mockResolvedValue([
      { to: '0xmerchant', valueBase: 100_000_417n, txHash: '0xtx', blockNumber: 55n },
    ]);

    expect(await service.pollOnce()).toBe(1);

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv_a', status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PROCESSING] } },
      data: expect.objectContaining({
        status: InvoiceStatus.PAID,
        destTxHash: '0xtx',
        activeNonce: null,
      }),
    });
  });

  it('advances the cursor past the scanned range', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 1n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);
    rpc.getTransferLogs.mockResolvedValue([]);

    await service.pollOnce();

    expect(prisma.watcherCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { lastBlock: 60n } }),
    );
  });

  it('does not advance the cursor when the scan throws', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 1n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 50n });
    rpc.getBlockNumber.mockResolvedValue(60n);
    rpc.getTransferLogs.mockRejectedValue(new Error('RPC down'));

    await expect(service.pollOnce()).rejects.toThrow('RPC down');
    expect(prisma.watcherCursor.upsert).not.toHaveBeenCalled();
  });

  it('is a no-op when no new blocks have been produced', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 1n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 60n });
    rpc.getBlockNumber.mockResolvedValue(60n);

    expect(await service.pollOnce()).toBe(0);
    expect(rpc.getTransferLogs).not.toHaveBeenCalled();
  });

  it('caps a single scan to the maximum block span', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { id: 'inv_a', recipient: '0xmerchant', payableBase: 1n },
    ]);
    prisma.watcherCursor.findUnique.mockResolvedValue({ lastBlock: 0n });
    rpc.getBlockNumber.mockResolvedValue(100_000n);
    rpc.getTransferLogs.mockResolvedValue([]);

    await service.pollOnce();

    const [, toBlock] = rpc.getTransferLogs.mock.calls[0];
    expect(toBlock).toBe(2000n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/watcher/arc-watcher.service.spec.ts`
Expected: FAIL — cannot find module `./arc-watcher.service`

- [ ] **Step 3: Write the RPC client**

Create `server/src/watcher/arc-rpc.client.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { createPublicClient, http, parseAbiItem, type PublicClient } from 'viem';
import { arcTestnet } from 'viem/chains';
import { ARC_RPC_URL, ARC_USDC_ADDRESS } from '../config/chains';
import type { ObservedTransfer } from './transfer-matcher';

const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

@Injectable()
export class ArcRpcClient {
  private readonly client: PublicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_RPC_URL),
  });

  getBlockNumber(): Promise<bigint> {
    return this.client.getBlockNumber();
  }

  async getTransferLogs(
    fromBlock: bigint,
    toBlock: bigint,
    recipients: readonly string[],
  ): Promise<ObservedTransfer[]> {
    const logs = await this.client.getLogs({
      address: ARC_USDC_ADDRESS,
      event: TRANSFER_EVENT,
      args: { to: recipients as `0x${string}`[] },
      fromBlock,
      toBlock,
    });

    return logs.map((log) => ({
      to: log.args.to as string,
      valueBase: log.args.value as bigint,
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
    }));
  }
}
```

- [ ] **Step 4: Write the watcher service**

Create `server/src/watcher/arc-watcher.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ArcRpcClient } from './arc-rpc.client';
import { matchTransfers } from './transfer-matcher';
import { isOpen } from '../invoices/invoice-state';
import { ARC_CHAIN_KEY } from '../config/chains';

const MAX_BLOCK_SPAN = 2000n;
const OPEN_STATUSES = Object.values(InvoiceStatus).filter(isOpen);

/**
 * The sole authority for marking an invoice PAID (spec §10). Polls Arc for
 * USDC Transfer events to merchant addresses and matches them to open
 * invoices by exact amount.
 */
@Injectable()
export class ArcWatcherService {
  private readonly logger = new Logger(ArcWatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rpc: ArcRpcClient,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleCron(): Promise<void> {
    try {
      await this.pollOnce();
    } catch (error) {
      // Swallow so a transient RPC failure does not kill the schedule.
      // The cursor is not advanced, so the range is rescanned next tick.
      this.logger.error('Arc watcher poll failed', error as Error);
    }
  }

  async pollOnce(): Promise<number> {
    const open = await this.prisma.invoice.findMany({
      where: { status: { in: OPEN_STATUSES }, destChain: ARC_CHAIN_KEY },
      select: { id: true, recipient: true, payableBase: true },
    });

    if (open.length === 0) return 0;

    const head = await this.rpc.getBlockNumber();
    const cursor = await this.prisma.watcherCursor.findUnique({
      where: { chain: ARC_CHAIN_KEY },
    });

    const fromBlock = cursor ? cursor.lastBlock + 1n : head;
    if (fromBlock > head) return 0;

    const maxToBlock = fromBlock + MAX_BLOCK_SPAN - 1n;
    const toBlock = maxToBlock > head ? head : maxToBlock;

    const recipients = [...new Set(open.map((i) => i.recipient.toLowerCase()))];
    const transfers = await this.rpc.getTransferLogs(fromBlock, toBlock, recipients);
    const matches = matchTransfers(transfers, open);

    let paid = 0;
    for (const match of matches) {
      // Conditional update: a concurrent poll or a terminal status makes this
      // a no-op, so an invoice is never credited twice.
      const { count } = await this.prisma.invoice.updateMany({
        where: {
          id: match.invoiceId,
          status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PROCESSING] },
        },
        data: {
          status: InvoiceStatus.PAID,
          destTxHash: match.txHash,
          paidAt: new Date(),
          activeNonce: null,
        },
      });
      paid += count;
    }

    await this.prisma.watcherCursor.upsert({
      where: { chain: ARC_CHAIN_KEY },
      create: { chain: ARC_CHAIN_KEY, lastBlock: toBlock },
      update: { lastBlock: toBlock },
    });

    return paid;
  }
}
```

Create `server/src/watcher/watcher.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ArcWatcherService } from './arc-watcher.service';
import { ArcRpcClient } from './arc-rpc.client';

@Module({
  providers: [ArcWatcherService, ArcRpcClient],
  exports: [ArcWatcherService],
})
export class WatcherModule {}
```

Register `WatcherModule` in `server/src/app.module.ts` imports.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd server && npx jest src/watcher/arc-watcher.service.spec.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Run the full suite**

Run: `cd server && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "feat(server): add Arc settlement watcher"
```

---

## Task 10: Dashboard Privy provider and login

**Files:**
- Create: `business/app/providers.tsx`, `business/lib/chains.ts`, `business/.env.local.example`
- Modify: `business/app/layout.tsx`, `business/app/page.tsx`
- Test: manual (browser)

**Interfaces:**
- Consumes: nothing from the server yet
- Produces: a Privy session available to every client component via `usePrivy()` / `useWallets()`; `arcTestnet` re-exported from `business/lib/chains.ts`

This app is Next.js 16 with React 19. Route props are the generated `PageProps<'/route'>` / `LayoutProps<'/route'>` global types, and `params`/`searchParams` are Promises that must be awaited.

- [ ] **Step 1: Install dependencies**

```bash
cd business
npm install @privy-io/react-auth viem qrcode.react
```

- [ ] **Step 2: Add the chain module and env template**

Create `business/lib/chains.ts`:

```typescript
import { arcTestnet } from 'viem/chains';

export { arcTestnet };

export const ARC_CHAIN_KEY = 'arc-testnet';
export const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';
/** Arc's USDC ERC-20 view (6 decimals). Native gas is the same funds at 18. */
export const ARC_USDC_ADDRESS = '0x3600000000000000000000000000000000000000' as const;
export const USDC_DECIMALS = 6;
```

Create `business/.env.local.example`:

```bash
NEXT_PUBLIC_PRIVY_APP_ID=""
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

Then `cp .env.local.example .env.local` and fill in the Privy app ID from the Privy dashboard.

- [ ] **Step 3: Create the provider**

Create `business/app/providers.tsx`:

```tsx
'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { arcTestnet } from '@/lib/chains';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // Businesses may connect an existing wallet or have one created.
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: arcTestnet,
        supportedChains: [arcTestnet],
        appearance: { theme: 'light', walletChainType: 'ethereum-only' },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
```

`createOnLogin: 'users-without-wallets'` is deliberate: a business that connects its own wallet is not given a second one.

- [ ] **Step 4: Wrap the root layout**

Modify `business/app/layout.tsx` — change the metadata and wrap `children`:

```tsx
export const metadata: Metadata = {
  title: "UniPay for Business",
  description: "Accept payments and receive USDC on Arc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Add the import: `import { Providers } from "./providers";`

- [ ] **Step 5: Replace the landing page with login**

Replace `business/app/page.tsx`:

```tsx
'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) router.replace('/dashboard');
  }, [ready, authenticated, router]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-semibold tracking-tight">UniPay for Business</h1>
        <p className="mt-3 text-zinc-600">
          Accept payments from any chain. Receive USDC on Arc.
        </p>
      </div>

      <button
        onClick={login}
        disabled={!ready}
        className="rounded-full bg-black px-6 py-3 text-white disabled:opacity-40"
      >
        {ready ? 'Connect or create a wallet' : 'Loading…'}
      </button>
    </main>
  );
}
```

- [ ] **Step 6: Verify in the browser**

Run: `cd business && npm run dev`
Open `http://localhost:3000`.
Expected: the landing page renders, the button opens the Privy modal, and after logging in the browser redirects to `/dashboard` (which 404s until Task 11).

- [ ] **Step 7: Commit**

```bash
git add business/
git commit -m "feat(business): add Privy provider and login page"
```

---

## Task 11: API client and dashboard invoice list

**Files:**
- Create: `business/lib/api.ts`, `business/lib/format.ts`, `business/app/dashboard/page.tsx`
- Test: `business/lib/format.test.ts`

**Interfaces:**
- Consumes: server routes from Tasks 3, 6, 7; Privy session from Task 10
- Produces: `formatUsdc(base: bigint): string`, `parseUsdcInput(value: string): bigint`; `useApi()` returning `{ registerBusiness, listInvoices, createInvoice }`; `interface Invoice`

- [ ] **Step 1: Add a test runner and write the failing test**

```bash
cd business
npm install -D vitest
```

Add to `business/package.json` scripts: `"test": "vitest run"`.

Create `business/lib/format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatUsdc, parseUsdcInput } from './format';

describe('formatUsdc', () => {
  it('renders whole amounts with two decimals', () => {
    expect(formatUsdc(100_000_000n)).toBe('100.00');
  });

  it('shows the nonce tail when present', () => {
    expect(formatUsdc(100_000_417n)).toBe('100.000417');
  });

  it('renders sub-dollar amounts', () => {
    expect(formatUsdc(50_000n)).toBe('0.05');
  });

  it('renders zero', () => {
    expect(formatUsdc(0n)).toBe('0.00');
  });
});

describe('parseUsdcInput', () => {
  it('parses a whole number', () => {
    expect(parseUsdcInput('100')).toBe(100_000_000n);
  });

  it('parses cents', () => {
    expect(parseUsdcInput('12.50')).toBe(12_500_000n);
  });

  it('rejects more than six decimal places', () => {
    expect(() => parseUsdcInput('1.0000001')).toThrow();
  });

  it('rejects a non-numeric value', () => {
    expect(() => parseUsdcInput('abc')).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd business && npx vitest run lib/format.test.ts`
Expected: FAIL — cannot find module `./format`

- [ ] **Step 3: Write the formatter**

Create `business/lib/format.ts`:

```typescript
export const USDC_DECIMALS = 6;

/**
 * Renders micro-USDC for display. Trailing zeros collapse to two decimals,
 * so a nonce tail like 100.000417 stays visible while 100.000000 reads 100.00.
 */
export function formatUsdc(base: bigint): string {
  const scale = 10n ** BigInt(USDC_DECIMALS);
  const whole = base / scale;
  const fraction = (base % scale).toString().padStart(USDC_DECIMALS, '0');
  const trimmed = fraction.replace(/0+$/, '');
  const decimals = trimmed.length <= 2 ? fraction.slice(0, 2) : fraction;
  return `${whole}.${decimals}`;
}

export function parseUsdcInput(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error('Enter an amount with at most 6 decimal places');
  }
  const [whole, fraction = ''] = trimmed.split('.');
  return (
    BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) +
    BigInt(fraction.padEnd(USDC_DECIMALS, '0'))
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd business && npx vitest run lib/format.test.ts`
Expected: PASS, 8 tests

- [ ] **Step 5: Write the API client**

Create `business/lib/api.ts`:

```typescript
'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type InvoiceStatus =
  | 'PENDING' | 'PROCESSING' | 'PAID' | 'EXPIRED' | 'UNDERPAID' | 'FAILED';

export interface Invoice {
  id: string;
  amountBase: string;   // BigInt serialized as a string
  payableBase: string;
  recipient: string;
  destChain: string;
  asset: string;
  status: InvoiceStatus;
  description: string | null;
  destTxHash: string | null;
  expiresAt: string;
  createdAt: string;
}

export function useApi() {
  const { getAccessToken } = usePrivy();
  const { wallets } = useWallets();

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

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`${response.status}: ${body}`);
      }
      return response.json() as Promise<T>;
    },
    [getAccessToken],
  );

  /** Idempotent; call after login so the server has a Business row. */
  const registerBusiness = useCallback(
    (name?: string) =>
      request<{ id: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ walletAddress: wallets[0]?.address, name }),
      }),
    [request, wallets],
  );

  const listInvoices = useCallback(() => request<Invoice[]>('/invoices'), [request]);

  const createInvoice = useCallback(
    (amount: string, description?: string) =>
      request<Invoice>('/invoices', {
        method: 'POST',
        body: JSON.stringify({ amount, description }),
      }),
    [request],
  );

  return { registerBusiness, listInvoices, createInvoice };
}
```

- [ ] **Step 6: Write the dashboard**

Create `business/app/dashboard/page.tsx`:

```tsx
'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useApi, type Invoice } from '@/lib/api';
import { formatUsdc } from '@/lib/format';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  EXPIRED: 'bg-zinc-100 text-zinc-600',
  UNDERPAID: 'bg-orange-100 text-orange-800',
  FAILED: 'bg-red-100 text-red-800',
};

export default function Dashboard() {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  const { registerBusiness, listInvoices } = useApi();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  const refresh = useCallback(async () => {
    try {
      await registerBusiness();
      setInvoices(await listInvoices());
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [registerBusiness, listInvoices]);

  useEffect(() => {
    if (!authenticated || wallets.length === 0) return;
    void refresh();
    // The watcher marks invoices paid out of band, so poll for status changes.
    const timer = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(timer);
  }, [authenticated, wallets.length, refresh]);

  if (!ready || !authenticated) return null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 font-mono text-xs text-zinc-500">{wallets[0]?.address}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/dashboard/invoices/new"
            className="rounded-full bg-black px-4 py-2 text-sm text-white"
          >
            New invoice
          </Link>
          <button onClick={logout} className="text-sm text-zinc-500">Log out</button>
        </div>
      </header>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      <ul className="mt-8 divide-y divide-zinc-200 border-t border-zinc-200">
        {invoices.map((invoice) => (
          <li key={invoice.id} className="flex items-center justify-between py-4">
            <div>
              <Link href={`/i/${invoice.id}`} className="font-medium hover:underline">
                {formatUsdc(BigInt(invoice.amountBase))} USDC
              </Link>
              <p className="text-sm text-zinc-500">
                {invoice.description ?? 'No description'}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                STATUS_STYLES[invoice.status] ?? ''
              }`}
            >
              {invoice.status}
            </span>
          </li>
        ))}
      </ul>

      {invoices.length === 0 && !error && (
        <p className="mt-8 text-sm text-zinc-500">No invoices yet.</p>
      )}
    </main>
  );
}
```

- [ ] **Step 7: Verify in the browser**

Start the server (`cd server && npm run start:dev`) and the dashboard (`cd business && npm run dev`).
Log in at `http://localhost:3000`.
Expected: redirect to `/dashboard`, wallet address shown, "No invoices yet."

- [ ] **Step 8: Commit**

```bash
git add business/
git commit -m "feat(business): add API client and invoice dashboard"
```

---

## Task 12: Create invoice page

**Files:**
- Create: `business/app/dashboard/invoices/new/page.tsx`
- Test: manual (browser)

**Interfaces:**
- Consumes: `useApi().createInvoice` and `parseUsdcInput` (Task 11)
- Produces: route `/dashboard/invoices/new`, which redirects to `/i/<id>` on success

- [ ] **Step 1: Write the page**

Create `business/app/dashboard/invoices/new/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApi } from '@/lib/api';
import { parseUsdcInput } from '@/lib/format';

export default function NewInvoice() {
  const router = useRouter();
  const { createInvoice } = useApi();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      parseUsdcInput(amount); // validate before hitting the network
    } catch (cause) {
      setError((cause as Error).message);
      return;
    }

    setSubmitting(true);
    try {
      const invoice = await createInvoice(amount, description || undefined);
      router.push(`/i/${invoice.id}`);
    } catch (cause) {
      setError((cause as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
      <p className="mt-2 text-sm text-zinc-600">
        You receive USDC on Arc, whatever the customer pays with.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Amount (USDC)</span>
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="100.00"
            required
            className="rounded-lg border border-zinc-300 px-4 py-3 text-lg"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">Description (optional)</span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={280}
            placeholder="Order #1234"
            className="rounded-lg border border-zinc-300 px-4 py-3"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-black px-6 py-3 text-white disabled:opacity-40"
        >
          {submitting ? 'Creating…' : 'Create invoice'}
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Verify in the browser**

With both apps running, go to `/dashboard/invoices/new`, enter `100`, and submit.
Expected: redirect to `/i/<id>`. The invoice appears on the dashboard as `PENDING`.
Also confirm that entering `1.0000001` shows the decimal-places error without a network call.

- [ ] **Step 3: Commit**

```bash
git add business/
git commit -m "feat(business): add create invoice page"
```

---

## Task 13: Public invoice page with QR code

**Files:**
- Create: `business/app/i/[id]/page.tsx`, `business/app/i/[id]/invoice-view.tsx`
- Test: manual (browser)

**Interfaces:**
- Consumes: `GET /public/invoices/:id` (Task 7), `formatUsdc` (Task 11)
- Produces: route `/i/<id>` — the shareable payment page

The page is a server component that awaits `params` (Next 16), fetches the invoice, and hands it to a client component for the QR code and polling.

- [ ] **Step 1: Write the client view**

Create `business/app/i/[id]/invoice-view.tsx`:

```tsx
'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';
import { formatUsdc } from '@/lib/format';

export interface PublicInvoice {
  id: string;
  businessName: string | null;
  amountBase: string;
  payableBase: string;
  recipient: string;
  destChain: string;
  asset: string;
  status: string;
  description: string | null;
  expiresAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function InvoiceView({ initial }: { initial: PublicInvoice }) {
  const [invoice, setInvoice] = useState(initial);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (invoice.status === 'PAID') return;
    const timer = setInterval(async () => {
      const response = await fetch(`${API_URL}/public/invoices/${invoice.id}`);
      if (response.ok) setInvoice(await response.json());
    }, 10_000);
    return () => clearInterval(timer);
  }, [invoice.id, invoice.status]);

  const shareUrl = typeof window === 'undefined' ? '' : window.location.href;

  if (invoice.status === 'PAID') {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
        <div className="text-5xl">&#10003;</div>
        <h1 className="text-2xl font-semibold">Paid</h1>
        <p className="text-zinc-600">
          {formatUsdc(BigInt(invoice.amountBase))} USDC received on Arc
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
      <p className="text-sm text-zinc-500">{invoice.businessName ?? 'UniPay merchant'}</p>
      <h1 className="mt-1 text-4xl font-semibold tracking-tight">
        {formatUsdc(BigInt(invoice.payableBase))} USDC
      </h1>
      {invoice.description && <p className="mt-2 text-zinc-600">{invoice.description}</p>}

      <div className="mt-8 flex justify-center rounded-2xl border border-zinc-200 p-8">
        <QRCodeSVG value={shareUrl} size={200} />
      </div>

      <dl className="mt-8 space-y-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-zinc-500">Receive on</dt>
          <dd>Arc</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Asset</dt>
          <dd>{invoice.asset}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="shrink-0 text-zinc-500">To</dt>
          <dd className="truncate font-mono text-xs">{invoice.recipient}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-zinc-500">Status</dt>
          <dd>{invoice.status}</dd>
        </div>
      </dl>

      <button
        onClick={() => {
          void navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-8 w-full rounded-full border border-zinc-300 px-6 py-3"
      >
        {copied ? 'Copied' : 'Copy payment link'}
      </button>

      <p className="mt-6 text-center text-xs text-zinc-500">
        Pay the exact amount shown. The trailing digits identify this invoice.
      </p>
    </main>
  );
}
```

The closing note is load-bearing: the sub-cent nonce is what lets the watcher tell two same-value invoices apart, so the customer must not round it off.

- [ ] **Step 2: Write the server component**

Create `business/app/i/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { InvoiceView, type PublicInvoice } from './invoice-view';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default async function InvoicePage(props: PageProps<'/i/[id]'>) {
  const { id } = await props.params;

  const response = await fetch(`${API_URL}/public/invoices/${id}`, { cache: 'no-store' });
  if (!response.ok) notFound();

  const invoice = (await response.json()) as PublicInvoice;
  return <InvoiceView initial={invoice} />;
}
```

- [ ] **Step 3: Verify in the browser**

Create an invoice, then open `/i/<id>` in a private window (no login).
Expected: the amount includes the nonce tail (e.g. `100.000417`), a QR code renders, the copy button works, and an unknown id 404s.

- [ ] **Step 4: End-to-end settlement check**

With both apps running and a business logged in:

1. Note the merchant wallet address on the dashboard.
2. Create an invoice for a small amount, e.g. `0.10`.
3. Open `/i/<id>` and note the exact payable amount (e.g. `0.100417`).
4. Fund a separate Arc testnet wallet from `https://faucet.circle.com`.
5. Send **exactly** that amount of USDC on Arc to the merchant address.
6. Within ~30 seconds the invoice page flips to **Paid** and the dashboard row shows `PAID`.

Expected: status reaches `PAID` with `destTxHash` set. If it does not, check the server logs for `ArcWatcherService` errors and confirm the amount matched to the last decimal place.

- [ ] **Step 5: Run all tests**

```bash
cd server && npm test
cd ../business && npm test
```
Expected: PASS in both.

- [ ] **Step 6: Commit**

```bash
git add business/
git commit -m "feat(business): add public invoice page with QR code"
```

---

## Task 14: Invoice expiry and nonce release

**Files:**
- Create: `server/src/invoices/invoice-expiry.service.ts`
- Modify: `server/src/invoices/invoices.module.ts`
- Test: `server/src/invoices/invoice-expiry.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 1), `isOpen` (Task 4)
- Produces: `InvoiceExpiryService.expireOnce(now?: Date): Promise<number>` returning the number of invoices expired

Server-side and independent of the UI — it only needs Task 6, so it may be done any time after that.

Spec §10 states that nonces are released when an invoice reaches `PAID` or `EXPIRED`. The watcher releases them on `PAID` (Task 9), but nothing reaches `EXPIRED`. Without this task, every abandoned invoice holds its `activeNonce` forever and a merchant permanently loses that slot — after 9,999 abandoned invoices, `NonceSpaceExhaustedError` blocks all new ones.

- [ ] **Step 1: Write the failing test**

Create `server/src/invoices/invoice-expiry.service.spec.ts`:

```typescript
import { InvoiceStatus } from '@prisma/client';
import { InvoiceExpiryService } from './invoice-expiry.service';

describe('InvoiceExpiryService.expireOnce', () => {
  const prisma = { invoice: { updateMany: jest.fn() } };
  const service = new InvoiceExpiryService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.invoice.updateMany.mockResolvedValue({ count: 3 });
  });

  it('expires only open invoices past their expiry', async () => {
    const now = new Date('2026-09-08T12:00:00Z');

    expect(await service.expireOnce(now)).toBe(3);

    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        status: { in: [InvoiceStatus.PENDING, InvoiceStatus.PROCESSING, InvoiceStatus.UNDERPAID] },
        expiresAt: { lt: now },
      },
      data: { status: InvoiceStatus.EXPIRED, activeNonce: null },
    });
  });

  it('releases the active nonce so the slot is reusable', async () => {
    await service.expireOnce(new Date());
    const [{ data }] = prisma.invoice.updateMany.mock.calls[0];
    expect(data.activeNonce).toBeNull();
  });

  it('never expires an invoice that is already paid', async () => {
    await service.expireOnce(new Date());
    const [{ where }] = prisma.invoice.updateMany.mock.calls[0];
    expect(where.status.in).not.toContain(InvoiceStatus.PAID);
  });

  it('reports zero when nothing is due', async () => {
    prisma.invoice.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.expireOnce(new Date())).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx jest src/invoices/invoice-expiry.service.spec.ts`
Expected: FAIL — cannot find module `./invoice-expiry.service`

- [ ] **Step 3: Write the implementation**

Create `server/src/invoices/invoice-expiry.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isOpen } from './invoice-state';

const OPEN_STATUSES = Object.values(InvoiceStatus).filter(isOpen);

/**
 * Closes invoices past their expiry and releases their amount nonce back to
 * the pool. Without this the nonce space leaks: an abandoned invoice would
 * hold its slot forever (spec §10).
 *
 * A paid invoice is never expired — PAID is terminal, and the status filter
 * here excludes it.
 */
@Injectable()
export class InvoiceExpiryService {
  private readonly logger = new Logger(InvoiceExpiryService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron(): Promise<void> {
    try {
      const expired = await this.expireOnce();
      if (expired > 0) this.logger.log(`Expired ${expired} invoice(s)`);
    } catch (error) {
      this.logger.error('Invoice expiry sweep failed', error as Error);
    }
  }

  async expireOnce(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.invoice.updateMany({
      where: { status: { in: OPEN_STATUSES }, expiresAt: { lt: now } },
      data: { status: InvoiceStatus.EXPIRED, activeNonce: null },
    });
    return count;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx jest src/invoices/invoice-expiry.service.spec.ts`
Expected: PASS, 4 tests

- [ ] **Step 5: Register the service**

Add `InvoiceExpiryService` to the `providers` array in `server/src/invoices/invoices.module.ts` and import it at the top of the file.

- [ ] **Step 6: Run the full suite**

Run: `cd server && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/
git commit -m "feat(server): expire stale invoices and release their nonce"
```

---

## Definition of done

- A business logs in with Privy, connecting an existing wallet or creating one.
- The business creates an invoice and gets a shareable link and QR code.
- A customer opens the link with no account and sees the exact amount to pay.
- Sending that exact USDC amount on Arc flips the invoice to `PAID` within ~30 seconds.
- `POST /public/invoices/:id/payments` exists and is documented for the consumer app; nothing depends on it.
- Abandoned invoices expire on schedule and return their amount nonce to the pool.
- No private keys, seed phrases, or recovery phrases are stored anywhere.
- No file under `client/` has been modified.

## Follow-on plans

- **Plan 2 — ENS Identity:** ENSv2 Sepolia registration, `unipay.*` records, business subregistry, employee subnames.
- **Plan 3 — Payroll:** server-prepared routes, client-signed batch execution over CCTP EVM chains.
