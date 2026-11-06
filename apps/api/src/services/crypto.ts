import crypto from 'node:crypto';

/**
 * AES-256-GCM encryption for sensitive values at rest (e.g. PKCE verifiers, encrypted subjects).
 * Format: iv_hex:auth_tag_hex:ciphertext_hex
 */
export function encryptAesGcm(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('Encryption key must be exactly 32 bytes (64 hex characters)');
  }

  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(plaintext, 'utf-8')),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decryptAesGcm(encrypted: string, keyHex: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format; expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex!, 'hex');
  const authTag = Buffer.from(authTagHex!, 'hex');
  const ciphertext = Buffer.from(ciphertextHex!, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf-8');
}

/**
 * Deterministic HMAC-SHA256 for World ID subject pseudonymization.
 * Never stores raw World subject in database or logs.
 */
export function computeSubjectHmac(subject: string, hmacSecret: string): string {
  return crypto.createHmac('sha256', hmacSecret).update(subject).digest('hex');
}

/**
 * SHA-256 hash for state, nonce, or secret indexing.
 */
export function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
