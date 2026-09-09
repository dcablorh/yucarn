// server/src/ens/commitment-window.ts
import { MAX_COMMITMENT_AGE_SECS, MIN_COMMITMENT_AGE_SECS } from '../config/ens';

export type CommitmentState = 'too-new' | 'ready' | 'expired';

export interface CommitmentAssessment {
  state: CommitmentState;
  readyAtSecs: number;
  expiresAtSecs: number;
}

/**
 * Where a commitment sits in its window, judged entirely on Sepolia block
 * timestamps. Both arguments must come from the chain: the registrar
 * compares against block.timestamp, so a server or browser clock that
 * disagrees would let us offer a register call the chain then rejects.
 *
 * The window is [committed + 60, committed + 86400). A commitment past the
 * upper bound is dead — the registrar will not honour it, and the only way
 * forward is a fresh secret and a fresh commit.
 */
export function assessCommitment(
  committedAtSecs: number,
  blockNowSecs: number,
): CommitmentAssessment {
  const readyAtSecs = committedAtSecs + MIN_COMMITMENT_AGE_SECS;
  const expiresAtSecs = committedAtSecs + MAX_COMMITMENT_AGE_SECS;

  const state: CommitmentState =
    blockNowSecs >= expiresAtSecs
      ? 'expired'
      : blockNowSecs >= readyAtSecs
        ? 'ready'
        : 'too-new';

  return { state, readyAtSecs, expiresAtSecs };
}
