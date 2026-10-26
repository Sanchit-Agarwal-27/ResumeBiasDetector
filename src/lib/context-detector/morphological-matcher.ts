/**
 * @file morphological-matcher.ts
 * High-precision lexical & morphological candidate scanner for the expanded taxonomy.
 * Matches multiword expressions, morphological variants (adverbs, comparatives, nouns),
 * and lemmas while avoiding substring false-positives (e.g. 'age' in 'manage' or 'fit' in 'benefit').
 */

import { EXPANDED_TAXONOMY, type ExpandedTaxonomyItem } from "./expanded-taxonomy";
import { VARIANT_TYPES, type CandidateMatch } from "./types";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface CompiledVariant {
  form: string;
  type: string;
  regex: RegExp;
  wordCount: number;
  entry: ExpandedTaxonomyItem;
}

/**
 * Compiles all taxonomy variants into sorted, word-boundary regex matchers.
 * Multiword expressions are sorted first (longest match priority).
 */
function compileVariants(): CompiledVariant[] {
  const list: CompiledVariant[] = [];

  for (const entry of EXPANDED_TAXONOMY) {
    for (const variant of entry.variants) {
      const cleanForm = variant.form.trim();
      const wordCount = cleanForm.split(/[\s-]+/).length;

      // Allow flexible spacing around hyphens: e.g. "tech-savvy" matches "tech-savvy" or "tech savvy"
      const escaped = escapeRegex(cleanForm).replace(/\\-/g, "[\\s-]");
      const pattern = new RegExp(`\\b${escaped}\\b`, "gi");

      list.push({
        form: cleanForm,
        type: variant.type,
        regex: pattern,
        wordCount,
        entry,
      });
    }
  }

  // Sort longest multiword expressions first to prevent sub-string fragmentation
  list.sort((a, b) => b.wordCount - a.wordCount || b.form.length - a.form.length);
  return list;
}

const COMPILED_VARIANTS: CompiledVariant[] = compileVariants();

/**
 * Scans input text and identifies all candidate trigger spans using the expanded taxonomy.
 *
 * @param rawText Full text or sentence
 * @returns Candidate spans with morphological variant metadata.
 */
export function scanExpandedCandidates(rawText: string): CandidateMatch[] {
  if (!rawText || typeof rawText !== "string") {
    return [];
  }

  const spans: CandidateMatch[] = [];

  // 1. Scan multiword expressions and morphological variants
  for (const item of COMPILED_VARIANTS) {
    const pattern = new RegExp(item.regex.source, item.regex.flags);
    let match = pattern.exec(rawText);

    while (match) {
      const start = match.index;
      const end = start + match[0].length;
      const matchedText = match[0];

      // Avoid overlapping with already-matched spans (longest-match priority)
      const overlaps = spans.some((s) => Math.max(s.start, start) < Math.min(s.end, end));

      if (!overlaps) {
        spans.push({
          form: item.form,
          type: item.type,
          matchedText,
          category: item.entry.category,
          subcategory: item.entry.subcategory,
          severity: item.entry.defaultSeverity,
          confidence: item.entry.confidence,
          explanation: item.entry.explanation,
          researchCitation: item.entry.researchCitation,
          replacement: item.entry.replacement,
          rationale: item.entry.rationale || item.entry.explanation,
          entry: item.entry,
          start,
          end,
        });
      }

      match = pattern.exec(rawText);
    }
  }

  // 2. Legacy graduation dates older than 20-25 years (e.g. 1950 - 2004)
  // Operates as an overt age proxy under EEOC / ADEA guidelines.
  // NEVER flags standard date ranges (e.g. "2014 – May 2018", "2012 – 2018", "2019 – Present").
  const legacyGraduationRegex = /\b(?:19[5-9]\d|200[0-4])\b/g;
  let yearMatch = legacyGraduationRegex.exec(rawText);
  while (yearMatch) {
    const start = yearMatch.index;
    const end = start + yearMatch[0].length;
    const matchedText = yearMatch[0];

    // Check surrounding window (25 chars before and after) to verify it is NOT part of a date range
    const windowBefore = rawText.slice(Math.max(0, start - 25), start);
    const windowAfter = rawText.slice(end, Math.min(rawText.length, end + 25));

    // A date range has hyphens, dashes, or range words connecting dates
    const isPrecededByRange =
      /[-–—/]\s*$/i.test(windowBefore) || /\b(?:to|until|through)\s*$/i.test(windowBefore);
    const isFollowedByRange =
      /^\s*[-–—/]/.test(windowAfter) ||
      /^\s*\b(?:to|until|through|present|current)\b/i.test(windowAfter);
    const isMonthRange =
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*$/i.test(windowBefore);

    const isDateRange = isPrecededByRange || isFollowedByRange || isMonthRange;

    // Check if there is explicit graduation or education phrasing in the sentence
    const surroundingSentence = rawText.slice(
      Math.max(0, start - 80),
      Math.min(rawText.length, end + 80),
    );
    const hasGraduationContext =
      /\b(?:graduat(?:ed|ion|e)?|class of|degree|bachelor|master|ph\.?d|b\.?s|b\.?a|alumn(?:us|a|i))\b/i.test(
        surroundingSentence,
      );

    const overlaps = spans.some((s) => Math.max(s.start, start) < Math.min(s.end, end));

    if (!overlaps && !isDateRange && hasGraduationContext) {
      spans.push({
        form: matchedText,
        type: VARIANT_TYPES.BASE_FORM,
        matchedText,
        category: "age_indicative",
        subcategory: "graduation_year_proxy",
        severity: "medium",
        confidence: 0.95,
        explanation:
          "Listing graduation dates older than 20 years operates as an age proxy in automated candidate screening.",
        researchCitation: "EEOC ADEA Guidance & Neumark et al. (2019)",
        replacement: "Remove graduation year",
        rationale:
          "Omitting legacy graduation dates neutralizes age proxies while keeping degree credentials intact.",
        entry: {
          canonicalTerm: "graduation_year",
          category: "age_indicative",
          subcategory: "graduation_year_proxy",
          severity: "medium",
          confidence: 0.95,
          replacement: "Remove graduation year",
          explanation:
            "Listing graduation dates older than 20 years operates as an age proxy in automated candidate screening.",
          researchCitation: "EEOC ADEA Guidance & Neumark et al. (2019)",
          variants: [{ form: matchedText, type: VARIANT_TYPES.BASE_FORM }],
        },
        start,
        end,
      });
    }

    yearMatch = legacyGraduationRegex.exec(rawText);
  }

  // Sort chronologically by start position
  spans.sort((a, b) => a.start - b.start);
  return spans;
}
