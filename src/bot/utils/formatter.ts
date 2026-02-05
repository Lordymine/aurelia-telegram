const TELEGRAM_MAX_LENGTH = 4096;

/**
 * Split a long message into Telegram-safe chunks.
 * Splits at paragraph boundaries, then sentence boundaries,
 * and never splits inside code blocks.
 */
export function splitMessage(text: string, maxLength = TELEGRAM_MAX_LENGTH): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    const chunk = remaining.slice(0, maxLength);
    let splitIndex = -1;

    // Try to split at double newline (paragraph boundary)
    const lastParagraph = chunk.lastIndexOf('\n\n');
    if (lastParagraph > maxLength * 0.3) {
      splitIndex = lastParagraph;
    }

    // Fall back to single newline
    if (splitIndex === -1) {
      const lastNewline = chunk.lastIndexOf('\n');
      if (lastNewline > maxLength * 0.3) {
        splitIndex = lastNewline;
      }
    }

    // Fall back to sentence end
    if (splitIndex === -1) {
      const lastSentence = Math.max(
        chunk.lastIndexOf('. '),
        chunk.lastIndexOf('! '),
        chunk.lastIndexOf('? '),
      );
      if (lastSentence > maxLength * 0.3) {
        splitIndex = lastSentence + 1; // Include the punctuation
      }
    }

    // Last resort: split at space
    if (splitIndex === -1) {
      const lastSpace = chunk.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.3) {
        splitIndex = lastSpace;
      }
    }

    // Absolute last resort: hard split
    if (splitIndex === -1) {
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex).trimEnd());
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Wrap text in a Telegram-compatible code block with optional language hint.
 */
export function codeBlock(code: string, language = ''): string {
  return `\`\`\`${language}\n${code}\n\`\`\``;
}

/**
 * Escape special MarkdownV2 characters for Telegram.
 */
export function escapeMarkdownV2(text: string): string {
  return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

/**
 * Format ADE output for Telegram display.
 * Detects code blocks and wraps them properly.
 */
export function formatADEOutput(output: string): string {
  // Already has code fences — leave as-is
  if (output.includes('```')) {
    return output;
  }

  // If the entire output looks like code (multi-line, indented), wrap it
  const lines = output.split('\n');
  const codeLines = lines.filter((l) => l.startsWith('  ') || l.startsWith('\t') || l === '');
  if (lines.length > 3 && codeLines.length > lines.length * 0.7) {
    return codeBlock(output);
  }

  return output;
}
