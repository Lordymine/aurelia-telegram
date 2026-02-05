import { logger } from '../utils/logger.js';
import { loadConfig, saveConfig } from '../config/manager.js';

const KIMI_AUTH_BASE = 'https://api.moonshot.ai/v1';
const DEVICE_CODE_ENDPOINT = `${KIMI_AUTH_BASE}/auth/device/code`;
const TOKEN_ENDPOINT = `${KIMI_AUTH_BASE}/auth/token`;
const CLIENT_ID = 'aurelia-telegram';
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
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
  const response = await fetch(DEVICE_CODE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: 'chat' }),
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
      const response = await fetch(TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
          client_id: CLIENT_ID,
        }),
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
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
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
