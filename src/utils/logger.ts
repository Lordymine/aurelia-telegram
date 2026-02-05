import pino from 'pino';

const LOG_LEVEL = process.env['AURELIA_LOG_LEVEL'] ?? 'info';

export const logger = pino({
  name: 'aurelia-telegram',
  level: LOG_LEVEL,
});
