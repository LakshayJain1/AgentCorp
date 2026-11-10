import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

export class CryptoNotConfiguredError extends Error {
  constructor() {
    super('TOKEN_ENCRYPTION_KEY is not set');
    this.name = 'CryptoNotConfiguredError';
  }
}

export class TokenDecryptError extends Error {
  constructor() {
    // Deliberately no detail: never echo ciphertext or key material.
    super('stored token could not be decrypted');
    this.name = 'TokenDecryptError';
  }
}

export interface EncryptedValue {
  ciphertext: string; // base64url
  iv: string; // base64url
  tag: string; // base64url
  keyVersion: number;
}

function decodeKey(raw: string): Buffer {
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${key.length})`);
  }
  return key;
}

/**
 * Keyring lookup. `TOKEN_ENCRYPTION_KEYS` (JSON map of version -> base64 key)
 * lets a rotation keep old ciphertext readable; otherwise the single
 * `TOKEN_ENCRYPTION_KEY` serves the current version.
 */
function keyForVersion(version: number): Buffer {
  const map = process.env.TOKEN_ENCRYPTION_KEYS;
  if (map) {
    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(map) as Record<string, string>;
    } catch {
      throw new Error('TOKEN_ENCRYPTION_KEYS must be valid JSON');
    }
    const raw = parsed[String(version)];
    if (raw) return decodeKey(raw);
  }
  if (version === currentKeyVersion()) {
    const raw = process.env.TOKEN_ENCRYPTION_KEY;
    if (!raw) throw new CryptoNotConfiguredError();
    return decodeKey(raw);
  }
  throw new Error(`no encryption key available for version ${version}`);
}

export function currentKeyVersion(): number {
  const raw = process.env.TOKEN_ENCRYPTION_KEY_VERSION;
  const version = raw ? Number(raw) : 1;
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('TOKEN_ENCRYPTION_KEY_VERSION must be a positive integer');
  }
  return version;
}

export function isCryptoConfigured(): boolean {
  return Boolean(process.env.TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEYS);
}

/**
 * AAD binds ciphertext to its owner + slot. A copied row cannot be replayed
 * for another user, workspace, provider, or token slot.
 */
export function tokenAad(
  userId: string,
  workspaceId: string,
  provider: string,
  slot: 'access' | 'refresh',
): string {
  return `${userId}:${workspaceId}:${provider}:${slot}`;
}

export function encrypt(plaintext: string, aad: string): EncryptedValue {
  const keyVersion = currentKeyVersion();
  const key = keyForVersion(keyVersion);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    keyVersion,
  };
}

export function decrypt(value: EncryptedValue, aad: string): string {
  try {
    const key = keyForVersion(value.keyVersion);
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(value.iv, 'base64url'),
    );
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(Buffer.from(value.tag, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(value.ciphertext, 'base64url')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    throw new TokenDecryptError();
  }
}
