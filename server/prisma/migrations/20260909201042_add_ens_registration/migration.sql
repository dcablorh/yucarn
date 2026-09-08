-- CreateEnum
CREATE TYPE "EnsStatus" AS ENUM ('DRAFT', 'REGISTRY_DEPLOYED', 'COMMITTED', 'REGISTERED', 'FAILED');

-- CreateTable
CREATE TABLE "EnsRegistration" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EnsStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerAddress" TEXT NOT NULL,
    "subregistry" TEXT,
    "resolver" TEXT,
    "priceBase" BIGINT NOT NULL,
    "secretEnvelope" TEXT NOT NULL,
    "deployTxHash" TEXT,
    "commitTxHash" TEXT,
    "committedAt" INTEGER,
    "registerTxHash" TEXT,
    "recordsTxHash" TEXT,
    "durationSecs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnsRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnsRegistration_businessId_key" ON "EnsRegistration"("businessId");

-- AddForeignKey
ALTER TABLE "EnsRegistration" ADD CONSTRAINT "EnsRegistration_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
