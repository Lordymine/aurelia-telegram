import { Command } from 'commander';
import { VERSION } from '../index.js';
import { createInitCommand } from './commands/init.js';
import { createStartCommand } from './commands/start.js';
import { createStopCommand } from './commands/stop.js';
import { createStatusCommand } from './commands/status.js';
import { createConfigCommand } from './commands/config.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('aurelia-telegram')
    .description('Telegram bot gateway to AIOS ADE via Kimi LLM translation')
    .version(VERSION);

  program.addCommand(createInitCommand());
  program.addCommand(createStartCommand());
  program.addCommand(createStopCommand());
  program.addCommand(createStatusCommand());
  program.addCommand(createConfigCommand());

  return program;
}
