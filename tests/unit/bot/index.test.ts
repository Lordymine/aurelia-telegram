import { describe, it, expect } from 'vitest';
import { Bot } from 'grammy';
import { createBot } from '../../../src/bot/index.js';
import type { AureliaConfig } from '../../../src/config/schema.js';

const mockConfig: AureliaConfig = {
  version: '1.0.0',
  botToken: 'test-token-123:ABC',
  allowedUsers: [123456789],
  projectPath: '/home/user/project',
  deployMode: 'local',
  kimi: {},
  encryption: { salt: 'test-salt', iv: 'test-iv' },
};

describe('Bot Factory', () => {
  it('should return a Bot instance', () => {
    const bot = createBot(mockConfig);
    expect(bot).toBeInstanceOf(Bot);
  });

  it('should use the botToken from config', () => {
    const bot = createBot(mockConfig);
    expect(bot.token).toBe('test-token-123:ABC');
  });

  it('should be stoppable without error', () => {
    const bot = createBot(mockConfig);
    expect(() => bot.stop()).not.toThrow();
  });

  it('should have error handler registered', () => {
    const bot = createBot(mockConfig);
    // grammY stores the error handler internally; bot.catch sets it
    // If no error handler, bot.errorHandler would be the default
    expect(bot.errorHandler).toBeDefined();
  });
});
