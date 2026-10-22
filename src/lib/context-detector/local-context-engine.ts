/**
 * @file local-context-engine.ts
 * Sentence extraction, tokenization, and contextual boundary tools.
 */

export interface SentenceSpan {
  sentence: string;
  start: number;
  end: number;
}

/**
 * Splits text into sentences while retaining exact character offsets within the document.
 * @param text The input document or paragraph.
 * @returns Array of sentence objects with exact start and end offsets.
 */
export function extractSentences(text: string): SentenceSpan[] {
  if (!text) return [];
  // Split on sentence-ending punctuation or newlines while preserving offsets
  const regex = /[^.!?\n]+(?:[.!?]+|$)/g;
  const sentences: SentenceSpan[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const offset = match.index + raw.indexOf(trimmed);
      sentences.push({
        sentence: trimmed,
        start: offset,
        end: offset + trimmed.length,
      });
    }
  }

  return sentences;
}

/**
 * Tokenizes a sentence into lowercase clean word tokens.
 * @param sentence Input sentence string.
 * @returns Array of lowercase alphanumeric tokens.
 */
export function tokenize(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}
