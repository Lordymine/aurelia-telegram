import { describe, it, expect } from 'vitest';
import {
  aureliaConfigSchema,
  validateConfig,
  DEFAULT_CONFIG,
  CONFIG_VERSION,
} from '../../../src/config/schema.js';

const validConfig = {
  version: '1.0.0',
  botToken: 'test-token-123',
  allowedUsers: [123456789],
  projectPath: '/home/user/project',
  deployMode: 'local' as const,
  kimi: {},
  encryption: { salt: 'test-salt', iv: 'test-iv' },
};

describe('Config Schema', () => {
  describe('aureliaConfigSchema', () => {
    it('should accept a valid config', () => {
      const result = aureliaConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should accept config with webhook', () => {
      const config = {
        ...validConfig,
        deployMode: 'vps',
        webhook: { url: 'https://example.com/webhook', port: 8443 },
      };
      const result = aureliaConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should accept config with kimi tokens', () => {
      const config = {
        ...validConfig,
        kimi: {
          accessToken: 'at-123',
          refreshToken: 'rt-456',
          expiresAt: Date.now() + 3600000,
        },
      };
      const result = aureliaConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should reject missing botToken', () => {
      const { botToken: _, ...noToken } = validConfig;
      const result = aureliaConfigSchema.safeParse(noToken);
      expect(result.success).toBe(false);
    });

    it('should reject empty botToken', () => {
      const result = aureliaConfigSchema.safeParse({ ...validConfig, botToken: '' });
      expect(result.success).toBe(false);
    });

    it('should reject invalid deployMode', () => {
      const result = aureliaConfigSchema.safeParse({ ...validConfig, deployMode: 'cloud' });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer allowedUsers', () => {
      const result = aureliaConfigSchema.safeParse({ ...validConfig, allowedUsers: [1.5] });
      expect(result.success).toBe(false);
    });

    it('should reject invalid webhook port', () => {
      const config = {
        ...validConfig,
        webhook: { url: 'https://example.com', port: 99999 },
      };
      const result = aureliaConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('validateConfig', () => {
    it('should return validated config for valid data', () => {
      const result = validateConfig(validConfig);
      expect(result.botToken).toBe('test-token-123');
      expect(result.deployMode).toBe('local');
    });

    it('should throw descriptive error for invalid data', () => {
      expect(() => validateConfig({})).toThrow('Invalid configuration');
    });

    it('should include field path in error message', () => {
      try {
        validateConfig({ ...validConfig, botToken: '' });
      } catch (e) {
        expect((e as Error).message).toContain('botToken');
      }
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have version matching CONFIG_VERSION', () => {
      expect(DEFAULT_CONFIG.version).toBe(CONFIG_VERSION);
    });

    it('should default to local deployMode', () => {
      expect(DEFAULT_CONFIG.deployMode).toBe('local');
    });

    it('should default to empty allowedUsers', () => {
      expect(DEFAULT_CONFIG.allowedUsers).toEqual([]);
    });

    it('should default to empty kimi object', () => {
      expect(DEFAULT_CONFIG.kimi).toEqual({});
    });
  });
});
