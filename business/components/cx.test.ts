import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins the parts it is given', () => {
    expect(cx('a', 'b')).toBe('a b');
  });

  it('drops the falsy parts a conditional class produces', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });

  it('collapses whitespace so a multi-line base string stays one class list', () => {
    expect(cx('a\n  b', 'c')).toBe('a b c');
  });

  it('returns an empty string when everything is falsy', () => {
    expect(cx(false, undefined)).toBe('');
  });
});
