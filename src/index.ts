export const VERSION = '1.0.0';

export { createBot } from './bot/index.js';
export { createCLI } from './cli/index.js';
export { loadConfig, saveConfig } from './config/manager.js';
export { validateConfig } from './config/schema.js';
export type { AureliaConfig } from './config/schema.js';
export { ClaudeCodeBridge } from './bridge/claude-code.js';
export { JobManager } from './bridge/job-manager.js';
export type { Job, JobStatus, JobProgressEvent } from './bridge/job-manager.js';
export { AureliaEngine } from './core/engine.js';
export type { EngineContext, EngineResult } from './core/engine.js';
export { SessionManager } from './session/manager.js';
export type { UserSession, SessionManagerOptions } from './session/manager.js';
export { splitMessage, codeBlock, escapeMarkdownV2, formatADEOutput } from './bot/utils/formatter.js';
export { approvalKeyboard, agentSelectionKeyboard, retryKeyboard, confirmKeyboard, parseCallbackData } from './bot/utils/keyboards.js';
export { startTypingIndicator, sendFileAsDocument, sendLongMessage } from './bot/utils/telegram.js';
export { createRateLimitMiddleware } from './bot/middleware/rate-limit.js';
export type { RateLimitOptions } from './bot/middleware/rate-limit.js';
