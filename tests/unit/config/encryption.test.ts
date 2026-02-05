import { describe, it, expect } from 'vitest';
import {
  encrypt,
  decrypt,
  deriveKey,
  getMachineFingerprint,
  encryptValue,
  decryptValue,
} from '../../../src/config/encryption.js';

describe('Encryption', () => {
  describe('deriveKey', () => {
    it('should derive a 32-byte key', () => {
      const key = deriveKey('test-fingerprint', 'test-salt');
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should produce same key for same inputs', () => {
      const key1 = deriveKey('fp', 'salt');
      const key2 = deriveKey('fp', 'salt');
      expect(key1.equals(key2)).toBe(true);
    });

    it('should produce different keys for different fingerprints', () => {
      const key1 = deriveKey('fp1', 'salt');
      const key2 = deriveKey('fp2', 'salt');
      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe('encrypt / decrypt roundtrip', () => {
    const key = deriveKey('test', 'salt');

    it('should encrypt and decrypt a string', () => {
      const plaintext = 'my-secret-token-12345';
      const { encrypted, iv, tag } = encrypt(plaintext, key);
      const result = decrypt(encrypted, iv, tag, key);
      expect(result).toBe(plaintext);
    });

    it('should encrypt and decrypt unicode text', () => {
      const plaintext = 'segredo-com-acentos-ção-ñ-ü';
      const { encrypted, iv, tag } = encrypt(plaintext, key);
      const result = decrypt(encrypted, iv, tag, key);
      expect(result).toBe(plaintext);
    });

    it('should encrypt and decrypt empty string', () => {
      const { encrypted, iv, tag } = encrypt('', key);
      const result = decrypt(encrypted, iv, tag, key);
      expect(result).toBe('');
    });

    it('should produce base64 encoded output', () => {
      const { encrypted, iv, tag } = encrypt('test', key);
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
      expect(() => Buffer.from(iv, 'base64')).not.toThrow();
      expect(() => Buffer.from(tag, 'base64')).not.toThrow();
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const r1 = encrypt('same-data', key);
      const r2 = encrypt('same-data', key);
      expect(r1.encrypted).not.toBe(r2.encrypted);
      expect(r1.iv).not.toBe(r2.iv);
    });
  });

  describe('tamper detection (GCM auth tag)', () => {
    const key = deriveKey('test', 'salt');

    it('should fail with wrong key', () => {
      const { encrypted, iv, tag } = encrypt('secret', key);
      const wrongKey = deriveKey('wrong', 'salt');
      expect(() => decrypt(encrypted, iv, tag, wrongKey)).toThrow();
    });

    it('should fail with tampered ciphertext', () => {
      const { encrypted, iv, tag } = encrypt('secret', key);
      const tampered = Buffer.from(encrypted, 'base64');
      tampered[0] = (tampered[0]! + 1) % 256;
      expect(() => decrypt(tampered.toString('base64'), iv, tag, key)).toThrow();
    });

    it('should fail with tampered tag', () => {
      const { encrypted, iv, tag } = encrypt('secret', key);
      const tampered = Buffer.from(tag, 'base64');
      tampered[0] = (tampered[0]! + 1) % 256;
      expect(() => decrypt(encrypted, iv, tampered.toString('base64'), key)).toThrow();
    });
  });

  describe('encryptValue / decryptValue', () => {
    it('should roundtrip a value', () => {
      const packed = encryptValue('my-bot-token');
      const result = decryptValue(packed);
      expect(result).toBe('my-bot-token');
    });

    it('should produce valid JSON packed format', () => {
      const packed = encryptValue('test');
      const parsed = JSON.parse(packed);
      expect(parsed).toHaveProperty('e');
      expect(parsed).toHaveProperty('i');
      expect(parsed).toHaveProperty('t');
    });
  });

  describe('getMachineFingerprint', () => {
    it('should return a non-empty string', () => {
      const fp = getMachineFingerprint();
      expect(typeof fp).toBe('string');
      expect(fp.length).toBeGreaterThan(0);
    });

    it('should contain a colon separator', () => {
      const fp = getMachineFingerprint();
      expect(fp).toContain(':');
    });
  });
});
