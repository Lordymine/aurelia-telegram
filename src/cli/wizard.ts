import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { DEFAULT_CONFIG } from '../config/schema.js';
import type { AureliaConfig } from '../config/schema.js';
import { saveConfig } from '../config/manager.js';

export async function validateBotToken(token: string): Promise<{ valid: boolean; username?: string }> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await res.json()) as { ok: boolean; result?: { username?: string } };
    if (data.ok && data.result) {
      return { valid: true, username: data.result.username };
    }
    return { valid: false };
  } catch {
    return { valid: false };
  }
}

export function parseTelegramIds(input: string): number[] | null {
  const parts = input.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return null;

  const ids: number[] = [];
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num <= 0 || !Number.isInteger(num) || String(num) !== part) {
      return null;
    }
    ids.push(num);
  }
  return ids;
}

export function detectAiosProject(projectPath: string): boolean {
  return existsSync(join(resolve(projectPath), '.aios-core'));
}

async function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

export async function runInitWizard(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });

  console.log('');
  console.log('Welcome to Aurelia Telegram Setup!');
  console.log('==================================');
  console.log('');

  try {
    // 1. Bot Token
    let botToken = '';
    let botUsername = '';
    while (true) {
      botToken = await prompt(rl, 'Enter your Telegram bot token: ');
      if (!botToken) {
        console.log('Bot token is required.');
        continue;
      }

      console.log('Validating bot token...');
      const result = await validateBotToken(botToken);
      if (result.valid) {
        botUsername = result.username ?? 'unknown';
        console.log(`Valid! Bot: @${botUsername}`);
        break;
      } else {
        console.log('Invalid bot token. Please check and try again.');
      }
    }

    // 2. Telegram IDs
    let allowedUsers: number[] = [];
    while (true) {
      const idsInput = await prompt(rl, 'Enter allowed Telegram user ID(s) (comma-separated): ');
      if (!idsInput) {
        console.log('At least one Telegram user ID is required.');
        continue;
      }

      const parsed = parseTelegramIds(idsInput);
      if (parsed === null) {
        console.log('Invalid format. Please enter positive integers separated by commas.');
        continue;
      }
      allowedUsers = parsed;
      break;
    }

    // 3. Project Path
    const defaultPath = process.cwd();
    const pathInput = await prompt(rl, `Enter project path [${defaultPath}]: `);
    const projectPath = pathInput || defaultPath;

    if (!detectAiosProject(projectPath)) {
      console.log('Warning: No .aios-core/ directory found at this path. Continuing anyway.');
    }

    // 4. Build config and save
    const config: AureliaConfig = {
      ...DEFAULT_CONFIG,
      botToken,
      allowedUsers,
      projectPath: resolve(projectPath),
      encryption: {
        salt: randomBytes(16).toString('base64'),
        iv: randomBytes(16).toString('base64'),
      },
    };

    await saveConfig(config, projectPath);

    console.log('');
    console.log('Configuration saved successfully!');
    console.log('');
    console.log(`  Bot: @${botUsername}`);
    console.log(`  Users: ${allowedUsers.join(', ')}`);
    console.log(`  Project: ${resolve(projectPath)}`);
    console.log('');
    console.log('Next steps:');
    console.log('  Run `aurelia-telegram start` to begin.');
    console.log('');
  } finally {
    rl.close();
  }
}
