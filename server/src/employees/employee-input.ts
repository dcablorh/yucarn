import { isPayoutChain, SUPPORTED_ASSETS } from '../config/payout-chains';

export const EMPLOYEE_NAME_MAX = 120;

export class InvalidEmployeeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEmployeeError';
  }
}

export interface EmployeeInput {
  name: string;
  walletAddress: string;
  prefChain: string;
  prefAsset: string;
}

/**
 * Lowercases an address.
 *
 * Payroll matches employees against on-chain events, and an EVM address has
 * two equally valid spellings — checksummed and lowercase. Storing whichever
 * the merchant happened to paste would make a later string comparison miss
 * an employee who is genuinely there.
 */
export function normaliseAddress(address: string): string {
  return address.toLowerCase();
}

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const ZERO = '0x0000000000000000000000000000000000000000';

export function validateEmployeeInput(input: EmployeeInput): void {
  const name = input.name.trim();
  if (name.length === 0) {
    throw new InvalidEmployeeError('Enter the employee’s name');
  }
  if (name.length > EMPLOYEE_NAME_MAX) {
    throw new InvalidEmployeeError(
      `A name can be at most ${EMPLOYEE_NAME_MAX} characters`,
    );
  }

  if (!ADDRESS.test(input.walletAddress)) {
    throw new InvalidEmployeeError(
      'Enter a wallet address as 0x followed by 40 hex characters',
    );
  }
  if (normaliseAddress(input.walletAddress) === ZERO) {
    // Paying the zero address burns the money. No employee is there.
    throw new InvalidEmployeeError('That address cannot receive a payment');
  }

  if (!isPayoutChain(input.prefChain)) {
    throw new InvalidEmployeeError('Choose a chain Yucarn can pay out on');
  }

  if (!SUPPORTED_ASSETS.includes(input.prefAsset as (typeof SUPPORTED_ASSETS)[number])) {
    throw new InvalidEmployeeError('Yucarn pays in USDC');
  }
}
