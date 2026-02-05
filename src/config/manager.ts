import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { type AureliaConfig, DEFAULT_CONFIG, validateConfig } from './schema.js';
import { decryptValue, encryptValue } from './encryption.js';
import { logger } from '../utils/logger.js';

const CONFIG_DIR = '.aurelia';
const CONFIG_FILE = 'config.json';

export function getConfigPath(projectPath?: string): string {
  const base = projectPath ?? process.cwd();
  return join(resolve(base), CONFIG_DIR, CONFIG_FILE);
}

function getConfigDir(projectPath?: string): string {
  const base = projectPath ?? process.cwd();
  return join(resolve(base), CONFIG_DIR);
}

function encryptSensitiveFields(config: AureliaConfig): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(config)) as Record<string, unknown>;

  if (config.botToken) {
    raw['botToken'] = encryptValue(config.botToken);
  }
  if (config.kimi.accessToken) {
    const kimi = raw['kimi'] as Record<string, unknown>;
    kimi['accessToken'] = encryptValue(config.kimi.accessToken);
  }
  if (config.kimi.refreshToken) {
    const kimi = raw['kimi'] as Record<string, unknown>;
    kimi['refreshToken'] = encryptValue(config.kimi.refreshToken);
  }

  return raw;
}

function decryptSensitiveFields(raw: Record<string, unknown>): Record<string, unknown> {
  const data = { ...raw };

  if (typeof data['botToken'] === 'string' && data['botToken'].startsWith('{')) {
    try {
      data['botToken'] = decryptValue(data['botToken'] as string);
    } catch {
      logger.warn('Failed to decrypt botToken, using raw value');
    }
  }

  const kimi = data['kimi'] as Record<string, unknown> | undefined;
  if (kimi) {
    if (typeof kimi['accessToken'] === 'string' && kimi['accessToken'].startsWith('{')) {
      try {
        kimi['accessToken'] = decryptValue(kimi['accessToken'] as string);
      } catch {
        logger.warn('Failed to decrypt kimi.accessToken');
      }
    }
    if (typeof kimi['refreshToken'] === 'string' && kimi['refreshToken'].startsWith('{')) {
      try {
        kimi['refreshToken'] = decryptValue(kimi['refreshToken'] as string);
      } catch {
        logger.warn('Failed to decrypt kimi.refreshToken');
      }
    }
  }

  return data;
}

function loadEnvOverrides(): Partial<Record<string, unknown>> {
  const overrides: Record<string, unknown> = {};

  if (process.env['AURELIA_BOT_TOKEN']) {
    overrides['botToken'] = process.env['AURELIA_BOT_TOKEN'];
  }
  if (process.env['AURELIA_ALLOWED_USERS']) {
    overrides['allowedUsers'] = process.env['AURELIA_ALLOWED_USERS']
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
  }
  if (process.env['AURELIA_PROJECT_PATH']) {
    overrides['projectPath'] = process.env['AURELIA_PROJECT_PATH'];
  }
  if (process.env['AURELIA_DEPLOY_MODE']) {
    overrides['deployMode'] = process.env['AURELIA_DEPLOY_MODE'];
  }

  return overrides;
}

export async function loadConfig(projectPath?: string): Promise<AureliaConfig> {
  const configPath = getConfigPath(projectPath);
  let raw: Record<string, unknown> = {};

  try {
    const content = await readFile(configPath, 'utf-8');
    raw = JSON.parse(content) as Record<string, unknown>;
  } catch {
    logger.info({ configPath }, 'Config file not found, using defaults + env vars');
  }

  const decrypted = Object.keys(raw).length > 0 ? decryptSensitiveFields(raw) : raw;

  const envOverrides = loadEnvOverrides();
  const merged: Record<string, unknown> = { ...DEFAULT_CONFIG, ...decrypted, ...envOverrides };

  // Generate encryption metadata if not present (first run / env-only mode)
  if (!merged['encryption']) {
    merged['encryption'] = {
      salt: randomBytes(16).toString('base64'),
      iv: randomBytes(16).toString('base64'),
    };
  }

  const config = validateConfig(merged);
  logger.debug('Config loaded successfully');
  return config;
}

export async function saveConfig(
  config: AureliaConfig,
  projectPath?: string,
): Promise<void> {
  const configDir = getConfigDir(projectPath);
  const configPath = getConfigPath(projectPath);

  await mkdir(configDir, { recursive: true });

  const encrypted = encryptSensitiveFields(config);
  const content = JSON.stringify(encrypted, null, 2);

  await writeFile(configPath, content, 'utf-8');
  logger.debug('Config saved successfully');
}
