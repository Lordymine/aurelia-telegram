import { Command } from 'commander';
import { VERSION } from '../index.js';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('aurelia-telegram')
    .description('Telegram bot gateway to AIOS ADE via Kimi LLM translation')
    .version(VERSION);

  // TODO: Add subcommands in Story 1.2+
  // - aurelia-telegram init
  // - aurelia-telegram start
  // - aurelia-telegram auth

  return program;
}
