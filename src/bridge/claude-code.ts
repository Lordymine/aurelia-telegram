import { spawn, type ChildProcess } from 'node:child_process';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'node:events';

const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes

export interface ExecuteOptions {
  cwd?: string;
  timeout?: number;
  allowedTools?: string[];
  appendSystemPrompt?: string;
}

export interface OutputChunk {
  type: 'text' | 'result' | 'error' | 'system' | 'tool_use' | 'assistant';
  content: string;
  timestamp: number;
  toolName?: string;
}

export class ClaudeCodeBridge extends EventEmitter {
  private process: ChildProcess | null = null;
  private _isRunning = false;

  get isRunning(): boolean {
    return this._isRunning;
  }

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const proc = spawn('claude', ['--version'], { stdio: 'pipe', shell: true });
        proc.on('close', (code) => resolve(code === 0));
        proc.on('error', () => resolve(false));
      } catch {
        resolve(false);
      }
    });
  }

  async execute(prompt: string, options: ExecuteOptions = {}): Promise<string> {
    if (this._isRunning) {
      throw new Error('A command is already running. Wait for it to complete or cancel it.');
    }

    const { cwd, timeout = DEFAULT_TIMEOUT, allowedTools, appendSystemPrompt } = options;

    const args = ['--print', '--verbose', '--output-format', 'stream-json', '--dangerously-skip-permissions'];
    if (allowedTools) {
      args.push('--allowedTools', allowedTools.join(','));
    }
    if (appendSystemPrompt) {
      args.push('--append-system-prompt', appendSystemPrompt);
    }

    logger.info({ promptLength: prompt.length, cwd }, 'Executing Claude Code command');

    return new Promise((resolve, reject) => {
      this._isRunning = true;
      const resultParts: string[] = [];
      const stderrParts: string[] = [];
      let lineBuffer = '';

      this.process = spawn('claude', args, {
        cwd: cwd ?? process.cwd(),
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      const timeoutHandle = setTimeout(() => {
        this.kill();
        reject(new Error(`Command timed out after ${timeout}ms`));
      }, timeout);

      this.process.stdout?.on('data', (data: Buffer) => {
        lineBuffer += data.toString();
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          this.parseStreamLine(trimmed, resultParts);
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        stderrParts.push(text);
        logger.debug({ stderr: text }, 'Claude Code stderr');
      });

      this.process.stdin?.write(prompt);
      this.process.stdin?.end();

      this.process.on('close', (code) => {
        clearTimeout(timeoutHandle);
        this._isRunning = false;
        this.process = null;

        // Process remaining buffer
        if (lineBuffer.trim()) {
          this.parseStreamLine(lineBuffer.trim(), resultParts);
        }

        const fullOutput = resultParts.join('');

        if (code === 0) {
          logger.info({ outputLength: fullOutput.length }, 'Claude Code command completed');
          resolve(fullOutput);
        } else {
          const stderrOutput = stderrParts.join('').trim();
          const errorDetail = fullOutput || stderrOutput || 'No output captured';
          logger.error({ code, stderr: stderrOutput }, 'Claude Code command failed');
          reject(new Error(`Claude Code exited with code ${code}: ${errorDetail}`));
        }
      });

      this.process.on('error', (err) => {
        clearTimeout(timeoutHandle);
        this._isRunning = false;
        this.process = null;
        logger.error({ err }, 'Claude Code process error');
        reject(new Error(`Failed to spawn Claude Code: ${err.message}`));
      });
    });
  }

  kill(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this._isRunning = false;
      this.process = null;
      logger.info('Claude Code process killed');
    }
  }

  private parseStreamLine(line: string, resultParts: string[]): void {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const type = event.type as string;

      if (type === 'assistant' && event.message) {
        const msg = event.message as Record<string, unknown>;
        const content = msg.content;
        if (typeof content === 'string') {
          resultParts.push(content);
          this.emit('output', { type: 'assistant', content, timestamp: Date.now() } satisfies OutputChunk);
        } else if (Array.isArray(content)) {
          for (const block of content) {
            const b = block as Record<string, unknown>;
            if (b.type === 'text' && typeof b.text === 'string') {
              resultParts.push(b.text);
              this.emit('output', { type: 'text', content: b.text, timestamp: Date.now() } satisfies OutputChunk);
            } else if (b.type === 'tool_use') {
              const toolName = (b.name as string) ?? 'unknown';
              const input = b.input as Record<string, unknown> | undefined;
              const summary = this.summarizeTool(toolName, input);
              this.emit('output', { type: 'tool_use', content: summary, toolName, timestamp: Date.now() } satisfies OutputChunk);
            }
          }
        }
      } else if (type === 'result') {
        const result = (event.result as string) ?? '';
        if (result && !resultParts.includes(result)) {
          resultParts.push(result);
        }
        this.emit('output', { type: 'result', content: result, timestamp: Date.now() } satisfies OutputChunk);
      } else if (type === 'system') {
        const msg = (event.message as string) ?? '';
        this.emit('output', { type: 'system', content: msg, timestamp: Date.now() } satisfies OutputChunk);
      }
    } catch {
      // Not valid JSON — treat as raw text
      resultParts.push(line);
      this.emit('output', { type: 'text', content: line, timestamp: Date.now() } satisfies OutputChunk);
    }
  }

  private summarizeTool(toolName: string, input?: Record<string, unknown>): string {
    switch (toolName) {
      case 'Read':
        return `Reading ${input?.file_path ?? 'file'}`;
      case 'Write':
        return `Writing ${input?.file_path ?? 'file'}`;
      case 'Edit':
        return `Editing ${input?.file_path ?? 'file'}`;
      case 'Bash':
        return `Running: ${((input?.command as string) ?? '').slice(0, 80)}`;
      case 'Glob':
        return `Searching files: ${input?.pattern ?? ''}`;
      case 'Grep':
        return `Searching code: ${input?.pattern ?? ''}`;
      case 'Task':
        return `Running subtask: ${((input?.description as string) ?? '').slice(0, 60)}`;
      default:
        return `Using tool: ${toolName}`;
    }
  }
}
