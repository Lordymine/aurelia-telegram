import { Command } from 'commander';
import { readFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig } from '../../config/manager.js';

const PID_DIR = '.aurelia';
const PID_FILE = 'bot.pid';

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function createStopCommand(): Command {
  const cmd = new Command('stop')
    .description('Stop the running Aurelia Telegram bot')
    .action(async () => {
      let config;
      try {
        config = await loadConfig();
      } catch {
        console.error('No configuration found. Run `aurelia-telegram init` first.');
        process.exitCode = 1;
        return;
      }

      const pidPath = join(resolve(config.projectPath), PID_DIR, PID_FILE);

      let pidStr: string;
      try {
        pidStr = await readFile(pidPath, 'utf-8');
      } catch {
        console.log('Bot is not running (no PID file found).');
        return;
      }

      const pid = parseInt(pidStr.trim(), 10);
      if (isNaN(pid)) {
        console.error('Invalid PID file. Removing stale file.');
        await unlink(pidPath).catch(() => {});
        return;
      }

      if (!isProcessRunning(pid)) {
        console.log('Bot is not running (stale PID file). Cleaning up.');
        await unlink(pidPath).catch(() => {});
        return;
      }

      try {
        process.kill(pid, 'SIGTERM');
        console.log(`Bot (PID ${pid}) stopped.`);
      } catch {
        console.error(`Failed to stop bot (PID ${pid}).`);
        process.exitCode = 1;
      }
    });

  return cmd;
}
