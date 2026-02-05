import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto';
import { hostname, userInfo } from 'node:os';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100_000;
const STATIC_SALT = 'aurelia-telegram-config-v1';

export function getMachineFingerprint(): string {
  return `${hostname()}:${userInfo().username}`;
}

export function deriveKey(fingerprint: string, salt: string): Buffer {
  return pbkdf2Sync(fingerprint, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

export function encrypt(
  plaintext: string,
  key: Buffer,
): { encrypted: string; iv: string; tag: string } {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decrypt(encrypted: string, iv: string, tag: string, key: Buffer): string {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'), {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

function getKeyAndSalt(): { key: Buffer; salt: string } {
  const fingerprint = getMachineFingerprint();
  const salt = STATIC_SALT;
  const key = deriveKey(fingerprint, salt);
  return { key, salt };
}

export function encryptValue(value: string): string {
  const { key } = getKeyAndSalt();
  const result = encrypt(value, key);
  return JSON.stringify({ e: result.encrypted, i: result.iv, t: result.tag });
}

export function decryptValue(packed: string): string {
  const { key } = getKeyAndSalt();
  const { e, i, t } = JSON.parse(packed) as { e: string; i: string; t: string };
  return decrypt(e, i, t, key);
}
