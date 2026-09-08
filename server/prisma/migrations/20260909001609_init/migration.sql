-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PENDING', 'PROCESSING', 'PAID', 'EXPIRED', 'UNDERPAID', 'FAILED');

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "privyUserId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amountBase" BIGINT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "activeNonce" INTEGER,
    "payableBase" BIGINT NOT NULL,
    "destChain" TEXT NOT NULL DEFAULT 'arc-testnet',
    "asset" TEXT NOT NULL DEFAULT 'USDC',
    "recipient" TEXT NOT NULL,
    "description" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "sourceTxHash" TEXT,
    "destTxHash" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatcherCursor" (
    "chain" TEXT NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatcherCursor_pkey" PRIMARY KEY ("chain")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_privyUserId_key" ON "Business"("privyUserId");

-- CreateIndex
CREATE INDEX "Business_walletAddress_idx" ON "Business"("walletAddress");

-- CreateIndex
CREATE INDEX "Invoice_businessId_status_idx" ON "Invoice"("businessId", "status");

-- CreateIndex
CREATE INDEX "Invoice_status_destChain_idx" ON "Invoice"("status", "destChain");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_businessId_activeNonce_key" ON "Invoice"("businessId", "activeNonce");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
