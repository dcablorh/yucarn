import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Business, Invoice } from '@prisma/client';
import { InvoiceStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { pickNonce, applyNonce, NonceSpaceExhaustedError } from './amount-nonce';
import { isOpen, assertTransition } from './invoice-state';
import { ARC_CHAIN_KEY, USDC_DECIMALS } from '../config/chains';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';

const OPEN_STATUSES = Object.values(InvoiceStatus).filter(isOpen);
const INVOICE_TTL_MS = 24 * 60 * 60 * 1000;
/** 1 cent in 6-decimal USDC base units. See parseUsdcAmount for why. */
const CENT_BASE = 10_000n;

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

/**
 * "12.5" -> 12_500_000n. Rejects floats and excess precision.
 *
 * Also rejects any amount that is not a whole number of cents. The amount
 * nonce (spec §10) occupies base units 1..9999 — the four decimal places
 * below the cent — to guarantee every open invoice has a unique payable
 * amount. If a merchant-requested amount already used those digits, two
 * invoices could land on the same payable (e.g. 10.00 + nonce 1500 vs.
 * 10.001 + nonce 500), and the watcher would silently credit the wrong one.
 * Requiring whole cents here is what makes the nonce space disjoint from
 * requested amounts.
 */
export function parseUsdcAmount(amount: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) {
    throw new BadRequestException('Amount must be a decimal with at most 6 decimal places');
  }

  const [whole, fraction = ''] = amount.split('.');
  const base =
    BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) +
    BigInt(fraction.padEnd(USDC_DECIMALS, '0'));

  if (base <= 0n) {
    throw new BadRequestException('Amount must be greater than zero');
  }

  if (base % CENT_BASE !== 0n) {
    throw new BadRequestException(
      'Amount must be a whole number of cents (at most 2 decimal places); ' +
        'the sub-cent digits are reserved for the invoice amount nonce',
    );
  }

  return base;
}

/** 9 random bytes -> 12 base64url chars, ~72 bits of entropy (nanoid(12) is ~71 bits). */
export function generateInvoiceId(): string {
  return randomBytes(9).toString('base64url');
}

type InvoiceWithBusinessName = Invoice & { business: { name: string | null } };

/**
 * The one place that projects an Invoice row down to what an unauthenticated
 * caller may see. Strips businessId, nonce, activeNonce, and both tx hashes.
 * Every public-facing return path (GET and POST /public/invoices/:id/...)
 * must go through this, not return the raw Prisma row.
 */
function toPublicInvoice(invoice: InvoiceWithBusinessName): PublicInvoice {
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

    let nonce: number;
    try {
      nonce = pickNonce(taken);
    } catch (error) {
      if (error instanceof NonceSpaceExhaustedError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }

    return this.prisma.invoice.create({
      data: {
        id: generateInvoiceId(),
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

    return toPublicInvoice(invoice);
  }

  /**
   * Called by the consumer checkout app after it broadcasts a payment.
   * Advisory only: it may move PENDING -> PROCESSING and nothing else.
   * Only the Arc watcher may set PAID.
   *
   * Unauthenticated, like getPublic — the response must go through the same
   * PublicInvoice projection rather than returning the raw Prisma row.
   */
  async reportPayment(id: string, sourceTxHash: string): Promise<PublicInvoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { business: { select: { name: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== InvoiceStatus.PENDING) {
      return toPublicInvoice(invoice);
    }

    assertTransition(invoice.status, InvoiceStatus.PROCESSING);

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.PROCESSING, sourceTxHash },
      include: { business: { select: { name: true } } },
    });
    return toPublicInvoice(updated);
  }
}
