import { Command } from 'commander';
import { readFile, stat } from 'node:fs/promises';
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

export function createStatusCommand(): Command {
  const cmd = new Command('status')
    .description('Show the status of the Aurelia Telegram bot')
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
        console.log('Bot is not running. Run `aurelia-telegram start` to begin.');
        return;
      }

      const pid = parseInt(pidStr.trim(), 10);
      if (isNaN(pid) || !isProcessRunning(pid)) {
        console.log('Bot is not running. Run `aurelia-telegram start` to begin.');
        return;
      }

      // Get PID file creation time for uptime estimate
      let startTime: Date | undefined;
      try {
        const pidStat = await stat(pidPath);
        startTime = pidStat.birthtime;
      } catch {
        // ignore
      }

      console.log('Bot is running:');
      console.log(`  PID: ${pid}`);
      if (startTime) {
        const uptimeMs = Date.now() - startTime.getTime();
        const uptimeSec = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(uptimeSec / 3600);
        const minutes = Math.floor((uptimeSec % 3600) / 60);
        const seconds = uptimeSec % 60;
        console.log(`  Uptime: ${hours}h ${minutes}m ${seconds}s`);
      }
      console.log(`  Deploy mode: ${config.deployMode}`);
      console.log(`  Project: ${config.projectPath}`);
    });

  return cmd;
}
