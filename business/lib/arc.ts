import { createPublicClient, http, type PublicClient } from 'viem';
import { arcTestnet } from './chains';

/**
 * Read-only Arc access from the browser.
 *
 * Arc is the settlement chain: invoices are paid here and payroll pays out
 * here. This client only reads — a balance, a receipt — and never signs.
 *
 * The wallet's own provider is deliberately not used. Its chain is
 * whatever the merchant last switched to, which after an ENS registration
 * is Sepolia, and a balance read against the wrong chain answers
 * confidently and wrongly.
 *
 * Created lazily and cached, mirroring sepoliaClient: one client keeps
 * viem's request de-duplication and block cache working across callers.
 */
let cached: PublicClient | undefined;

export function arcClient(): PublicClient {
  cached ??= createPublicClient({ chain: arcTestnet, transport: http() });
  return cached;
}
