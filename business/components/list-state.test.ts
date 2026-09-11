import { describe, expect, it } from 'vitest';
import { resolveListState } from './list-state';

describe('resolveListState', () => {
  it('reports loading while a request is in flight', () => {
    expect(resolveListState({ loading: true, loaded: false })).toBe('loading');
  });

  it('prefers loading over a stale error, so a retry does not look broken', () => {
    // The retry is already in flight; showing the previous failure here
    // would tell the merchant nothing is happening when something is.
    expect(resolveListState({ loading: true, loaded: false, error: 'boom' })).toBe('loading');
  });

  it('reports an error when one was reported and nothing is in flight', () => {
    expect(resolveListState({ loading: false, loaded: false, error: 'boom' })).toBe('error');
  });

  it('reports an error when the fetch never completed, even with no message', () => {
    // This is the case the old inline ternaries got right and it must be
    // preserved: !loading && !loaded means the API is unreachable, NOT
    // that the merchant has no invoices.
    expect(resolveListState({ loading: false, loaded: false })).toBe('error');
  });

  it('reports empty only once a load has actually succeeded', () => {
    expect(resolveListState({ loading: false, loaded: true })).toBe('empty');
  });

  it('treats a successful reload as empty even if an earlier attempt failed', () => {
    expect(resolveListState({ loading: false, loaded: true, error: null })).toBe('empty');
  });

  it('prefers a failed refresh over a possibly-stale success, so staleness never hides an invoice', () => {
    // We loaded once and saw nothing, then a background refresh failed. EmptyState
    // only renders for empty lists, so this means "we have no current data and know
    // the list is stale". Showing the old empty state would risk hiding an invoice
    // that was just paid. Error outranks a known-stale success.
    expect(resolveListState({ loading: false, loaded: true, error: 'boom' })).toBe('error');
  });
});
