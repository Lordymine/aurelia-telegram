import { Command } from 'commander';
import { loadConfig, saveConfig } from '../../config/manager.js';
import type { AureliaConfig } from '../../config/schema.js';

const SENSITIVE_KEYS = new Set(['botToken', 'kimi.accessToken', 'kimi.refreshToken']);

function maskValue(value: string): string {
  if (value.length <= 6) return '***';
  return value.slice(0, 3) + '***' + value.slice(-3);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

function formatValue(key: string, value: unknown): string {
  if (SENSITIVE_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
    return maskValue(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value ?? '');
}

function flattenConfig(
  obj: Record<string, unknown>,
  prefix = '',
): Array<{ key: string; value: unknown }> {
  const entries: Array<{ key: string; value: unknown }> = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      entries.push(...flattenConfig(v as Record<string, unknown>, fullKey));
    } else {
      entries.push({ key: fullKey, value: v });
    }
  }
  return entries;
}

export function createConfigCommand(): Command {
  const cmd = new Command('config').description('Get or set configuration values');

  cmd
    .command('get <key>')
    .description('Get a configuration value')
    .action(async (key: string) => {
      let config: AureliaConfig;
      try {
        config = await loadConfig();
      } catch {
        console.error('No configuration found. Run `aurelia-telegram init` first.');
        process.exitCode = 1;
        return;
      }

      const value = getNestedValue(config as unknown as Record<string, unknown>, key);
      if (value === undefined) {
        console.error(`Configuration key "${key}" not found.`);
        process.exitCode = 1;
        return;
      }

      console.log(`${key} = ${formatValue(key, value)}`);
    });

  cmd
    .command('set <key> <value>')
    .description('Set a configuration value')
    .action(async (key: string, value: string) => {
      let config: AureliaConfig;
      try {
        config = await loadConfig();
      } catch {
        console.error('No configuration found. Run `aurelia-telegram init` first.');
        process.exitCode = 1;
        return;
      }

      const configObj = config as unknown as Record<string, unknown>;

      // Parse value: try number, then boolean, then string
      let parsed: unknown = value;
      if (value === 'true') parsed = true;
      else if (value === 'false') parsed = false;
      else if (/^\d+$/.test(value)) parsed = parseInt(value, 10);

      setNestedValue(configObj, key, parsed);

      try {
        await saveConfig(config);
        console.log(`Set ${key} = ${formatValue(key, parsed)}`);
      } catch (err) {
        console.error(`Failed to save config: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  cmd
    .command('list')
    .description('List all configuration values')
    .action(async () => {
      let config: AureliaConfig;
      try {
        config = await loadConfig();
      } catch {
        console.error('No configuration found. Run `aurelia-telegram init` first.');
        process.exitCode = 1;
        return;
      }

      const entries = flattenConfig(config as unknown as Record<string, unknown>);
      for (const { key, value } of entries) {
        console.log(`${key} = ${formatValue(key, value)}`);
      }
    });

  return cmd;
}
