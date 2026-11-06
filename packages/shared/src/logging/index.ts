import pino, { type Logger, type LoggerOptions } from 'pino';

// Strict redaction paths: any log containing these fields will be censored with [REDACTED]
export const SENSITIVE_PATHS = [
  'authorization',
  'headers.authorization',
  'headers.cookie',
  'headers["x-session-token"]',
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-session-token"]',
  'token',
  'id_token',
  'idToken',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'client_secret',
  'clientSecret',
  'privateKey',
  'private_key',
  'secret',
  'signerKey',
  'rawSigner',
  'pkceVerifier',
  'codeVerifier',
  'code_verifier',
  'password',
  'sessionSecret',
  'sessionToken',
  'session_token',
  'hmacSecret',
  'encryptionKey',
  'apiKey',
  'api_key',
  'signature',
  'ownerSignature',
  'cvv',
  'cardNumber',
  'creditCard',
  '*.token',
  '*.id_token',
  '*.idToken',
  '*.accessToken',
  '*.access_token',
  '*.refreshToken',
  '*.refresh_token',
  '*.privateKey',
  '*.private_key',
  '*.rawSigner',
  '*.secret',
  '*.hmacSecret',
  '*.encryptionKey',
  '*.codeVerifier',
  '*.code_verifier',
  '*.pkceVerifier',
  '*.sessionToken',
  '*.session_token'
];

export interface CreateLoggerOptions {
  level?: string;
  name?: string;
}

export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const pinoOptions: LoggerOptions = {
    name: options.name ?? 'quoteseal',
    level: options.level ?? process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: SENSITIVE_PATHS,
      censor: '[REDACTED]'
    },
    formatters: {
      level: (label) => ({ level: label })
    },
    timestamp: pino.stdTimeFunctions.isoTime
  };

  return pino(pinoOptions);
}

export const logger = createLogger();
