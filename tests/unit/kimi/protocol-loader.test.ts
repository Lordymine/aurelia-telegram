import { describe, it, expect, beforeEach } from 'vitest';
import { loadProtocol, getProtocolVersion, clearProtocolCache } from '../../../src/kimi/protocol-loader.js';

describe('Protocol Loader', () => {
  beforeEach(() => {
    clearProtocolCache();
  });

  it('should load the protocol document', () => {
    const protocol = loadProtocol();
    expect(protocol).toContain('ADE Protocol Document');
  });

  it('should contain agent definitions', () => {
    const protocol = loadProtocol();
    expect(protocol).toContain('@dev');
    expect(protocol).toContain('@qa');
    expect(protocol).toContain('@pm');
    expect(protocol).toContain('@architect');
    expect(protocol).toContain('@sm');
  });

  it('should contain translation examples', () => {
    const protocol = loadProtocol();
    expect(protocol).toContain('cria um PRD');
    expect(protocol).toContain('roda os testes');
  });

  it('should contain formatting rules', () => {
    const protocol = loadProtocol();
    expect(protocol).toContain('Telegram Formatting');
    expect(protocol).toContain('3000 characters');
  });

  it('should contain confidence scoring rules', () => {
    const protocol = loadProtocol();
    expect(protocol).toContain('0.7');
    expect(protocol).toContain('clarification');
  });

  it('should cache the protocol on subsequent loads', () => {
    const first = loadProtocol();
    const second = loadProtocol();
    expect(first).toBe(second); // Same reference (cached)
  });

  it('should return fresh content after clearing cache', () => {
    const first = loadProtocol();
    clearProtocolCache();
    const second = loadProtocol();
    expect(first).toEqual(second); // Same content
  });

  it('should return protocol version', () => {
    const version = getProtocolVersion();
    expect(version).toBe('1.0');
  });
});
