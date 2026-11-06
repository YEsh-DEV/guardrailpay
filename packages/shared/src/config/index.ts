import { z } from 'zod';
import { ConfigurationError } from '../errors/index.js';

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  DATABASE_URL: z.string().url().optional().default('postgresql://postgres:postgres@localhost:5432/quoteseal'),

  SEPOLIA_RPC_URL_PRIMARY: z.string().url().default('https://ethereum-sepolia-rpc.publicnode.com'),
  SEPOLIA_RPC_URL_SECONDARY: z.string().url().default('https://gateway.tenderly.co/public/sepolia'),
  FINALITY_CONFIRMATIONS: z.coerce.number().int().nonnegative().default(2),
  MAX_BLOCK_DIVERGENCE_TOLERANCE: z.coerce.number().int().nonnegative().default(3),

  ENS_REGISTRY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2'),
  ENS_RESOLVER_FACTORY_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef'),
  ROTATION_CONTROLLER_ADDRESS: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .default('0x0000000000000000000000000000000000000000'),

  APPLICATION_CHAIN_ID: z.coerce.number().int().positive().default(11155111),
  MAX_PAYMENT_AMOUNT_DEFAULT: z.string().default('500000000'),
  ROTATION_TIMELOCK_SECONDS: z.coerce.number().int().positive().default(86400),

  OPERATOR_SUBJECT_HMAC_SECRET: z.string().min(16).default('sample_32_byte_hmac_secret_for_subject_hashing_min32'),
  ENCRYPTION_KEY_HEX: z.string().length(64).default('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'),

  // World ID OIDC Configuration
  WORLD_ID_ISSUER: z.string().url().default('https://auth.world.org'),
  WORLD_ID_CLIENT_ID: z.string().default('app_sample_quoteseal_world_id'),
  WORLD_ID_CLIENT_SECRET: z.string().optional(),
  WORLD_ID_REDIRECT_URI: z.string().url().default('http://localhost:4000/v1/world/callback'),
  WORLD_ID_REQUIRED_ACR: z.string().default('orb'),
  WORLD_ID_MAX_AUTH_AGE_SECONDS: z.coerce.number().int().positive().default(120),

  // Backend Attestor Configuration
  ATTESTOR_PRIVATE_KEY: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .default('0x1111111111111111111111111111111111111111111111111111111111111111'),
  ATTESTATION_TTL_SECONDS: z.coerce.number().int().positive().default(300)
}).refine(
  (data) => {
    if (data.NODE_ENV === 'production') {
      if (data.ATTESTOR_PRIVATE_KEY === '0x1111111111111111111111111111111111111111111111111111111111111111') {
        return false;
      }
      if (data.OPERATOR_SUBJECT_HMAC_SECRET === 'sample_32_byte_hmac_secret_for_subject_hashing_min32') {
        return false;
      }
    }
    return true;
  },
  {
    message: 'Production deployment requires real, non-default ATTESTOR_PRIVATE_KEY and OPERATOR_SUBJECT_HMAC_SECRET'
  }
);

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): EnvConfig {
  const result = EnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new ConfigurationError(`Environment validation failed: ${issues}`, {
      issues: result.error.issues
    });
  }
  return result.data;
}
