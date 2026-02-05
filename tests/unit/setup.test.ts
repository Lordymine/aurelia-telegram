import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should have vitest configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should support ESM imports', async () => {
    const { VERSION } = await import('../../src/index.js');
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
  });
});
