import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseTelegramIds, validateBotToken, detectAiosProject } from '../../../src/cli/wizard.js';
import { existsSync } from 'node:fs';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('Wizard Validation Functions', () => {
  describe('parseTelegramIds', () => {
    it('should parse a single valid ID', () => {
      expect(parseTelegramIds('123456789')).toEqual([123456789]);
    });

    it('should parse multiple comma-separated IDs', () => {
      expect(parseTelegramIds('111,222,333')).toEqual([111, 222, 333]);
    });

    it('should trim whitespace around IDs', () => {
      expect(parseTelegramIds(' 111 , 222 , 333 ')).toEqual([111, 222, 333]);
    });

    it('should return null for empty string', () => {
      expect(parseTelegramIds('')).toBeNull();
    });

    it('should return null for non-numeric input', () => {
      expect(parseTelegramIds('abc')).toBeNull();
    });

    it('should return null for negative numbers', () => {
      expect(parseTelegramIds('-123')).toBeNull();
    });

    it('should return null for zero', () => {
      expect(parseTelegramIds('0')).toBeNull();
    });

    it('should return null for decimal numbers', () => {
      expect(parseTelegramIds('12.34')).toBeNull();
    });

    it('should return null if any ID in comma list is invalid', () => {
      expect(parseTelegramIds('111,abc,333')).toBeNull();
    });

    it('should handle single ID with trailing comma', () => {
      expect(parseTelegramIds('111,')).toEqual([111]);
    });
  });

  describe('validateBotToken', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('should return valid with username for a correct token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ ok: true, result: { id: 1, is_bot: true, username: 'test_bot' } }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await validateBotToken('valid-token');
      expect(result.valid).toBe(true);
      expect(result.username).toBe('test_bot');
      expect(mockFetch).toHaveBeenCalledWith('https://api.telegram.org/botvalid-token/getMe');
    });

    it('should return invalid for a bad token', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ ok: false, description: 'Unauthorized' }),
        }),
      );

      const result = await validateBotToken('bad-token');
      expect(result.valid).toBe(false);
      expect(result.username).toBeUndefined();
    });

    it('should return invalid on network error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('Network error')),
      );

      const result = await validateBotToken('any-token');
      expect(result.valid).toBe(false);
    });
  });

  describe('detectAiosProject', () => {
    it('should return true when .aios-core exists', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      expect(detectAiosProject('/some/path')).toBe(true);
    });

    it('should return false when .aios-core does not exist', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      expect(detectAiosProject('/some/path')).toBe(false);
    });
  });
});
