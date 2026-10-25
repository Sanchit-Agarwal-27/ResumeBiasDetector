/**
 * @file validator.ts
 * Intelligent validation of extracted resume text and structure.
 * Detects empty text, corrupt encodings, overlapping shadow layers,
 * column interleaving, and determines if fallback strategies (such as OCR) are needed.
 */

import type { ExtractionValidationResult, ValidationIssue } from "./types";

export interface ValidationOptions {
  pageCount?: number;
  expectedMinCharsPerPage?: number;
}

/**
 * Validates extracted text quality and determines whether fallback is required
 */
export function validateExtraction(
  text: string,
  options: ValidationOptions = {},
): ExtractionValidationResult {
  const issues: ValidationIssue[] = [];
  let qualityScore = 100;
  const pageCount = Math.max(1, options.pageCount ?? 1);
  const minExpectedChars = (options.expectedMinCharsPerPage ?? 100) * pageCount;

  const trimmed = text.trim();

  // 1. Check for empty or nearly empty text
  if (!trimmed) {
    issues.push({
      code: "EMPTY_TEXT",
      severity: "critical",
      message: "Extracted document contains no readable text.",
    });
    return {
      isValid: false,
      qualityScore: 0,
      issues,
      requiresFallback: true,
      fallbackReason: "No readable text detected. Scanned image or unextractable font layer.",
    };
  }

  // 2. Check for suspiciously short text on multi-page documents
  if (trimmed.length < Math.min(80, minExpectedChars * 0.3)) {
    issues.push({
      code: "TOO_SHORT",
      severity: "high",
      message: `Extracted only ${trimmed.length} characters for a ${pageCount}-page document.`,
    });
    qualityScore -= 40;
  }

  // 3. Check for garbled characters or unresolved font glyphs (CID fonts, \uFFFD)
  const cidMatches = (trimmed.match(/\(cid:\d+\)/g) || []).length;
  const replacementCharMatches = (trimmed.match(/\uFFFD/g) || []).length;
  const unprintableMatches = (trimmed.match(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g) || []).length;
  const garbledCount = cidMatches + replacementCharMatches + unprintableMatches;
  const garbledRatio = garbledCount / Math.max(1, trimmed.length);

  if (garbledRatio > 0.05 || garbledCount > 20) {
    issues.push({
      code: "GARBLED_CHARS",
      severity: garbledRatio > 0.15 ? "critical" : "high",
      message: `Detected ${garbledCount} garbled or unmapped font characters (${Math.round(garbledRatio * 100)}% of content).`,
    });
    qualityScore -= Math.min(50, Math.round(garbledRatio * 200));
  }

  // 4. Check for unusually high proportion of repeated symbols (decorative borders, line artifacts)
  const symbolMatches = trimmed.match(/[-_—=~|•*#.]{4,}/g) || [];
  const symbolCharCount = symbolMatches.reduce((acc, m) => acc + m.length, 0);
  const symbolRatio = symbolCharCount / Math.max(1, trimmed.length);

  if (symbolRatio > 0.15) {
    issues.push({
      code: "REPEATED_SYMBOLS",
      severity: "medium",
      message: `Document has unusually high proportion of repetitive symbols (${Math.round(symbolRatio * 100)}%).`,
    });
    qualityScore -= 20;
  }

  // 5. Check for duplicate text layers (PDF shadow / vector fill duplication)
  const lines = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5);

  let duplicateAdjacentCount = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === lines[i + 1]) {
      duplicateAdjacentCount++;
    }
  }

  if (lines.length > 5 && duplicateAdjacentCount / lines.length > 0.15) {
    issues.push({
      code: "DUPLICATE_LAYERS",
      severity: "high",
      message: `Detected overlapping duplicate text layers (${duplicateAdjacentCount} repeated adjacent lines).`,
    });
    qualityScore -= 30;
  }

  // 6. Check for interleaved columns
  // If consecutive lines alternate between short header-like snippets from different domains
  const hasInterleavedSymptom = detectInterleavedColumns(lines);
  if (hasInterleavedSymptom) {
    issues.push({
      code: "INTERLEAVED_COLUMNS",
      severity: "medium",
      message: "Multi-column text appears interleaved in horizontal scan order.",
    });
    qualityScore -= 25;
  }

  // Cap quality score between 0 and 100
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  const requiresFallback =
    qualityScore < 50 ||
    issues.some((i) => i.severity === "critical") ||
    (issues.some((i) => i.code === "GARBLED_CHARS" && i.severity === "high") && qualityScore < 60);

  let fallbackReason: string | undefined;
  if (requiresFallback) {
    const criticalIssue = issues.find((i) => i.severity === "critical" || i.severity === "high");
    fallbackReason = criticalIssue
      ? criticalIssue.message
      : `Extraction quality score (${qualityScore}/100) below acceptable threshold.`;
  }

  return {
    isValid: qualityScore >= 40 && !issues.some((i) => i.severity === "critical"),
    qualityScore,
    issues,
    requiresFallback,
    fallbackReason,
  };
}

/**
 * Heuristic detector for horizontally interleaved two-column text
 */
function detectInterleavedColumns(lines: string[]): boolean {
  if (lines.length < 8) return false;

  let alternationCount = 0;
  const sectionKeywords =
    /^(EXPERIENCE|EDUCATION|SKILLS|PROJECTS|SUMMARY|CERTIFICATIONS|LANGUAGES|CONTACT)/i;

  for (let i = 0; i < lines.length - 2; i++) {
    const isSection1 = sectionKeywords.test(lines[i]!);
    const isBody1 = lines[i + 1]!.length > 40;
    const isSection2 = sectionKeywords.test(lines[i + 2]!);

    if (isSection1 && isBody1 && isSection2 && lines[i + 1]!.length < 80) {
      alternationCount++;
    }
  }

  return alternationCount >= 2;
}

/**
 * Deduplicates overlapping text fragments from shadow layers
 */
export function deduplicateOverlappingFragments<
  T extends { text: string; x: number; y: number; width?: number; height?: number },
>(fragments: T[]): T[] {
  if (fragments.length <= 1) return fragments;

  const result: T[] = [];
  const seen = new Set<string>();

  for (const frag of fragments) {
    const roundedX = Math.round(frag.x);
    const roundedY = Math.round(frag.y);
    const key = `${roundedX}_${roundedY}_${frag.text.trim()}`;

    // Also check near match (within 2pt x and y)
    const isDuplicate = result.some(
      (existing) =>
        Math.abs(existing.x - frag.x) <= 2.5 &&
        Math.abs(existing.y - frag.y) <= 2.0 &&
        existing.text.trim() === frag.text.trim(),
    );

    if (!seen.has(key) && !isDuplicate) {
      seen.add(key);
      result.push(frag);
    }
  }

  return result;
}
