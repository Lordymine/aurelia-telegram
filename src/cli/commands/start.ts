import { Command } from 'commander';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig } from '../../config/manager.js';
import { createBot } from '../../bot/index.js';
import { AureliaEngine } from '../../core/engine.js';
import { SessionManager } from '../../session/manager.js';
import { logger } from '../../utils/logger.js';

const PID_DIR = '.aurelia';
const PID_FILE = 'bot.pid';

function getPidPath(projectPath: string): string {
  return join(resolve(projectPath), PID_DIR, PID_FILE);
}

export function createStartCommand(): Command {
  const cmd = new Command('start')
    .description('Start the Aurelia Telegram bot')
    .action(async () => {
      let config;
      try {
        config = await loadConfig();
      } catch {
        console.error('No configuration found. Run `aurelia-telegram init` first.');
        process.exitCode = 1;
        return;
      }

      const engine = new AureliaEngine({
        projectPath: config.projectPath,
        workspacePath: config.workspacePath ?? config.projectPath,
      });
      const sessionManager = new SessionManager({ defaultProject: config.projectPath });
      const bot = createBot(config, {
        engine,
        sessionManager,
        jobManager: engine.getJobManager(),
      });

      // Write PID file
      const pidPath = getPidPath(config.projectPath);
      await mkdir(join(resolve(config.projectPath), PID_DIR), { recursive: true });
      await writeFile(pidPath, String(process.pid), 'utf-8');

      // Graceful shutdown
      const shutdown = async () => {
        logger.info('Shutting down bot...');
        bot.stop();
        try {
          const { unlink } = await import('node:fs/promises');
          await unlink(pidPath);
        } catch {
          // PID file may already be gone
        }
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      const me = await bot.api.getMe();
      logger.info(
        { username: me.username, deployMode: config.deployMode, projectPath: config.projectPath },
        'Bot started',
      );
      console.log(`Bot @${me.username} started in ${config.deployMode} mode.`);
      console.log(`Project: ${config.projectPath}`);
      if (config.workspacePath) {
        console.log(`Workspace: ${config.workspacePath}`);
      }
      console.log('Press Ctrl+C to stop.');

      bot.start({
        onStart: () => {
          logger.info('Long polling started');
        },
      });
    });

  return cmd;
}
