import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTokenExpired, requestDeviceCode, pollForToken, refreshAccessToken } from '../../../src/kimi/auth.js';

describe('Kimi Auth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe('isTokenExpired', () => {
    it('should return true when expiresAt is undefined', () => {
      expect(isTokenExpired(undefined)).toBe(true);
    });

    it('should return true when token is expired', () => {
      const pastTime = Date.now() - 60000;
      expect(isTokenExpired(pastTime)).toBe(true);
    });

    it('should return true when token expires within 5 minute buffer', () => {
      const nearExpiry = Date.now() + 4 * 60 * 1000; // 4 minutes from now
      expect(isTokenExpired(nearExpiry)).toBe(true);
    });

    it('should return false when token is valid and not near expiry', () => {
      const farFuture = Date.now() + 60 * 60 * 1000; // 1 hour from now
      expect(isTokenExpired(farFuture)).toBe(false);
    });
  });

  describe('requestDeviceCode', () => {
    it('should return device code response on success', async () => {
      const mockResponse = {
        device_code: 'dev-code-123',
        user_code: 'ABCD-1234',
        verification_uri: 'https://kimi.moonshot.cn/auth',
        expires_in: 1800,
        interval: 5,
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await requestDeviceCode();
      expect(result).toEqual(mockResponse);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('should throw on failed response', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request'),
      } as Response);

      await expect(requestDeviceCode()).rejects.toThrow('Failed to request device code: 400');
    });
  });

  describe('pollForToken', () => {
    it('should return tokens on successful authorization', async () => {
      const tokens = {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(tokens),
      } as Response);

      const resultPromise = pollForToken('dev-code', 1, 300);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result).toEqual({ success: true, tokens });
    });

    it('should return error on access_denied', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'access_denied' }),
      } as Response);

      const resultPromise = pollForToken('dev-code', 1, 300);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result).toEqual({
        success: false,
        error: 'access_denied',
        description: 'Authorization was denied by user',
      });
    });

    it('should return error on expired_token', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'expired_token' }),
      } as Response);

      const resultPromise = pollForToken('dev-code', 1, 300);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result).toEqual({
        success: false,
        error: 'expired_token',
        description: 'Device code has expired',
      });
    });

    it('should continue polling on authorization_pending', async () => {
      let callCount = 0;
      vi.mocked(fetch).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({
            ok: false,
            json: () => Promise.resolve({ error: 'authorization_pending' }),
          } as Response);
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'token',
              refresh_token: 'refresh',
              expires_in: 3600,
              token_type: 'Bearer',
            }),
        } as Response);
      });

      const onPending = vi.fn();
      const resultPromise = pollForToken('dev-code', 1, 300, onPending);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(onPending).toHaveBeenCalled();
    });

    it('should handle network errors during polling gracefully', async () => {
      let callCount = 0;
      vi.mocked(fetch).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              access_token: 'token',
              refresh_token: 'refresh',
              expires_in: 3600,
              token_type: 'Bearer',
            }),
        } as Response);
      });

      const resultPromise = pollForToken('dev-code', 1, 300);
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
    });
  });

  describe('refreshAccessToken', () => {
    it('should return new tokens on success', async () => {
      const tokens = {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 3600,
        token_type: 'Bearer',
      };

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(tokens),
      } as Response);

      const result = await refreshAccessToken('old-refresh');
      expect(result).toEqual(tokens);
    });

    it('should throw on failed refresh', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Invalid refresh token'),
      } as Response);

      await expect(refreshAccessToken('bad-refresh')).rejects.toThrow('Failed to refresh token: 401');
    });
  });
});
