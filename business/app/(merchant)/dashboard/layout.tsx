'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/alert';
import { Button } from '@/components/button';
import { ApiError, useApi, type Business } from '@/lib/api';
import { BusinessProvider } from '@/lib/business-context';
import { Nav } from './nav';

/** 0x1234…abcd — enough to recognise a wallet where a full address won't fit. */
function shortenAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}\u2026${address.slice(-4)}` : address;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, logout } = usePrivy();
  const { wallets } = useWallets();
  const router = useRouter();
  const { registerBusiness, getMe } = useApi();

  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the retry button. Clearing startedRef alone would not restart
  // anything: React re-runs an effect only when a DEPENDENCY changes, and
  // setError(null) changes none of them — the page would just fall through
  // to "Loading your account…" with no request in flight. This counter is
  // the dependency that makes a retry actually retry.
  const [retry, setRetry] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (ready && !authenticated) router.replace('/');
  }, [ready, authenticated, router]);

  // Loads the merchant's business, and registers one only if none exists.
  //
  // Reading before writing is the whole point. POST /auth/register upserts
  // Business.walletAddress, so calling it on every mount would overwrite the
  // stored payout address with whichever wallet Privy happens to surface
  // this session — a merchant who onboarded with MetaMask and later signs in
  // with email would silently redirect every future invoice to her embedded
  // wallet. GET /auth/me returns 401 from PrivyAuthGuard when (and only when)
  // no Business row exists, so that is the one case where registering is
  // correct. A deliberate payout change goes through Settings.
  //
  // startedRef is set synchronously, before the first await, so no amount of
  // dependency churn can start a second attempt. There is deliberately no
  // cleanup flag discarding a late result: this effect never re-issues its
  // request, so a "cancelled" guard could only throw away the single
  // response we need — which is what happens under React Strict Mode's
  // mount → cleanup → mount. A setState on an unmounted component is a
  // no-op in React 19.
  useEffect(() => {
    if (!authenticated || wallets.length === 0 || business || startedRef.current) return;
    startedRef.current = true;
    setError(null);
    void (async () => {
      try {
        setBusiness(await getMe());
      } catch (cause) {
        if (cause instanceof ApiError && cause.status === 401) {
          // No business yet — this is a first-time merchant, so the
          // connected wallet becomes the payout address.
          try {
            setBusiness(await registerBusiness());
          } catch (registerCause) {
            setError((registerCause as Error).message);
            startedRef.current = false;
          }
          return;
        }
        setError((cause as Error).message);
        startedRef.current = false;
      }
    })();
  }, [authenticated, wallets.length, business, getMe, registerBusiness, retry]);

  const contextValue = useMemo(
    () => (business ? { business, setBusiness } : null),
    [business],
  );

  if (!ready || !authenticated) return null;

  if (!business || !contextValue) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        {error ? (
          <>
            <Alert error={error} className="max-w-md text-left" />
            <div className="mt-2 flex gap-3">
              <Button
                onClick={() => {
                  startedRef.current = false;
                  setError(null);
                  setRetry((attempt) => attempt + 1);
                }}
              >
                Try again
              </Button>
              <Button variant="quiet" onClick={logout}>
                Log out
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted">Loading your account…</p>
        )}
      </main>
    );
  }

  return (
    <BusinessProvider value={contextValue}>
      {/*
       * The shell owns the viewport: it is exactly one screen tall and never
       * scrolls itself, so the sidebar stays put while only the content
       * column moves. The content column carries min-w-0 because a flex item
       * defaults to min-width:auto, which would let a wide table push the
       * whole shell sideways instead of scrolling inside its own box.
       */}
      <div className="flex h-dvh flex-col overflow-hidden bg-surface md:flex-row">
        <aside className="flex shrink-0 flex-col border-b border-line md:h-full md:w-56 md:border-b-0 md:border-r md:px-4 md:py-6">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:block md:px-3 md:py-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/yucarn-icon.png" alt="Yucarn" className="w-6 h-6 rounded-lg object-cover shrink-0" />
              <div className="min-w-0">
                <span className="text-subhead font-semibold tracking-tight text-ink">Yucarn</span>
                <p className="text-label uppercase text-muted md:mt-0.5">Business</p>
              </div>
            </div>
            {/* On a narrow screen the footer block below is hidden, so the
                wallet and log-out ride in the brand row instead. */}
            <div className="flex shrink-0 items-center gap-3 md:hidden">
              <span className="font-mono text-caption text-muted">
                {shortenAddress(business.walletAddress)}
              </span>
              <Button variant="quiet" size="sm" onClick={logout}>
                Log out
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col md:mt-8">
            <Nav />
          </div>

          <div className="hidden border-t border-line pt-4 md:block">
            <p className="truncate px-3 font-mono text-caption text-muted">
              {business.walletAddress}
            </p>
            <Button variant="quiet" size="sm" className="mt-2 px-3" onClick={logout}>
              Log out
            </Button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto bg-canvas">{children}</div>
      </div>
    </BusinessProvider>
  );
}
