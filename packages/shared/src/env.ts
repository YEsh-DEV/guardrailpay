import { config } from 'dotenv';
import { z } from 'zod';
import { ConfigurationError } from './errors.js';

config();

export const EnvSchema = z.object({
  // Ethereum / ENS
  SEPOLIA_RPC_URL: z.string().url().default('https://rpc.sepolia.org'),
  ENS_MERCHANT_NAME: z.string().default('researchpro.eth'),
  ROTATION_CONTROLLER_ADDRESS: z.string().default('0x0000000000000000000000000000000000000000'),
  DEPLOYER_PRIVATE_KEY: z.string().optional(),

  // Hedera
  HEDERA_NETWORK: z.enum(['testnet', 'mainnet', 'previewnet']).default('testnet'),
  HEDERA_BUYER_ACCOUNT_ID: z.string().optional(),
  HEDERA_BUYER_PRIVATE_KEY: z.string().optional(),
  HEDERA_MERCHANT_ACCOUNT_ID: z.string().optional(),
  HEDERA_MERCHANT_PRIVATE_KEY: z.string().optional(),
  FACILITATOR_URL: z.string().url().default('https://testnet.facilitator.x402.org'),
  HCS_TOPIC_ID: z.string().optional(),

  // World ID Agent Pass
  WORLD_OIDC_ISSUER: z.string().url().default('https://auth.world.org'),
  WORLD_CLIENT_ID: z.string().default('app_staging_quoteseal'),
  WORLD_CLIENT_SECRET: z.string().optional(),
  WORLD_REDIRECT_URI: z.string().url().default('http://localhost:3001/world/callback'),

  // App Settings
  PORT: z.coerce.number().default(3001),
  MERCHANT_API_URL: z.string().url().default('http://localhost:3001'),
  ATTACK_PROXY_PORT: z.coerce.number().default(3002),
  ATTACK_PROXY_URL: z.string().url().default('http://localhost:3002'),
  DATABASE_URL: z.string().default('file:./quoteseal.db'),
  BUYER_MAX_AMOUNT: z.coerce.bigint().default(1000000000n),
  ROTATION_DELAY_SECONDS: z.coerce.number().default(90),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(override?: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse({ ...process.env, ...override });
  if (!result.success) {
    const errorDetails = result.error.format();
    throw new ConfigurationError('Failed to parse environment variables', errorDetails);
  }
  return result.data;
}
