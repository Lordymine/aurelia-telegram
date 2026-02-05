import { describe, it, expect } from 'vitest';
import { createCLI } from '../../../src/cli/index.js';

describe('CLI Program Structure', () => {
  const cli = createCLI();

  it('should have the correct name', () => {
    expect(cli.name()).toBe('aurelia-telegram');
  });

  it('should have a description', () => {
    expect(cli.description()).toContain('Telegram bot gateway');
  });

  it('should have a version', () => {
    expect(cli.version()).toBeTruthy();
  });

  it('should register the init command', () => {
    const cmd = cli.commands.find((c) => c.name() === 'init');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('setup wizard');
  });

  it('should register the start command', () => {
    const cmd = cli.commands.find((c) => c.name() === 'start');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Start');
  });

  it('should register the stop command', () => {
    const cmd = cli.commands.find((c) => c.name() === 'stop');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Stop');
  });

  it('should register the status command', () => {
    const cmd = cli.commands.find((c) => c.name() === 'status');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('status');
  });

  it('should register the config command', () => {
    const cmd = cli.commands.find((c) => c.name() === 'config');
    expect(cmd).toBeDefined();
  });

  it('should have exactly 5 top-level commands', () => {
    expect(cli.commands).toHaveLength(5);
  });

  it('should register config subcommands (get, set, list)', () => {
    const configCmd = cli.commands.find((c) => c.name() === 'config');
    expect(configCmd).toBeDefined();
    const subNames = configCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('get');
    expect(subNames).toContain('set');
    expect(subNames).toContain('list');
  });
});
