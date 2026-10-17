/**
 * @file types.ts
 * Type definitions and constants for the integrated Context-Aware Bias Detection Engine.
 */

export const CLASSIFICATION = {
  FINE: "Fine",
  FLAGGED: "Flagged",
} as const;

export type ClassificationVerdict = typeof CLASSIFICATION[keyof typeof CLASSIFICATION];

export const OUTCOME_CATEGORIES = {
  NO_CONCERN: "No sufficient evidence of a bias concern",
  POTENTIAL_CONCERN: "Potential concern supported by the available evidence",
  AMBIGUOUS: "Ambiguous — human review recommended",
  INSUFFICIENT_CONTEXT: "Insufficient context",
} as const;

export const SEVERITY_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export type SeverityLevel = "low" | "medium" | "high";

export const BASELINE_SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  low: 3,
  medium: 7,
  high: 12,
};

export const BIAS_CATEGORIES = {
  GENDER_RELATED: "gender_coded",
  AGE_RELATED: "age_indicative",
  PERSONALITY_BEHAVIORAL: "personality_behavioral",
  DISABILITY_HEALTH: "disability_coded",
  CAREER_GAP: "gap_framing",
  PRESTIGE_PROXY: "prestige_proxy",
  // Legacy aliases
  GENDER_CODED: "gender_coded",
  AGE_INDICATIVE: "age_indicative",
  GAP_FRAMING: "gap_framing",
  DISABILITY_CODED: "disability_coded",
} as const;

export type ContextBiasCategory =
  | "gender_coded"
  | "age_indicative"
  | "personality_behavioral"
  | "disability_coded"
  | "gap_framing"
  | "prestige_proxy";

export const VARIANT_TYPES = {
  BASE_FORM: "base_form",
  ADVERB_FORM: "adverb_form",
  COMPARATIVE_FORM: "comparative_form",
  SUPERLATIVE_FORM: "superlative_form",
  NOUN_FORM: "noun_form",
  VERB_FORM: "verb_form",
  PLURAL_FORM: "plural_form",
  MULTIWORD_EXPRESSION: "multiword_expression",
  SPELLING_VARIANT: "spelling_variant",
  ANTONYM_VARIANT: "antonym_variant",
} as const;

export interface TaxonomyVariant {
  form: string;
  type: string;
}

export interface TaxonomyEntry {
  canonicalTerm: string;
  category: ContextBiasCategory;
  subcategory: string;
  severity: SeverityLevel;
  confidence: number;
  replacement: string;
  rationale: string;
  explanation: string;
  researchCitation: string;
  variants: TaxonomyVariant[];
}

export interface CandidateMatch {
  form: string;
  type: string;
  matchedText: string;
  start: number;
  end: number;
  entry: TaxonomyEntry;
  category: ContextBiasCategory;
  subcategory: string;
  severity: SeverityLevel;
  confidence: number;
  replacement: string;
  rationale: string;
  explanation: string;
  researchCitation: string;
}

export interface ClassifiedSentence {
  sentence: string;
  keyword_match: string[];
  classification: ClassificationVerdict;
  confidence: number;
  explanation: string;
  contextType: string;
  start?: number;
  end?: number;
  candidate_matches?: CandidateMatch[];
}

