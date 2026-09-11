/**
 * Where the API lives, resolved per execution context.
 *
 * Once this app runs in a container, the browser and a server component no
 * longer reach the API by the same address. `NEXT_PUBLIC_API_URL` is inlined
 * at build time and is written from the browser's point of view — typically
 * `http://localhost:3001` — but inside the container `localhost` is the
 * Next.js process itself, so a server-side fetch to it hits nothing.
 *
 * Server-side code therefore prefers `INTERNAL_API_URL`, which addresses the
 * API across the container network (`http://server:3001`) and, being a
 * non-public var, is read at runtime rather than baked into the bundle.
 *
 * Outside Docker `INTERNAL_API_URL` is simply unset and both paths collapse
 * back to the public URL, so local `npm run dev` is unaffected.
 */

const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function apiUrl(): string {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL || PUBLIC_API_URL;
  }
  return PUBLIC_API_URL;
}
