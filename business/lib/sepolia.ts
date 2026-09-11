import { createPublicClient, http, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * Read-only Sepolia access from the browser.
 *
 * ENS lives on Sepolia; invoices and settlement stay on Arc, so this is
 * scoped to the registration flow and never touches a payment path.
 *
 * The wallet's own provider is not used for these reads. It is the thing
 * we are checking up on — whether a transaction it broadcast actually
 * landed, and whether the account it connected has gas at all — and its
 * chain can be anything the merchant last switched to.
 *
 * Created lazily and cached: building a transport is cheap but pointless
 * on a page that never registers a name, and one client keeps viem's
 * request de-duplication and block cache working across callers.
 */
let cached: PublicClient | undefined;

export function sepoliaClient(): PublicClient {
  cached ??= createPublicClient({ chain: sepolia, transport: http() });
  return cached;
}
