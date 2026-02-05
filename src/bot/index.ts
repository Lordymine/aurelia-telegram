import { Bot } from 'grammy';
import type { AureliaConfig } from '../config/schema.js';

export function createBot(config: AureliaConfig): Bot {
  const bot = new Bot(config.botToken);

  // Middleware and handlers will be added in Story 1.4
  return bot;
}
