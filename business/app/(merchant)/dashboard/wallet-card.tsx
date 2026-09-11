'use client';

import { useEffect, useState } from 'react';
import type { Address } from 'viem';
import { arcClient } from '@/lib/arc';
import { ARC_EXPLORER_URL, ARC_USDC_ADDRESS } from '@/lib/chains';
import { ERC20_ABI } from '@/lib/pay';
import { formatUsdc } from '@/lib/format';
import { Card } from '@/components/card';
import { CopyRow } from '@/components/copy-row';
import { Figure } from '@/components/figure';
import { linkClass } from '@/components/button';

type Balance =
  | { state: 'loading' }
  | { state: 'known'; base: bigint }
  | { state: 'unavailable' };

/**
 * The payout wallet, and what is actually in it.
 *
 * The balance is read from Arc directly rather than derived from invoices
 * and payroll: those tell you what UniPay knows about, and a merchant can
 * move their own funds without telling us. Only the chain knows the
 * number, so only the chain is asked.
 *
 * A failed read renders as unavailable, never as zero. Zero is a fact a
 * merchant would act on — it is the difference between "you cannot run
 * payroll" and "we could not reach Arc just now".
 */
export function WalletCard({ address }: { address: string }) {
  const [balance, setBalance] = useState<Balance>({ state: 'loading' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const base = await arcClient().readContract({
          address: ARC_USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [address as Address],
        });
        if (!cancelled) setBalance({ state: 'known', base });
      } catch {
        if (!cancelled) setBalance({ state: 'unavailable' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, reload]);

  return (
    <Card className="mt-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-label uppercase text-muted">Wallet balance</p>
          {balance.state === 'known' ? (
            <Figure amount={formatUsdc(balance.base)} size="lg" className="mt-2" />
          ) : (
            <Figure
              amount={balance.state === 'loading' ? '—' : 'Unavailable'}
              unit=""
              size="lg"
              tone="muted"
              className="mt-2"
            />
          )}
          <p className="mt-1 text-muted">
            {balance.state === 'unavailable' ? (
              <>
                Could not reach Arc.{' '}
                <button
                  onClick={() => {
                    setBalance({ state: 'loading' });
                    setReload((attempt) => attempt + 1);
                  }}
                  className={linkClass()}
                >
                  Try again
                </button>
              </>
            ) : (
              'On Arc testnet, where invoices settle and payroll pays out.'
            )}
          </p>
        </div>

        <div className="min-w-0 sm:text-right">
          <CopyRow label="Payout address" value={address} />
          <a
            href={`${ARC_EXPLORER_URL}/address/${address}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-muted hover:text-ink"
          >
            View on ArcScan
          </a>
        </div>
      </div>
    </Card>
  );
}
