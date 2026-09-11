'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useSyncExternalStore } from 'react';
import { Card } from '@/components/card';
import { CopyRow } from '@/components/copy-row';
import { linkClass } from '@/components/button';

// The origin never changes during the page's lifetime, so there is nothing to
// subscribe to. This store exists only to give React distinct server and
// client snapshots: window is undefined while rendering on the server, and
// computing the URL during render would make the two disagree.
const noopSubscribe = () => () => {};
const getServerOrigin = () => '';
const getClientOrigin = () => window.location.origin;

/**
 * The merchant's half of an invoice: the link a customer opens and the QR
 * that carries it. Both belong here rather than on /i/[id] — that page is
 * what the customer already has open, so a QR of its own URL asks them to
 * scan the page they are looking at.
 */
export function ShareCard({ invoiceId }: { invoiceId: string }) {
  const origin = useSyncExternalStore(noopSubscribe, getClientOrigin, getServerOrigin);

  const path = `/i/${invoiceId}`;
  const shareUrl = origin ? `${origin}${path}` : '';

  return (
    <Card className="mt-6">
      <h2 className="text-label uppercase text-muted">Share with your customer</h2>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-start">
        <Card padded={false} className="shrink-0 self-center p-4 sm:self-start">
          {/* shareUrl is '' on the server and the client's first render, and
              QRCodeSVG renders an empty code for an empty value. The
              placeholder holds the 144px square so nothing jumps. */}
          {shareUrl ? (
            // QRCodeSVG defaults to a true #FFFFFF background. That stays
            // as-is rather than the app's off-white surface token, because
            // a scanner needs full contrast against the code's modules.
            <QRCodeSVG value={shareUrl} size={144} />
          ) : (
            <div className="h-36 w-36 rounded-control bg-surface-sunken" />
          )}
        </Card>

        <div className="min-w-0 flex-1">
          <p className="text-muted">
            Opening this link connects the customer&apos;s wallet and pays the invoice. They
            can pay with any wallet; you receive USDC on Arc.
          </p>

          <div className="mt-4">
            {shareUrl ? (
              <CopyRow label="Payment link" value={shareUrl} />
            ) : (
              // Same instant the server snapshot ('') would otherwise flash:
              // useSyncExternalStore resolves the real origin on the client's
              // first render, so this bare fallback is never actually seen —
              // it exists only so nothing tries to copy an empty string.
              <p className="text-label uppercase text-muted">Payment link</p>
            )}
          </div>

          <a href={path} target="_blank" rel="noreferrer" className={linkClass('mt-4 inline-block')}>
            Preview the payment page
          </a>
        </div>
      </div>
    </Card>
  );
}
