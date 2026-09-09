import { loadConfiguration } from './configuration';

const validEnv = {
  DATABASE_URL: 'postgresql://localhost:5432/unipay',
  ENCRYPTION_MASTER_KEY: Buffer.alloc(32, 1).toString('base64'),
  PRIVY_APP_ID: 'app-id',
  PRIVY_APP_SECRET: 'app-secret',
  MERCHANT_TREASURY_ADDRESS: '0x127c1A164b00639FAA338E38F3150b12D313420A',
};

describe('loadConfiguration', () => {
  it('returns typed config when every required variable is present', () => {
    const config = loadConfiguration(validEnv as NodeJS.ProcessEnv);
    expect(config.databaseUrl).toBe('postgresql://localhost:5432/unipay');
    expect(config.privy.appId).toBe('app-id');
  });

  it('throws naming the variable when one is missing', () => {
    const { PRIVY_APP_SECRET, ...incomplete } = validEnv;
    expect(() => loadConfiguration(incomplete as NodeJS.ProcessEnv)).toThrow(
      /PRIVY_APP_SECRET/,
    );
  });

  it('rejects a master key that is not 32 bytes', () => {
    const badEnv = { ...validEnv, ENCRYPTION_MASTER_KEY: Buffer.alloc(16).toString('base64') };
    expect(() => loadConfiguration(badEnv as NodeJS.ProcessEnv)).toThrow(/32 bytes/);
  });
});
