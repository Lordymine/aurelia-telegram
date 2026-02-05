import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeCodeBridge, type OutputChunk } from '../../../src/bridge/claude-code.js';
import { EventEmitter } from 'node:events';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

import { spawn } from 'node:child_process';

function createMockProcess() {
  const proc = Object.assign(new EventEmitter(), {
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: vi.fn(),
    pid: 12345,
  });
  return proc;
}

describe('ClaudeCodeBridge', () => {
  let bridge: ClaudeCodeBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new ClaudeCodeBridge();
  });

  describe('isAvailable', () => {
    it('should return true when claude CLI exits with code 0', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.isAvailable();
      mockProc.emit('close', 0);

      expect(await promise).toBe(true);
    });

    it('should return false when claude CLI exits with non-zero code', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.isAvailable();
      mockProc.emit('close', 1);

      expect(await promise).toBe(false);
    });

    it('should return false when spawn errors', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.isAvailable();
      mockProc.emit('error', new Error('not found'));

      expect(await promise).toBe(false);
    });
  });

  describe('execute', () => {
    it('should spawn claude with correct args and return output', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.execute('hello world');

      // Simulate stdout data
      mockProc.stdout.emit('data', Buffer.from('Hello '));
      mockProc.stdout.emit('data', Buffer.from('response'));
      mockProc.emit('close', 0);

      const result = await promise;
      expect(result).toBe('Hello response');
      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--output-format', 'text'],
        expect.objectContaining({
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        }),
      );
      expect(mockProc.stdin.write).toHaveBeenCalledWith('hello world');
      expect(mockProc.stdin.end).toHaveBeenCalled();
    });

    it('should pass allowedTools when provided', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.execute('test', { allowedTools: ['Read', 'Write'] });
      mockProc.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--output-format', 'text', '--allowedTools', 'Read,Write'],
        expect.any(Object),
      );
    });

    it('should pass appendSystemPrompt when provided', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.execute('test', { appendSystemPrompt: 'extra context' });
      mockProc.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        ['--print', '--output-format', 'text', '--append-system-prompt', 'extra context'],
        expect.any(Object),
      );
    });

    it('should reject when process exits with non-zero code', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.execute('bad command');
      mockProc.stdout.emit('data', Buffer.from('error output'));
      mockProc.emit('close', 1);

      await expect(promise).rejects.toThrow('Claude Code exited with code 1');
    });

    it('should reject when process spawn errors', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.execute('test');
      mockProc.emit('error', new Error('spawn ENOENT'));

      await expect(promise).rejects.toThrow('Failed to spawn Claude Code');
    });

    it('should reject when timeout exceeded', async () => {
      vi.useFakeTimers();
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.execute('slow command', { timeout: 5000 });

      vi.advanceTimersByTime(5001);

      await expect(promise).rejects.toThrow('timed out after 5000ms');
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');

      vi.useRealTimers();
    });

    it('should throw if a command is already running', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      // Start first command (don't resolve it)
      bridge.execute('first');

      await expect(bridge.execute('second')).rejects.toThrow('already running');
    });

    it('should emit output events for stdout', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const chunks: OutputChunk[] = [];
      bridge.on('output', (chunk: OutputChunk) => chunks.push(chunk));

      const promise = bridge.execute('test');
      mockProc.stdout.emit('data', Buffer.from('hello'));
      mockProc.emit('close', 0);
      await promise;

      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.type).toBe('text');
      expect(chunks[0]!.content).toBe('hello');
    });

    it('should emit error events for stderr', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const chunks: OutputChunk[] = [];
      bridge.on('output', (chunk: OutputChunk) => chunks.push(chunk));

      const promise = bridge.execute('test');
      mockProc.stderr.emit('data', Buffer.from('warning'));
      mockProc.emit('close', 0);
      await promise;

      expect(chunks).toHaveLength(1);
      expect(chunks[0]!.type).toBe('error');
      expect(chunks[0]!.content).toBe('warning');
    });

    it('should use custom cwd when provided', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      const promise = bridge.execute('test', { cwd: '/custom/path' });
      mockProc.emit('close', 0);
      await promise;

      expect(spawn).toHaveBeenCalledWith(
        'claude',
        expect.any(Array),
        expect.objectContaining({ cwd: '/custom/path' }),
      );
    });
  });

  describe('kill', () => {
    it('should kill the running process', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      // Start a command
      bridge.execute('test');
      expect(bridge.isRunning).toBe(true);

      bridge.kill();
      expect(mockProc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(bridge.isRunning).toBe(false);
    });

    it('should do nothing if no process is running', () => {
      expect(() => bridge.kill()).not.toThrow();
      expect(bridge.isRunning).toBe(false);
    });
  });

  describe('isRunning', () => {
    it('should be false initially', () => {
      expect(bridge.isRunning).toBe(false);
    });

    it('should be true during execution', async () => {
      const mockProc = createMockProcess();
      vi.mocked(spawn).mockReturnValue(mockProc as never);

      bridge.execute('test');
      expect(bridge.isRunning).toBe(true);

      mockProc.emit('close', 0);
      // Wait for promise to settle
      await new Promise((r) => setTimeout(r, 10));
      expect(bridge.isRunning).toBe(false);
    });
  });
});
