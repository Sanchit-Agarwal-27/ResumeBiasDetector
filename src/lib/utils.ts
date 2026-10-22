import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Escapes regex special characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Checks if a phrase or token appears in text with strict word boundary semantics.
 * Prevents substring false alarms (e.g., token "I" matching inside "linkedin" or "Accomplished").
 */
export function matchesWordBoundary(text: string, term: string): boolean {
  if (!text || !term) return false;
  const trimmed = term.trim();
  if (!trimmed) return false;
  const escaped = escapeRegex(trimmed);

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    return regex.test(text);
  }

  const regex = new RegExp(`(?:^|\\b|\\s)${escaped}(?:$|\\b|\\s)`, "i");
  return regex.test(text);
}

/**
 * Finds exact word boundary offset and length of a token in a target string.
 */
export function findWordBoundaryMatch(
  text: string,
  term: string,
): { start: number; length: number } | null {
  if (!text || !term) return null;
  const trimmed = term.trim();
  if (!trimmed) return null;
  const escaped = escapeRegex(trimmed);

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    const m = regex.exec(text);
    if (m) return { start: m.index, length: m[0].length };
  }

  const regex = new RegExp(`(?:^|\\b|\\s)(${escaped})(?:$|\\b|\\s)`, "i");
  const m = regex.exec(text);
  if (m) {
    const groupStart = m.index + m[0].indexOf(m[1]);
    return { start: groupStart, length: m[1].length };
  }

  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx !== -1) return { start: idx, length: term.length };
  return null;
}
