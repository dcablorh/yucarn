export type ListState = 'loading' | 'error' | 'empty';

export interface ListStateInput {
  /** A request is in flight right now. */
  loading: boolean;
  /** A request has completed successfully at least once. */
  loaded: boolean;
  /** The last reported failure, if any. */
  error?: string | null;
}

/**
 * Decides what an empty list should say.
 *
 * Precedence is loading > error > empty, and `empty` requires `loaded`.
 * That last clause is the important one: `!loading && !loaded` means the
 * API is unreachable, so the list is unknown rather than empty. Telling
 * a merchant "no invoices yet" when we simply could not ask is the
 * worst failure mode this component has.
 */
export function resolveListState({ loading, loaded, error }: ListStateInput): ListState {
  if (loading) return 'loading';
  if (error) return 'error';
  return loaded ? 'empty' : 'error';
}
