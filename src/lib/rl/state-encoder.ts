/**
 * @file state-encoder.ts
 * Contextual state vector feature extractor for the RL bandit policy.
 * Encodes strictly non-sensitive, evidence-based contextual signals
 * without inferring or utilizing protected demographic traits.
 */

import type { BiasCategory, BiasSpan, SeverityLevel } from "../resume-contract";
import { STATE_DIMENSION, type StateVector } from "./types";

const CATEGORY_FEATURE_MAP: Record<BiasCategory, number> = {
  gender_coded: 0.15,
  age_indicative: 0.35,
  gap_framing: 0.55,
  personality_behavioral: 0.75,
  prestige_proxy: 0.90,
  disability_coded: 0.95,
};

const SEVERITY_FEATURE_MAP: Record<SeverityLevel, number> = {
  low: 0.25,
  medium: 0.58,
  high: 1.0,
};

export function encodeStateVector(
  span: BiasSpan,
  historicalSatisfactionRate: number = 0.5,
  documentType: "resume" | "job_description" = "resume",
): StateVector {
  const categoryScore = CATEGORY_FEATURE_MAP[span.category] ?? 0.5;
  const severityScore = SEVERITY_FEATURE_MAP[span.severity] ?? 0.58;
  const confidenceScore = Math.min(1.0, Math.max(0.0, span.confidence ?? 0.85));

  // Context type encoding based on sentence classification
  let contextScore = 0.3;
  const contextType = (span as { context_type?: string }).context_type || "";
  if (contextType.includes("conduct") || contextType.includes("personality")) {
    contextScore = 0.85;
  } else if (contextType.includes("jargon") || contextType.includes("bro_culture")) {
    contextScore = 0.75;
  } else if (contextType.includes("graduation") || contextType.includes("age")) {
    contextScore = 0.65;
  } else if (contextType.includes("gap") || contextType.includes("career")) {
    contextScore = 0.55;
  } else if (contextType.includes("leadership") || contextType.includes("dominance")) {
    contextScore = 0.45;
  }

  // Sentence length normalized
  const sentence = span.sentence || span.matched_text || "";
  const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
  const normalizedLength = Math.min(1.0, Math.max(0.0, (wordCount - 4) / 46));

  // Section type heuristic from span position or subcategory
  let sectionScore = 0.7; // default work experience
  if (span.subcategory?.includes("graduation") || span.subcategory?.includes("pedigree")) {
    sectionScore = 0.5; // education
  } else if (span.subcategory?.includes("summary") || (span.start < 300)) {
    sectionScore = 0.9; // summary
  } else if (span.subcategory?.includes("skill")) {
    sectionScore = 0.3; // skills
  }

  // Historical user satisfaction rate bounded to [0.0, 1.0]
  const historyScore = Math.min(1.0, Math.max(0.0, historicalSatisfactionRate));

  // Intercept term for linear model
  const intercept = 1.0;

  const features: number[] = [
    Number(categoryScore.toFixed(3)),
    Number(severityScore.toFixed(3)),
    Number(confidenceScore.toFixed(3)),
    Number(contextScore.toFixed(3)),
    Number(normalizedLength.toFixed(3)),
    Number(sectionScore.toFixed(3)),
    Number(historyScore.toFixed(3)),
    intercept,
  ];

  if (features.length !== STATE_DIMENSION) {
    throw new Error(`State feature length mismatch: expected ${STATE_DIMENSION}, got ${features.length}`);
  }

  const featureNames = [
    "bias_category_encoding",
    "severity_level_weight",
    "detector_confidence",
    "contextual_syntax_type",
    "normalized_sentence_length",
    "document_section_type",
    "historical_category_satisfaction",
    "constant_intercept",
  ];

  return {
    features,
    featureNames,
    rawContext: {
      category: span.category,
      severity: span.severity,
      confidence: span.confidence,
      contextType,
      sentenceLength: wordCount,
      historicalSatisfactionRate: historyScore,
    },
  };
}
