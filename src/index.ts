export const VERSION = '0.1.0';

export { createBot } from './bot/index.js';
export { createCLI } from './cli/index.js';
export { loadConfig, saveConfig } from './config/manager.js';
export { validateConfig } from './config/schema.js';
export type { AureliaConfig } from './config/schema.js';
export { ClaudeCodeBridge } from './bridge/claude-code.js';
export { JobManager } from './bridge/job-manager.js';
export type { Job, JobStatus, JobProgressEvent } from './bridge/job-manager.js';
