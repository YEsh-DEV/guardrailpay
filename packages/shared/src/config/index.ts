import { z } from 'zod';
import { ConfigurationError } from '../errors/index.js';
import { ROTATION_CONTROLLER_ABI } from '../contracts/abi.js';

const address = z.string().regex(/^0x[a-fA-F0-9]{40}$/);
const hash = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const url = z.string().url();
const isPlaceholderHost = (value: string) => {
  const hostname = new URL(value).hostname.toLowerCase();
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.example')
    || hostname.endsWith('.invalid')
    || hostname.endsWith('.test');
};

export const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_PROFILE: z.enum(['local-development', 'local-e2e', 'testnet-demo', 'production']).optional(),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  DATABASE_URL: url.optional(),
  SEPOLIA_RPC_URL_PRIMARY: url.default('https://ethereum-sepolia-rpc.publicnode.com'),
  SEPOLIA_RPC_URL_SECONDARY: url.default('https://gateway.tenderly.co/public/sepolia'),
  FINALITY_CONFIRMATIONS: z.coerce.number().int().nonnegative().default(2),
  MAX_BLOCK_DIVERGENCE_TOLERANCE: z.coerce.number().int().nonnegative().default(3),

  ENS_REGISTRY_ADDRESS: address.default('0xbdc85dd5b15d7ecb354cd7cb6f2c50b4f2c4f0e2'),
  ENS_RESOLVER_FACTORY_ADDRESS: address.default('0x10dc6333cdfe1fcef624c6e0a8221b91804cd7ef'),
  ENS_MERCHANT_NAME: z.string().min(3).optional(),
  ENS_NAMEHASH: hash.optional(),
  ENS_RESOLVER_ADDRESS: address.optional(),
  ENS_EXPECTED_OWNER: address.optional(),

  ROTATION_CONTROLLER_ADDRESS: address.optional(),
  ROTATION_CONTROLLER_CODE_HASH: hash.optional(),
  APPLICATION_CHAIN_ID: z.coerce.number().int().positive().default(11155111),
  MAX_PAYMENT_AMOUNT_DEFAULT: z.string().regex(/^[1-9][0-9]*$/).default('500000000'),
  ROTATION_TIMELOCK_SECONDS: z.coerce.number().int().positive().default(86400),

  OPERATOR_SUBJECT_HMAC_SECRET: z.string().min(16).default('sample_32_byte_hmac_secret_for_subject_hashing_min32'),
  ENCRYPTION_KEY_HEX: z.string().regex(/^[a-fA-F0-9]{64}$/).default('000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'),

  WORLD_ID_ISSUER: url.default('https://auth.world.org'),
  WORLD_ID_CLIENT_ID: z.string().default('app_sample_quoteseal_world_id'),
  WORLD_ID_CLIENT_SECRET: z.string().optional(),
  WORLD_ID_ACTION: z.string().optional(),
  WORLD_ID_REDIRECT_URI: url.default('http://localhost:4000/v1/world/callback'),
  WORLD_ID_REQUIRED_ACR: z.string().default('orb'),
  WORLD_ID_MAX_AUTH_AGE_SECONDS: z.coerce.number().int().positive().default(120),

  ATTESTOR_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/).default('0x1111111111111111111111111111111111111111111111111111111111111111'),
  ATTESTATION_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  HEDERA_NETWORK: z.enum(['testnet', 'mainnet']).optional(),
  HEDERA_ACCOUNT_ID: z.string().regex(/^0\.0\.[1-9][0-9]*$/).optional(),
  HEDERA_MIRROR_NODE_URL: url.default('https://testnet.mirrornode.hedera.com'),
  X402_FACILITATOR_URL: url.optional(),
  X402_NETWORK: z.enum(['hedera:testnet', 'hedera:mainnet']).optional(),
  X402_SCHEME: z.string().optional(),
  X402_ASSET: z.string().regex(/^0\.0\.(0|[1-9][0-9]*)$/).optional(),
  X402_AMOUNT: z.string().regex(/^[1-9][0-9]*$/).optional()
}).transform((data) => ({
  ...data,
  APP_PROFILE: data.APP_PROFILE ?? (data.NODE_ENV === 'test' ? 'local-e2e' : data.NODE_ENV === 'production' ? 'production' : 'local-development')
})).superRefine((data, ctx) => {
  if (data.DATABASE_URL && !/^postgres(?:ql)?:\/\//i.test(data.DATABASE_URL)) {
    ctx.addIssue({ code: 'custom', path: ['DATABASE_URL'], message: 'DATABASE_URL must use PostgreSQL' });
  }
  const live = data.APP_PROFILE === 'testnet-demo' || data.APP_PROFILE === 'production';
  if (data.APP_PROFILE === 'local-e2e' && data.NODE_ENV !== 'test') {
    ctx.addIssue({ code: 'custom', path: ['APP_PROFILE'], message: 'local-e2e requires NODE_ENV=test' });
  }
  if (data.NODE_ENV === 'test' && data.APP_PROFILE !== 'local-e2e') {
    ctx.addIssue({ code: 'custom', path: ['APP_PROFILE'], message: 'NODE_ENV=test requires APP_PROFILE=local-e2e' });
  }
  if (data.APP_PROFILE === 'local-development' && data.NODE_ENV !== 'development') {
    ctx.addIssue({ code: 'custom', path: ['APP_PROFILE'], message: 'local-development requires NODE_ENV=development' });
  }
  if (data.NODE_ENV === 'production' && data.APP_PROFILE !== 'testnet-demo' && data.APP_PROFILE !== 'production') {
    ctx.addIssue({ code: 'custom', path: ['APP_PROFILE'], message: 'Production NODE_ENV requires a live configuration profile' });
  }
  if (live && data.NODE_ENV !== 'production') {
    ctx.addIssue({ code: 'custom', path: ['NODE_ENV'], message: 'testnet-demo and production require NODE_ENV=production' });
  }
  if (!live) return;

  const required: Array<[keyof typeof data, unknown]> = [
    ['DATABASE_URL', data.DATABASE_URL],
    ['ROTATION_CONTROLLER_ADDRESS', data.ROTATION_CONTROLLER_ADDRESS],
    ['ROTATION_CONTROLLER_CODE_HASH', data.ROTATION_CONTROLLER_CODE_HASH],
    ['ENS_MERCHANT_NAME', data.ENS_MERCHANT_NAME],
    ['ENS_NAMEHASH', data.ENS_NAMEHASH],
    ['ENS_RESOLVER_ADDRESS', data.ENS_RESOLVER_ADDRESS],
    ['ENS_EXPECTED_OWNER', data.ENS_EXPECTED_OWNER],
    ['WORLD_ID_CLIENT_ID', data.WORLD_ID_CLIENT_ID],
    ['WORLD_ID_ACTION', data.WORLD_ID_ACTION],
    ['HEDERA_NETWORK', data.HEDERA_NETWORK],
    ['HEDERA_ACCOUNT_ID', data.HEDERA_ACCOUNT_ID],
    ['X402_FACILITATOR_URL', data.X402_FACILITATOR_URL],
    ['X402_NETWORK', data.X402_NETWORK],
    ['X402_SCHEME', data.X402_SCHEME],
    ['X402_ASSET', data.X402_ASSET],
    ['X402_AMOUNT', data.X402_AMOUNT]
  ];
  for (const [key, value] of required) {
    if (typeof value !== 'string' || value.length === 0) {
      ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required for ${data.APP_PROFILE}` });
    }
  }

  if (data.ROTATION_CONTROLLER_ADDRESS?.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    ctx.addIssue({ code: 'custom', path: ['ROTATION_CONTROLLER_ADDRESS'], message: 'RotationController address must be non-zero' });
  }
  if (data.APPLICATION_CHAIN_ID !== 11155111) {
    ctx.addIssue({ code: 'custom', path: ['APPLICATION_CHAIN_ID'], message: 'Current testnet profiles require Sepolia chain ID 11155111' });
  }
  if (new URL(data.SEPOLIA_RPC_URL_PRIMARY).protocol !== 'https:' || new URL(data.SEPOLIA_RPC_URL_SECONDARY).protocol !== 'https:') {
    ctx.addIssue({ code: 'custom', path: ['SEPOLIA_RPC_URL_PRIMARY'], message: 'Testnet RPC URLs must use HTTPS' });
  }
  if (new URL(data.SEPOLIA_RPC_URL_PRIMARY).host === new URL(data.SEPOLIA_RPC_URL_SECONDARY).host) {
    ctx.addIssue({ code: 'custom', path: ['SEPOLIA_RPC_URL_SECONDARY'], message: 'Primary and secondary RPC hosts must differ' });
  }
  if (!data.ROTATION_CONTROLLER_ADDRESS || !data.ROTATION_CONTROLLER_CODE_HASH) {
    ctx.addIssue({ code: 'custom', path: ['ROTATION_CONTROLLER_ADDRESS'], message: 'Controller address and expected runtime code hash are required' });
  }
  const abiMethods = new Set<string>(ROTATION_CONTROLLER_ABI.filter((item) => item.type === 'function').map((item) => item.name));
  for (const method of ['proposeRotation', 'approveWithAttestation', 'activateRotation', 'getRotationState', 'payoutVerdict']) {
    if (!abiMethods.has(method)) {
      ctx.addIssue({ code: 'custom', path: ['ROTATION_CONTROLLER_ADDRESS'], message: `Committed controller ABI is missing ${method}` });
    }
  }
  if (data.WORLD_ID_CLIENT_ID === 'app_sample_quoteseal_world_id') {
    ctx.addIssue({ code: 'custom', path: ['WORLD_ID_CLIENT_ID'], message: 'World ID sample client ID is not valid for live profiles' });
  }
  if (/sample|placeholder|changeme|your[_-]|example|localhost|(?:^|[_-])test(?:$|[_-])/i.test(data.WORLD_ID_CLIENT_ID)
    || /sample|placeholder|changeme|your[_-]|example|localhost|(?:^|[_-])test(?:$|[_-])/i.test(data.WORLD_ID_ACTION ?? '')) {
    ctx.addIssue({ code: 'custom', path: ['WORLD_ID_CLIENT_ID'], message: 'World ID client and action must not contain placeholder values' });
  }
  for (const key of ['DATABASE_URL', 'SEPOLIA_RPC_URL_PRIMARY', 'SEPOLIA_RPC_URL_SECONDARY', 'WORLD_ID_ISSUER', 'WORLD_ID_REDIRECT_URI', 'HEDERA_MIRROR_NODE_URL', 'X402_FACILITATOR_URL'] as const) {
    const value = data[key];
    if (value && isPlaceholderHost(value)) {
      ctx.addIssue({ code: 'custom', path: [key], message: `${key} must not use a placeholder host` });
    }
  }
  if (data.WORLD_ID_REDIRECT_URI.startsWith('http://')) {
    ctx.addIssue({ code: 'custom', path: ['WORLD_ID_REDIRECT_URI'], message: 'Live World ID callback must use HTTPS' });
  }
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(data.ENS_MERCHANT_NAME ?? '')) {
    ctx.addIssue({ code: 'custom', path: ['ENS_MERCHANT_NAME'], message: 'ENS_MERCHANT_NAME must be a normalized lowercase DNS name' });
  }
  if (data.ENS_MERCHANT_NAME === 'merchant.eth') {
    ctx.addIssue({ code: 'custom', path: ['ENS_MERCHANT_NAME'], message: 'ENS_MERCHANT_NAME must not use the sample merchant name' });
  }
  if (data.HEDERA_NETWORK !== 'testnet' || data.X402_NETWORK !== 'hedera:testnet') {
    ctx.addIssue({ code: 'custom', path: ['HEDERA_NETWORK'], message: 'Current live demo supports Hedera testnet only' });
  }
  if (!new URL(data.HEDERA_MIRROR_NODE_URL).hostname.includes('testnet')) {
    ctx.addIssue({ code: 'custom', path: ['HEDERA_MIRROR_NODE_URL'], message: 'Hedera testnet requires a testnet mirror node' });
  }
  if (data.X402_FACILITATOR_URL && new URL(data.X402_FACILITATOR_URL).protocol !== 'https:') {
    ctx.addIssue({ code: 'custom', path: ['X402_FACILITATOR_URL'], message: 'Testnet facilitator URL must use HTTPS' });
  }
  if (data.X402_SCHEME !== 'exact') {
    ctx.addIssue({ code: 'custom', path: ['X402_SCHEME'], message: 'Current payment guard supports the exact scheme only' });
  }
  if (data.X402_AMOUNT && BigInt(data.X402_AMOUNT) > BigInt(data.MAX_PAYMENT_AMOUNT_DEFAULT)) {
    ctx.addIssue({ code: 'custom', path: ['X402_AMOUNT'], message: 'X402_AMOUNT exceeds MAX_PAYMENT_AMOUNT_DEFAULT' });
  }
  const knownTestKeys = new Set([
    '0x1111111111111111111111111111111111111111111111111111111111111111',
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
  ]);
  if (knownTestKeys.has(data.ATTESTOR_PRIVATE_KEY.toLowerCase())) {
    ctx.addIssue({ code: 'custom', path: ['ATTESTOR_PRIVATE_KEY'], message: 'Development attestor key is not valid for live profiles' });
  }
  if (data.OPERATOR_SUBJECT_HMAC_SECRET === 'sample_32_byte_hmac_secret_for_subject_hashing_min32') {
    ctx.addIssue({ code: 'custom', path: ['OPERATOR_SUBJECT_HMAC_SECRET'], message: 'Development HMAC secret is not valid for live profiles' });
  }
  if (data.ENCRYPTION_KEY_HEX === '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f') {
    ctx.addIssue({ code: 'custom', path: ['ENCRYPTION_KEY_HEX'], message: 'Development encryption key is not valid for live profiles' });
  }
});

export type EnvConfig = z.infer<typeof EnvSchema>;

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env): EnvConfig {
  const result = EnvSchema.safeParse(rawEnv);
  if (!result.success) {
    const issues = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
    throw new ConfigurationError(`Environment validation failed: ${issues}`, { issues: result.error.issues });
  }
  return result.data;
}
