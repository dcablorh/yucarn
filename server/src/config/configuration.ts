export interface AppConfig {
  databaseUrl: string;
  encryptionMasterKey: Buffer;
  privy: { appId: string; appSecret: string };
  merchantTreasuryAddress: string;
  sepoliaRpcUrl: string;
  port: number;
  corsOrigins: string[];
}

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function loadConfiguration(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const masterKey = Buffer.from(required(env, 'ENCRYPTION_MASTER_KEY'), 'base64');
  if (masterKey.length !== 32) {
    throw new Error('ENCRYPTION_MASTER_KEY must decode to exactly 32 bytes');
  }

  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    encryptionMasterKey: masterKey,
    privy: {
      appId: required(env, 'PRIVY_APP_ID'),
      appSecret: required(env, 'PRIVY_APP_SECRET'),
    },
    merchantTreasuryAddress: required(env, 'MERCHANT_TREASURY_ADDRESS'),
    // ENS lives on Sepolia. Invoices and settlement stay on Arc; this URL
    // is only ever used for read calls and gas estimates against ENS.
    sepoliaRpcUrl: env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia-rpc.publicnode.com',
    port: Number(env.PORT ?? 3001),
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
  };
}
