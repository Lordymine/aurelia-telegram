import { Command } from 'commander';
import { runInitWizard } from '../wizard.js';

export function createInitCommand(): Command {
  const cmd = new Command('init')
    .description('Interactive setup wizard for Aurelia Telegram')
    .action(async () => {
      await runInitWizard();
    });

  return cmd;
}
