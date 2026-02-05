import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTOCOL_PATH = resolve(__dirname, 'protocol.md');

let cachedProtocol: string | null = null;

export function loadProtocol(): string {
  if (cachedProtocol) return cachedProtocol;

  try {
    cachedProtocol = readFileSync(PROTOCOL_PATH, 'utf-8');
    return cachedProtocol;
  } catch {
    // Fallback: try from dist location
    const distPath = resolve(__dirname, '..', '..', 'src', 'kimi', 'protocol.md');
    try {
      cachedProtocol = readFileSync(distPath, 'utf-8');
      return cachedProtocol;
    } catch {
      throw new Error(`Protocol document not found at ${PROTOCOL_PATH} or ${distPath}`);
    }
  }
}

export function getProtocolVersion(): string {
  const protocol = loadProtocol();
  const match = protocol.match(/Protocol version:\s*(.+)/);
  return match?.[1]?.trim() ?? 'unknown';
}

export function clearProtocolCache(): void {
  cachedProtocol = null;
}
