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
  type: 'text' | 'result' | 'error' | 'system';
  content: string;
  timestamp: number;
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

    const args = ['--print', '--output-format', 'text'];
    if (allowedTools) {
      args.push('--allowedTools', allowedTools.join(','));
    }
    if (appendSystemPrompt) {
      args.push('--append-system-prompt', appendSystemPrompt);
    }

    logger.info({ promptLength: prompt.length, cwd }, 'Executing Claude Code command');

    return new Promise((resolve, reject) => {
      this._isRunning = true;
      const output: string[] = [];

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
        const text = data.toString();
        output.push(text);
        this.emit('output', { type: 'text', content: text, timestamp: Date.now() } satisfies OutputChunk);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        logger.debug({ stderr: text }, 'Claude Code stderr');
        this.emit('output', { type: 'error', content: text, timestamp: Date.now() } satisfies OutputChunk);
      });

      this.process.stdin?.write(prompt);
      this.process.stdin?.end();

      this.process.on('close', (code) => {
        clearTimeout(timeoutHandle);
        this._isRunning = false;
        this.process = null;

        const fullOutput = output.join('');

        if (code === 0) {
          logger.info({ outputLength: fullOutput.length }, 'Claude Code command completed');
          resolve(fullOutput);
        } else {
          logger.error({ code }, 'Claude Code command failed');
          reject(new Error(`Claude Code exited with code ${code}: ${fullOutput}`));
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
}
