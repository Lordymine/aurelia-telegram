import { logger } from '../utils/logger.js';
import { loadConfig, saveConfig } from '../config/manager.js';

const KIMI_OAUTH_HOST = 'https://auth.kimi.com';
const DEVICE_CODE_ENDPOINT = `${KIMI_OAUTH_HOST}/api/oauth/device_authorization`;
const TOKEN_ENDPOINT = `${KIMI_OAUTH_HOST}/api/oauth/token`;
const CLIENT_ID = '17e5f671-d194-4dfb-9706-5516cb48c098';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface AuthErrorResponse {
  error: string;
  error_description?: string;
}

export type PollResult =
  | { success: true; tokens: TokenResponse }
  | { success: false; error: string; description?: string };

export function isTokenExpired(expiresAt?: number): boolean {
  if (!expiresAt) return true;
  return Date.now() >= expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const body = new URLSearchParams({ client_id: CLIENT_ID });

  const response = await fetch(DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to request device code: ${response.status} ${text}`);
  }

  return (await response.json()) as DeviceCodeResponse;
}

export async function pollForToken(
  deviceCode: string,
  interval: number,
  expiresIn: number,
  onPending?: () => void,
): Promise<PollResult> {
  const deadline = Date.now() + expiresIn * 1000;
  let pollInterval = interval * 1000;

  while (Date.now() < deadline) {
    await sleep(pollInterval);

    try {
      const body = new URLSearchParams({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });

      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      const data = (await response.json()) as TokenResponse | AuthErrorResponse;

      if (response.ok && 'access_token' in data) {
        return { success: true, tokens: data };
      }

      if ('error' in data) {
        switch (data.error) {
          case 'authorization_pending':
            onPending?.();
            continue;
          case 'slow_down':
            pollInterval += 5000;
            continue;
          case 'access_denied':
            return { success: false, error: 'access_denied', description: 'Authorization was denied by user' };
          case 'expired_token':
            return { success: false, error: 'expired_token', description: 'Device code has expired' };
          default:
            return { success: false, error: data.error, description: data.error_description };
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error polling for token');
    }
  }

  return { success: false, error: 'expired_token', description: 'Device code has expired (timeout)' };
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh token: ${response.status} ${text}`);
  }

  return (await response.json()) as TokenResponse;
}

export async function saveTokensToConfig(tokens: TokenResponse): Promise<void> {
  const config = await loadConfig();
  config.kimi.accessToken = tokens.access_token;
  config.kimi.refreshToken = tokens.refresh_token;
  config.kimi.expiresAt = Date.now() + tokens.expires_in * 1000;
  await saveConfig(config);
  logger.info('Kimi tokens saved to config');
}

export async function ensureAuthenticated(): Promise<string> {
  const config = await loadConfig();
  const { accessToken, refreshToken, expiresAt } = config.kimi;

  if (!accessToken || !refreshToken) {
    throw new Error('Kimi not authenticated. Use /auth to authenticate.');
  }

  if (!isTokenExpired(expiresAt)) {
    return accessToken;
  }

  logger.info('Kimi token expired or near expiration, refreshing...');
  const tokens = await refreshAccessToken(refreshToken);
  await saveTokensToConfig(tokens);
  return tokens.access_token;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
