// Production server for the built landing page.
//
// `vite build` emits dist/server/server.js as a bare `{ fetch }` handler with
// no listener, and that handler only renders routes; it does not serve the
// fingerprinted assets or public/ files in dist/client. This file does both:
// static files first, SSR for everything else.
import { statSync } from "node:fs";
import { join, normalize } from "node:path";

import handler from "./dist/server/server.js";

const clientDir = join(import.meta.dir, "dist", "client");

function staticFile(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const filePath = normalize(join(clientDir, decoded));
  // normalize() resolves `..`, so anything that escaped dist/client fails here.
  if (!filePath.startsWith(clientDir + "/")) return null;
  try {
    return statSync(filePath).isFile() ? filePath : null;
  } catch {
    return null;
  }
}

const server = Bun.serve({
  hostname: "0.0.0.0",
  port: Number(process.env.PORT ?? 3000),
  async fetch(request) {
    if (request.method === "GET" || request.method === "HEAD") {
      const { pathname } = new URL(request.url);
      const filePath = staticFile(pathname);
      if (filePath) {
        // Vite fingerprints everything under /assets/, so it never goes stale.
        const headers: Record<string, string> = pathname.startsWith("/assets/")
          ? { "cache-control": "public, max-age=31536000, immutable" }
          : {};
        return new Response(Bun.file(filePath), { headers });
      }
    }
    return handler.fetch(request, {}, {});
  },
});

console.log(`[landingpage] listening on ${server.url}`);
