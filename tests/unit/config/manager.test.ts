import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join, resolve } from 'node:path';

// Mock fs before importing manager
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
}));

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadConfig, saveConfig, getConfigPath } from '../../../src/config/manager.js';
import { encryptValue } from '../../../src/config/encryption.js';

const mockedReadFile = vi.mocked(readFile);
const mockedWriteFile = vi.mocked(writeFile);
const mockedMkdir = vi.mocked(mkdir);

const validConfigOnDisk = {
  version: '1.0.0',
  botToken: 'plain-token',
  allowedUsers: [12345],
  projectPath: '/test/project',
  deployMode: 'local',
  kimi: {},
  encryption: { salt: 's', iv: 'v' },
};

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedMkdir.mockResolvedValue(undefined);
    mockedWriteFile.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('getConfigPath', () => {
    it('should build path from projectPath', () => {
      const result = getConfigPath('/my/project');
      expect(result).toBe(join(resolve('/my/project'), '.aurelia', 'config.json'));
    });

    it('should use cwd when no projectPath given', () => {
      const result = getConfigPath();
      expect(result).toContain('.aurelia');
      expect(result).toContain('config.json');
    });
  });

  describe('loadConfig', () => {
    it('should load and validate a config file', async () => {
      mockedReadFile.mockResolvedValue(JSON.stringify(validConfigOnDisk));

      const config = await loadConfig('/test');
      expect(config.botToken).toBe('plain-token');
      expect(config.deployMode).toBe('local');
      expect(config.allowedUsers).toEqual([12345]);
    });

    it('should decrypt encrypted botToken', async () => {
      const encrypted = encryptValue('secret-bot-token');
      const onDisk = { ...validConfigOnDisk, botToken: encrypted };
      mockedReadFile.mockResolvedValue(JSON.stringify(onDisk));

      const config = await loadConfig('/test');
      expect(config.botToken).toBe('secret-bot-token');
    });

    it('should apply env var overrides', async () => {
      mockedReadFile.mockResolvedValue(JSON.stringify(validConfigOnDisk));
      vi.stubEnv('AURELIA_DEPLOY_MODE', 'vps');

      const config = await loadConfig('/test');
      expect(config.deployMode).toBe('vps');
    });

    it('should parse AURELIA_ALLOWED_USERS as comma-separated numbers', async () => {
      mockedReadFile.mockResolvedValue(JSON.stringify(validConfigOnDisk));
      vi.stubEnv('AURELIA_ALLOWED_USERS', '111,222,333');

      const config = await loadConfig('/test');
      expect(config.allowedUsers).toEqual([111, 222, 333]);
    });

    it('should fall back to env vars when config file is missing', async () => {
      mockedReadFile.mockRejectedValue(new Error('ENOENT'));
      vi.stubEnv('AURELIA_BOT_TOKEN', 'env-token');
      vi.stubEnv('AURELIA_PROJECT_PATH', '/env/path');

      const config = await loadConfig('/test');
      expect(config.botToken).toBe('env-token');
      expect(config.projectPath).toBe('/env/path');
    });

    it('should throw on invalid config after merge', async () => {
      mockedReadFile.mockRejectedValue(new Error('ENOENT'));
      // No env vars set, so required fields are missing
      await expect(loadConfig('/test')).rejects.toThrow('Invalid configuration');
    });
  });

  describe('saveConfig', () => {
    it('should create .aurelia directory', async () => {
      await saveConfig(validConfigOnDisk as any, '/test');
      expect(mockedMkdir).toHaveBeenCalledWith(
        expect.stringContaining('.aurelia'),
        { recursive: true },
      );
    });

    it('should write JSON to config file', async () => {
      await saveConfig(validConfigOnDisk as any, '/test');
      expect(mockedWriteFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.any(String),
        'utf-8',
      );
    });

    it('should encrypt botToken in saved file', async () => {
      await saveConfig(validConfigOnDisk as any, '/test');
      const writtenContent = mockedWriteFile.mock.calls[0]![1] as string;
      const parsed = JSON.parse(writtenContent);
      // Encrypted botToken should be a JSON string with e/i/t fields
      expect(parsed.botToken).not.toBe('plain-token');
      const inner = JSON.parse(parsed.botToken);
      expect(inner).toHaveProperty('e');
      expect(inner).toHaveProperty('i');
      expect(inner).toHaveProperty('t');
    });

    it('should encrypt kimi tokens if present', async () => {
      const config = {
        ...validConfigOnDisk,
        kimi: { accessToken: 'at-secret', refreshToken: 'rt-secret' },
      };
      await saveConfig(config as any, '/test');
      const writtenContent = mockedWriteFile.mock.calls[0]![1] as string;
      const parsed = JSON.parse(writtenContent);
      expect(parsed.kimi.accessToken).not.toBe('at-secret');
      expect(parsed.kimi.refreshToken).not.toBe('rt-secret');
    });
  });
});
