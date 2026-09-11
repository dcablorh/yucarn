'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { linkClass } from '@/components/button';
import { sepolia } from 'viem/chains';
import { arcTestnet } from '@/lib/chains';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// PrivyProvider throws synchronously when its appId isn't a real Privy app
// ID. That throw happens during static prerendering too, which fails `next
// build` for anyone who hasn't set up Privy credentials yet. Guard against
// that by rendering a setup-required screen instead of PrivyProvider (and
// its children) whenever the app ID is missing or still the local
// placeholder — the login page must never mount without a real provider,
// since it calls usePrivy(), which throws outside one.
const isConfigured =
  !!PRIVY_APP_ID && PRIVY_APP_ID !== 'placeholder-privy-app-id';

export function Providers({ children }: { children: React.ReactNode }) {
  if (!isConfigured) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-title">Configuration required</h1>
        <p className="max-w-md text-muted">
          Yucarn for Business needs a Privy app ID to run.
        </p>
        <p className="max-w-md text-body text-muted">
          Set <code className="rounded-control bg-surface-sunken px-1.5 py-0.5 font-mono text-ink">NEXT_PUBLIC_PRIVY_APP_ID</code> in{' '}
          <code className="rounded-control bg-surface-sunken px-1.5 py-0.5 font-mono text-ink">business/.env.local</code>, using an
          app ID from{' '}
          <a
            href="https://dashboard.privy.io"
            className={linkClass()}
          >
            dashboard.privy.io
          </a>
          .
        </p>
      </main>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID!}
      config={{
        // Businesses may connect an existing wallet or have one created.
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
        defaultChain: arcTestnet,
        // Sepolia is here only so a merchant can register an ENS name.
        // Invoices and settlement stay entirely on Arc — nothing in the
        // payment path touches Sepolia, and Arc stays the default chain.
        supportedChains: [arcTestnet, sepolia],
        appearance: { theme: 'light', walletChainType: 'ethereum-only' },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
