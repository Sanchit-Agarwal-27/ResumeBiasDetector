/**
 * @file normalizer.ts
 * Normalizes extracted resume text to remove extraction artifacts and decorative elements
 * while preserving critical information such as section headers, bullet points,
 * dates, metrics, URLs, email addresses, and sentence structure.
 */

/**
 * Standard bullet characters mapping to clean unicode bullet
 */
const BULLET_PATTERN =
  /^[\u2022\u25cf\u25cb\u25aa\u25b8\uf0b7\u00b7\u2013\u2014■●○►*•]\s*|^-\s+/;

/**
 * Horizontal line or decorative rule patterns
 */
const DECORATIVE_LINE_PATTERN =
  /^([-_—=~|•\s*#]{3,}|[\u2500-\u257F]{2,})$/;

/**
 * Normalize bullet points in a single line
 */
export function normalizeLineBullet(line: string): { text: string; isBullet: boolean } {
  const trimmed = line.trim();
  if (BULLET_PATTERN.test(trimmed)) {
    const cleaned = trimmed.replace(BULLET_PATTERN, "").trim();
    return { text: `• ${cleaned}`, isBullet: true };
  }
  return { text: trimmed, isBullet: false };
}

/**
 * Checks if a line is a purely decorative horizontal line or border artifact
 */
export function isDecorativeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return DECORATIVE_LINE_PATTERN.test(trimmed);
}

/**
 * Cleans extracted text safely:
 * - Normalizes unicode whitespace (NBSP, zero-width spaces, thin spaces)
 * - Normalizes unicode quotes and hyphens without destroying word meaning
 * - Replaces consecutive blank lines with at most 2 newlines
 * - Strips purely decorative lines/borders
 * - Retains URLs, emails, numbers, dates, punctuation, and bullets
 */
export function normalizeResumeText(rawText: string): string {
  if (!rawText || !rawText.trim()) return "";

  // 1. Normalize line breaks to standard \n
  let text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // 2. Normalize non-standard whitespace to standard space
  // Preserves standard tabs and standard newlines
  text = text.replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, " ");

  // 2b. Strip Private Use Area unicode glyphs (FontAwesome, Material Icons, Wingdings icon font artifacts)
  text = text.replace(/[\uE000-\uF8FF]/g, "");

  // 3. Normalize stylized quotes and apostrophes
  text = text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"');

  // 4. Normalize soft hyphens
  text = text.replace(/\u00AD/g, "");

  // 5. Normalize stylized em-dash and en-dash between dates (e.g. 2020 – 2024)
  text = text.replace(/(\b\d{4})\s*[\u2013\u2014]\s*(\b\d{4}|Present\b)/gi, "$1 - $2");

  // 6. Process line by line to filter decorative lines and standardize bullets
  const lines = text.split("\n");
  const processedLines: string[] = [];
  let consecutiveEmptyCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const trimmed = rawLine.trim();

    if (!trimmed) {
      consecutiveEmptyCount++;
      if (consecutiveEmptyCount <= 2 && processedLines.length > 0) {
        processedLines.push("");
      }
      continue;
    }

    consecutiveEmptyCount = 0;

    // Filter out pure divider/decorative lines
    if (isDecorativeLine(trimmed)) {
      continue;
    }

    // Normalize bullets
    const { text: bulletText } = normalizeLineBullet(trimmed);

    // Normalize multiple inline spaces (except when intentionally tabbed)
    const normalizedLine = bulletText.replace(/[ \t]{3,}/g, "   ");
    processedLines.push(normalizedLine);
  }

  // 7. Join lines and trim boundaries
  let result = processedLines.join("\n").trim();

  // Ensure consecutive newlines do not exceed 2
  result = result.replace(/\n{3,}/g, "\n\n");

  return result;
}

/**
 * Strips non-printable ASCII/Unicode control characters while preserving
 * standard whitespace, punctuation, and Unicode text
 */
export function sanitizeControlCharacters(str: string): string {
  // Remove ASCII control characters 0-8, 11-12, 14-31, 127
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}
