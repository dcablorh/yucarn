'use client';

import type { Registration } from '@/lib/ens';
import { Card } from '@/components/card';
import { CopyRow } from '@/components/copy-row';
import { linkClass } from '@/components/button';

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io';

/**
 * The finished state. Records are shown explicitly because an address on
 * its own never implies a chain — a customer reading this name needs to
 * see that the payout lands as USDC on Arc.
 */
export function IdentityCard({ registration }: { registration: Registration }) {
  const records: [string, string][] = [
    ['addr', registration.ownerAddress],
    ['unipay.address', registration.ownerAddress],
    ['unipay.chain', 'arc-testnet'],
    ['unipay.asset', 'USDC'],
    ['unipay.label', registration.label],
  ];

  return (
    <div>
      <Card>
        <CopyRow label="Your name" value={registration.name} />
        {registration.registerTxHash && (
          <a
            href={`${SEPOLIA_EXPLORER}/tx/${registration.registerTxHash}`}
            target="_blank"
            rel="noreferrer"
            className={linkClass('mt-3 block truncate font-mono text-caption')}
          >
            {registration.registerTxHash}
          </a>
        )}
      </Card>

      <Card className="mt-6">
        <p className="text-label uppercase text-muted">Records</p>
        <dl className="mt-4 space-y-3">
          {records.map(([key, value]) =>
            key === 'addr' || key === 'unipay.address' ? (
              <CopyRow key={key} label={key} value={value} />
            ) : (
              <div key={key} className="flex justify-between gap-4">
                <dt className="shrink-0 font-mono text-muted">{key}</dt>
                <dd className="min-w-0 truncate font-mono">{value}</dd>
              </div>
            ),
          )}
        </dl>
        {!registration.recordsTxHash && (
          <p className="mt-4 text-muted">
            Records were written in the same transaction as the registration.
          </p>
        )}
      </Card>

      <p className="mt-6 text-muted">
        This name is registered on the ENSv2 Sepolia beta. Wallets that resolve mainnet ENS will
        not find it yet, so nothing in your payment flow depends on it.
      </p>
    </div>
  );
}
