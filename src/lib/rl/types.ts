/**
 * @file types.ts
 * Reinforcement Learning (Contextual Multi-Armed Bandit) type definitions,
 * state space encoding, action space, and feedback reward contracts.
 */

import type { BiasCategory, SeverityLevel } from "../resume-contract";

export const RL_ACTION_IDS = {
  NEUTRAL_REPHRASE: "neutral_rephrase",
  REDACT_PERSONAL_INFO: "redact_personal_info",
  CONTEXTUAL_FRAMING: "contextual_framing",
  COMPETENCY_SUBSTITUTION: "competency_substitution",
  HUMAN_REVIEW_FLAG: "human_review_flag",
} as const;

export type RecommendationActionId =
  (typeof RL_ACTION_IDS)[keyof typeof RL_ACTION_IDS];

export const ACTION_METADATA: Record<
  RecommendationActionId,
  { label: string; description: string; strategy: string }
> = {
  neutral_rephrase: {
    label: "Neutral Rephrase",
    description: "Replaces skewed or exclusionary wording with objective, outcome-oriented descriptors.",
    strategy: "Focuses on collaborative and achievement-oriented phrasing without individualistic bias.",
  },
  redact_personal_info: {
    label: "Omit / Redact Detail",
    description: "Recommends omitting unnecessary demographic or pedigree markers (e.g., graduation year > 10 yrs).",
    strategy: "Prevents algorithmic and human age/pedigree bias by removing non-predictive personal markers.",
  },
  contextual_framing: {
    label: "Constructive Context Framing",
    description: "Frames career breaks or non-linear trajectories with professional upskilling or sabbatical terms.",
    strategy: "Presents continuous learning, caregiving, or intentional career pauses affirmatively.",
  },
  competency_substitution: {
    label: "Competency Substitution",
    description: "Replaces informal tech-culture jargon ('rockstar', 'ninja') with verifiable domain skills.",
    strategy: "Aligns terminology directly with measurable technical competencies and standard job rubrics.",
  },
  human_review_flag: {
    label: "Human Review Flag",
    description: "Requests manual human reviewer inspection when phrasing is borderline or polysemous.",
    strategy: "Protects candidates from automated false alarms by escalating ambiguous signals to humans.",
  },
};

/**
 * Normalized 8-Dimensional Contextual State Feature Vector:
 * 
 * Index 0: Bias Category Numeric Encoding [0.0 - 1.0]
 * Index 1: Severity Score (low: 0.25, medium: 0.58, high: 1.0)
 * Index 2: Bias Detector Confidence [0.0 - 1.0]
 * Index 3: Context Type Indicator (leadership: 0.8, technical: 0.2, pedigree: 0.5, gap: 0.6, other: 0.4)
 * Index 4: Normalized Sentence Length (min 5 words -> 0.0, max 60 words -> 1.0)
 * Index 5: Document Section Type (summary: 0.9, experience: 0.7, education: 0.5, skills: 0.3, other: 0.1)
 * Index 6: Historical Category User Satisfaction Rate [0.0 - 1.0]
 * Index 7: Bias Offset / Constant Intercept = 1.0
 */
export const STATE_DIMENSION = 8;

export interface StateVector {
  features: number[]; // Length exactly STATE_DIMENSION
  featureNames: string[];
  rawContext: {
    category: BiasCategory;
    severity: SeverityLevel;
    confidence: number;
    contextType?: string;
    sectionName?: string;
    sentenceLength: number;
    historicalSatisfactionRate: number;
  };
}

export interface RecommendationOption {
  actionId: RecommendationActionId;
  label: string;
  suggestedText: string;
  rationale: string;
  strategyDescription: string;
  isEvidenceSupported: boolean;
  expectedReward: number; // Linear prediction: theta_a^T * x
  explorationBonus: number; // LinUCB bonus: alpha * sqrt(x^T * A_a^-1 * x)
  confidenceBound: number; // Upper Confidence Bound: expectedReward + explorationBonus
}

export interface RLRecommendationSelection {
  spanId: string;
  selectedAction: RecommendationActionId;
  selectedOption: RecommendationOption;
  allOptions: RecommendationOption[];
  decisionSource: "rl_policy" | "fallback_rule";
  policyVersion: string;
  stateFeatures: Record<string, number>;
  reasoning: string;
  historicalCategoryStats: {
    totalInteractions: number;
    positiveRate: number;
  };
}

export type FeedbackRating =
  | "helpful"
  | "partially_helpful"
  | "accepted"
  | "dismissed"
  | "not_helpful"
  | "incorrect";

export const REWARD_SCALE: Record<FeedbackRating, number> = {
  helpful: 1.0,
  accepted: 1.0,
  partially_helpful: 0.5,
  dismissed: -0.2,
  not_helpful: -0.5,
  incorrect: -1.0,
};

export interface UserFeedbackRecord {
  feedbackId: string;
  spanId: string;
  category: BiasCategory;
  actionId: RecommendationActionId;
  rating: FeedbackRating;
  numericReward: number;
  suggestedText: string;
  userEditedText?: string;
  comment?: string;
  policyVersion: string;
  stateVector: number[];
  timestamp: string;
}

export interface SerializedBanditPolicy {
  version: string;
  createdAt: string;
  updatedAt: string;
  dimension: number;
  alpha: number;
  totalUpdatesCount: number;
  actions: Record<
    RecommendationActionId,
    {
      // Flattened matrix A (dimension x dimension)
      A: number[];
      // Bias vector b (dimension)
      b: number[];
      // Precomputed weight vector theta (dimension)
      theta: number[];
      pullCount: number;
    }
  >;
}
