// server/src/ens/ens-label.ts

export const ENS_LABEL_MIN = 3;
export const ENS_LABEL_MAX = 63;

export class InvalidLabelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidLabelError';
  }
}

/**
 * Validates a label before it reaches the registrar.
 *
 * This exists because ETHRegistrar.isAvailable is not a validity check:
 * isAvailable("ab") returns true, and getRegisterPrice("ab") then reverts
 * NotValid(string). Left to the contract, a merchant would see a green
 * check followed by an unexplained revert. The rules below are the
 * conventional .eth label rules and are deliberately no looser than the
 * registrar's own.
 *
 * A label is "acme", never "acme.eth" — the name is built by the caller.
 */
export function validateLabel(label: string): void {
  if (label.length < ENS_LABEL_MIN) {
    throw new InvalidLabelError(
      `A name needs at least ${ENS_LABEL_MIN} characters`,
    );
  }
  if (label.length > ENS_LABEL_MAX) {
    throw new InvalidLabelError(
      `A name can be at most ${ENS_LABEL_MAX} characters`,
    );
  }
  if (label !== label.toLowerCase()) {
    throw new InvalidLabelError('Use lowercase letters only');
  }
  if (!/^[a-z0-9-]+$/.test(label)) {
    throw new InvalidLabelError('Use letters, digits and hyphens only');
  }
  if (label.startsWith('-') || label.endsWith('-')) {
    throw new InvalidLabelError('A name cannot start or end with a hyphen');
  }
}
