// server/src/ens/ens-label.spec.ts
import { validateLabel, InvalidLabelError } from './ens-label';

describe('validateLabel', () => {
  it('accepts a plain lowercase label', () => {
    expect(() => validateLabel('unipaydemo')).not.toThrow();
  });

  it('accepts internal hyphens and digits', () => {
    expect(() => validateLabel('acme-payments-2026')).not.toThrow();
  });

  it('rejects a label shorter than three characters', () => {
    // The registrar agrees: isAvailable("ab") is true but pricing it
    // reverts NotValid(string). We refuse before either call.
    expect(() => validateLabel('ab')).toThrow(InvalidLabelError);
  });

  it('rejects uppercase', () => {
    expect(() => validateLabel('Acme')).toThrow(/lowercase/);
  });

  it('rejects a leading hyphen', () => {
    expect(() => validateLabel('-acme')).toThrow(InvalidLabelError);
  });

  it('rejects a trailing hyphen', () => {
    expect(() => validateLabel('acme-')).toThrow(InvalidLabelError);
  });

  it('rejects a dot, because a label is not a name', () => {
    expect(() => validateLabel('acme.eth')).toThrow(InvalidLabelError);
  });

  it('rejects an empty label', () => {
    expect(() => validateLabel('')).toThrow(InvalidLabelError);
  });

  it('rejects a label longer than 63 characters', () => {
    expect(() => validateLabel('a'.repeat(64))).toThrow(InvalidLabelError);
  });
});
