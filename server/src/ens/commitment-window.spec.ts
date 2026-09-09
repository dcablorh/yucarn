// server/src/ens/commitment-window.spec.ts
import { assessCommitment } from './commitment-window';

const COMMITTED = 1_800_000_000;

describe('assessCommitment', () => {
  it('is too new one second after committing', () => {
    expect(assessCommitment(COMMITTED, COMMITTED + 1).state).toBe('too-new');
  });

  it('is still too new at 59 seconds', () => {
    expect(assessCommitment(COMMITTED, COMMITTED + 59).state).toBe('too-new');
  });

  it('is ready at exactly 60 seconds', () => {
    // MIN_COMMITMENT_AGE is inclusive: the registrar requires >= 60.
    expect(assessCommitment(COMMITTED, COMMITTED + 60).state).toBe('ready');
  });

  it('is still ready one second before 24 hours', () => {
    expect(assessCommitment(COMMITTED, COMMITTED + 86_399).state).toBe('ready');
  });

  it('is expired at exactly 24 hours', () => {
    // MAX_COMMITMENT_AGE is exclusive: the registrar refuses at 86400.
    expect(assessCommitment(COMMITTED, COMMITTED + 86_400).state).toBe('expired');
  });

  it('is expired long after', () => {
    expect(assessCommitment(COMMITTED, COMMITTED + 200_000).state).toBe('expired');
  });

  it('reports the instants the caller needs for a countdown', () => {
    const result = assessCommitment(COMMITTED, COMMITTED + 10);
    expect(result.readyAtSecs).toBe(COMMITTED + 60);
    expect(result.expiresAtSecs).toBe(COMMITTED + 86_400);
  });

  it('treats a block timestamp before the commitment as too new', () => {
    // Chain reorgs and clock skew between reads can produce this. It is
    // never a reason to let a register call through.
    expect(assessCommitment(COMMITTED, COMMITTED - 5).state).toBe('too-new');
  });
});
