const MAX_MESSAGE_LENGTH = 4096;

export function splitMessage(text: string, maxLength = MAX_MESSAGE_LENGTH): string[] {
  // TODO: Implement smart splitting in Story 4.2
  if (text.length <= maxLength) {
    return [text];
  }

  const parts: string[] = [];
  for (let i = 0; i < text.length; i += maxLength) {
    parts.push(text.slice(i, i + maxLength));
  }
  return parts;
}
