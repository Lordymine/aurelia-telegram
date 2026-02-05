# Aurelia Telegram

Open-source Telegram bot gateway to the AIOS ADE (Autonomous Development Engine) via Kimi LLM translation.

Control your entire development workflow from Telegram — send natural language commands, and Kimi translates them into ADE actions executed by Claude Code CLI.

## Features

- **Natural Language Interface** — Talk to ADE in plain language via Telegram
- **Kimi Translation Layer** — Kimi for Coding translates between human language and ADE commands
- **Claude Code CLI Bridge** — Spawns Claude Code as child process with streaming output
- **Async Job Management** — Track long-running ADE operations with real-time progress
- **Multi-user Sessions** — Isolated contexts per Telegram user with conversation history
- **Smart Formatting** — Telegram-optimized message splitting, code blocks, inline keyboards
- **Rate Limiting** — Configurable per-user rate limits
- **Device Code Auth** — OAuth 2.0 device code flow for Kimi for Coding subscription
- **BYOK Model** — Bring Your Own Keys (your Kimi + Claude Code subscriptions)

## Quick Start

### Prerequisites

- Node.js 18+
- Claude Code CLI installed and authenticated
- Kimi for Coding subscription
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Installation

```bash
npm install aurelia-telegram
```

### Setup

```bash
npx aurelia-telegram init
```

The interactive wizard will guide you through:
1. Entering your Telegram bot token
2. Setting your Telegram user ID (for authorization)
3. Selecting your project path

### Start the Bot

```bash
npx aurelia-telegram start
```

### Authenticate with Kimi

In Telegram, send `/auth` to your bot. Follow the device code flow to link your Kimi for Coding subscription.

## Architecture

```
User (Telegram) → Aurelia Bot → Kimi LLM (translate) → Claude Code CLI (execute) → Kimi (translate back) → User
```

### Components

| Component | Description |
|-----------|-------------|
| **Bot** (`src/bot/`) | grammY-based Telegram bot with middleware and handlers |
| **CLI** (`src/cli/`) | Commander.js CLI for setup and management |
| **Config** (`src/config/`) | Zod-validated config with AES-256-GCM token encryption |
| **Kimi** (`src/kimi/`) | Device code auth, API client, translation engine |
| **Bridge** (`src/bridge/`) | Claude Code CLI spawn, job management |
| **Engine** (`src/core/`) | Orchestrates the full translation-execution pipeline |
| **Session** (`src/session/`) | Per-user session isolation with TTL cleanup |

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and bot info |
| `/help` | List available commands |
| `/status` | Bot status and connections |
| `/auth` | Authenticate with Kimi for Coding |
| `/auth_status` | Check Kimi authentication status |
| `/jobs` | List active and recent jobs |
| `/cancel` | Cancel the current running job |
| `/switch_project` | Switch active project path |
| `/whoami` | Show your session info |

## Configuration

Config is stored in `.aurelia/config.json` in your project directory.

```json
{
  "botToken": "YOUR_BOT_TOKEN",
  "allowedUsers": [123456789],
  "projectPath": "/path/to/your/project",
  "deployMode": "local",
  "kimi": {}
}
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `AURELIA_BOT_TOKEN` | Telegram bot token (overrides config) |
| `AURELIA_ALLOWED_USERS` | Comma-separated Telegram user IDs |
| `AURELIA_PROJECT_PATH` | Project directory path |
| `AURELIA_DEPLOY_MODE` | `local` or `vps` |

## Deployment

### Local (Developer Machine)

```bash
npx aurelia-telegram init
npx aurelia-telegram start
```

### VPS (Remote Server)

```bash
npm install -g aurelia-telegram
aurelia-telegram init
aurelia-telegram start
```

Ensure Claude Code CLI is installed and authenticated on the server.

## API Reference

### Programmatic Usage

```typescript
import { createBot, loadConfig, AureliaEngine, SessionManager } from 'aurelia-telegram';

const config = await loadConfig('/path/to/project');
const engine = new AureliaEngine();
const sessionManager = new SessionManager({ ttl: 86400000 });

const bot = createBot(config, { engine, sessionManager });
await bot.start();
```

### Exports

| Export | Description |
|--------|-------------|
| `createBot(config, options?)` | Create configured grammY Bot instance |
| `createCLI()` | Create Commander.js CLI program |
| `loadConfig(projectPath?)` | Load config from `.aurelia/config.json` |
| `saveConfig(config, projectPath?)` | Save config to file |
| `validateConfig(data)` | Validate config against Zod schema |
| `ClaudeCodeBridge` | Claude Code CLI process bridge |
| `JobManager` | Async job tracking and management |
| `AureliaEngine` | Full Kimi-ADE pipeline orchestrator |
| `SessionManager` | Per-user session management |
| `splitMessage(text, maxLength?)` | Smart Telegram message splitting |
| `codeBlock(code, language?)` | Format code block for Telegram |
| `approvalKeyboard(jobId)` | Inline keyboard for approvals |
| `createRateLimitMiddleware(options?)` | Per-user rate limiting |
| `startTypingIndicator(ctx)` | Telegram typing indicator |
| `sendFileAsDocument(ctx, content, filename)` | Send text as document |

## Tech Stack

- **Runtime:** Node.js 18+, TypeScript strict mode, ESM
- **Telegram:** grammY 1.39+
- **CLI:** Commander.js 14+
- **Validation:** Zod 4+
- **Logging:** pino 10+
- **Build:** tsup 8+
- **Testing:** Vitest 4+
- **Encryption:** node:crypto AES-256-GCM

## License

[MIT](LICENSE)
