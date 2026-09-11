'use client';

import { useState } from 'react';
import { Button } from './button';

/**
 * A labelled value with a copy button. Addresses and payment links are
 * the two things in this app a merchant needs out of the browser and
 * into something else.
 */
type CopyState = 'idle' | 'copied' | 'failed';

const LABEL: Record<CopyState, string> = {
  idle: 'Copy',
  copied: 'Copied',
  failed: 'Copy failed',
};

export function CopyRow({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState<CopyState>('idle');

  return (
    <div>
      <p className="text-label uppercase text-muted">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-control border border-line bg-surface-sunken px-2 py-1.5 font-mono text-caption">
          {value}
        </code>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            try {
              if (!navigator.clipboard?.writeText) throw new Error('unavailable');
              await navigator.clipboard.writeText(value);
              setState('copied');
            } catch {
              // Clipboard access is missing (insecure context, some webviews)
              // or the write itself rejected. The value stays selectable on
              // screen as a fallback, but the button still has to say so:
              // its label is the only feedback this control gives, so a
              // silent failure reads as a silent success.
              setState('failed');
            } finally {
              setTimeout(() => setState('idle'), 2000);
            }
          }}
        >
          {LABEL[state]}
        </Button>
      </div>
    </div>
  );
}
