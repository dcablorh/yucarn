'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApi, type Invoice } from './api';

const POLL_INTERVAL_MS = 10_000;

/**
 * The Arc watcher marks invoices paid out of band, so the list is polled
 * rather than fetched once.
 *
 * This hook deliberately does NOT register the business. Registration
 * upserts Business.walletAddress and must happen exactly once per session
 * in the dashboard layout — running it on a poll could flip the payout
 * address, because useWallets() ordering is not stable between a connected
 * and an embedded wallet.
 */
export function useInvoices() {
  const { listInvoices } = useApi();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Distinct from `loading`: true only once a fetch has actually succeeded.
  // Without it, a failed FIRST fetch leaves invoices as [] with loading
  // false, and the overview renders "Received 0.00 USDC / No invoices yet"
  // — telling a merchant with real invoices that her balance is zero.
  // Later failures are different: there is good data on screen, so they
  // show a banner and keep it.
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setInvoices(await listInvoices());
      setLoaded(true);
      setError(null);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, [listInvoices]);

  useEffect(() => {
    // refresh is async, so every setState inside it lands in a microtask
    // after an await, never synchronously in this effect body. That is what
    // the set-state-in-effect rule targets, so this is a false positive.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { invoices, error, loading, loaded, refresh };
}
