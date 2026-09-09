import {
  validateEmployeeInput,
  normaliseAddress,
  InvalidEmployeeError,
} from './employee-input';

const valid = {
  name: 'John Abiodun',
  walletAddress: '0x1111111111111111111111111111111111111111',
  prefChain: 'arc-testnet',
  prefAsset: 'USDC',
};

describe('validateEmployeeInput', () => {
  it('accepts a complete, valid employee', () => {
    expect(() => validateEmployeeInput(valid)).not.toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => validateEmployeeInput({ ...valid, name: '   ' })).toThrow(
      InvalidEmployeeError,
    );
  });

  it('rejects a name longer than 120 characters', () => {
    expect(() => validateEmployeeInput({ ...valid, name: 'a'.repeat(121) })).toThrow(
      InvalidEmployeeError,
    );
  });

  it('rejects an address that is not 20 bytes of hex', () => {
    expect(() => validateEmployeeInput({ ...valid, walletAddress: '0xabc' })).toThrow(
      /address/i,
    );
  });

  it('rejects an address with no 0x prefix', () => {
    expect(() =>
      validateEmployeeInput({
        ...valid,
        walletAddress: '1111111111111111111111111111111111111111',
      }),
    ).toThrow(/address/i);
  });

  it('rejects the zero address, which is a burn, not a payee', () => {
    expect(() =>
      validateEmployeeInput({
        ...valid,
        walletAddress: '0x0000000000000000000000000000000000000000',
      }),
    ).toThrow(/address/i);
  });

  it('rejects a chain outside the CCTP table', () => {
    expect(() => validateEmployeeInput({ ...valid, prefChain: 'solana' })).toThrow(
      /chain/i,
    );
  });

  it('rejects an unsupported asset', () => {
    expect(() => validateEmployeeInput({ ...valid, prefAsset: 'DAI' })).toThrow(
      /USDC/,
    );
  });

  it('accepts every chain in the table', () => {
    for (const key of [
      'arc-testnet',
      'ethereum-sepolia',
      'avalanche-fuji',
      'op-sepolia',
      'arbitrum-sepolia',
      'base-sepolia',
      'polygon-amoy',
      'unichain-sepolia',
      'linea-sepolia',
    ]) {
      expect(() => validateEmployeeInput({ ...valid, prefChain: key })).not.toThrow();
    }
  });
});

describe('normaliseAddress', () => {
  it('lowercases so two spellings of one address compare equal', () => {
    // Employees are matched against on-chain events later. Storing mixed
    // case would make a string comparison miss.
    expect(normaliseAddress('0xAbCdEf1111111111111111111111111111111111')).toBe(
      '0xabcdef1111111111111111111111111111111111',
    );
  });

  it('leaves an already-lowercase address alone', () => {
    expect(normaliseAddress('0x1111111111111111111111111111111111111111')).toBe(
      '0x1111111111111111111111111111111111111111',
    );
  });
});
