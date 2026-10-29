/**
 * @file recommendation-engine.ts
 * RL-based recommendation selection and prioritization engine.
 * Selects the optimal bias mitigation recommendation using LinUCB contextual bandit
 * while strictly preserving the underlying bias detector and baseline rule fallback.
 */

import type { BiasSpan, RewriteSuggestion } from "../resume-contract";
import { globalBanditPolicy, LinUCBBanditPolicy } from "./bandit-policy";
import { globalFeedbackStore, FeedbackStore } from "./feedback-store";
import { encodeStateVector } from "./state-encoder";
import {
  ACTION_METADATA,
  RL_ACTION_IDS,
  type RecommendationActionId,
  type RecommendationOption,
  type RLRecommendationSelection,
} from "./types";

/**
 * Checks whether a candidate action is genuinely supported by the textual evidence of the span.
 * Prevents the RL agent from selecting an unsupported or contradictory recommendation.
 */
export function isActionEvidenceSupported(
  actionId: RecommendationActionId,
  span: BiasSpan,
): boolean {
  const text = (span.matched_text || "").toLowerCase();
  const subcategory = (span.subcategory || "").toLowerCase();
  const category = span.category;

  switch (actionId) {
    case RL_ACTION_IDS.REDACT_PERSONAL_INFO:
      // Supported for graduation years, age markers, or personal pedigree details
      return (
        category === "age_indicative" ||
        subcategory.includes("graduation") ||
        subcategory.includes("age") ||
        subcategory.includes("pedigree") ||
        /^(19\d\d|200\d|201[0-4])$/.test(text)
      );

    case RL_ACTION_IDS.CONTEXTUAL_FRAMING:
      // Supported for career gaps, sabbaticals, or parental/caregiving leaves
      return (
        category === "gap_framing" ||
        subcategory.includes("gap") ||
        subcategory.includes("career_break") ||
        text.includes("gap") ||
        text.includes("sabbatical")
      );

    case RL_ACTION_IDS.COMPETENCY_SUBSTITUTION:
      // Supported for bro-culture buzzwords or subjective superlatives
      return (
        subcategory.includes("ninja") ||
        subcategory.includes("rockstar") ||
        subcategory.includes("jargon") ||
        text.includes("rockstar") ||
        text.includes("ninja") ||
        text.includes("guru") ||
        text.includes("wizard")
      );

    case RL_ACTION_IDS.HUMAN_REVIEW_FLAG:
      // Supported when confidence is borderline or finding involves polysemy
      return span.confidence <= 0.9 || category === "prestige_proxy";

    case RL_ACTION_IDS.NEUTRAL_REPHRASE:
    default:
      // Standard neutral rephrase is universally valid for wording issues
      return true;
  }
}

/**
 * Generates candidate mitigation options for a given span.
 */
export function generateCandidateOptions(
  span: BiasSpan,
  baselineSuggestion?: RewriteSuggestion,
): RecommendationOption[] {
  const text = span.matched_text || "";
  const subcategory = (span.subcategory || "").toLowerCase();
  const baseReplacement = baselineSuggestion?.suggested_text ?? "";
  const baseRationale = baselineSuggestion?.rationale ?? span.explanation ?? "";

  const options: RecommendationOption[] = [];

  // 1. Neutral Rephrase
  let neutralText = baseReplacement;
  if (!neutralText) {
    if (span.category === "gender_coded") neutralText = "collaborative and goal-oriented";
    else if (span.category === "personality_behavioral") neutralText = "constructive and team-focused";
    else neutralText = "objective achievement";
  }
  options.push({
    actionId: RL_ACTION_IDS.NEUTRAL_REPHRASE,
    label: ACTION_METADATA.neutral_rephrase.label,
    suggestedText: neutralText,
    rationale: baseRationale || "Replaces subjective terminology with balanced, achievement-focused wording.",
    strategyDescription: ACTION_METADATA.neutral_rephrase.strategy,
    isEvidenceSupported: isActionEvidenceSupported(RL_ACTION_IDS.NEUTRAL_REPHRASE, span),
    expectedReward: 0,
    explorationBonus: 0,
    confidenceBound: 0,
  });

  // 2. Redact / Omit Personal Info
  if (isActionEvidenceSupported(RL_ACTION_IDS.REDACT_PERSONAL_INFO, span)) {
    options.push({
      actionId: RL_ACTION_IDS.REDACT_PERSONAL_INFO,
      label: ACTION_METADATA.redact_personal_info.label,
      suggestedText: "", // Omit date or pedigree
      rationale: "Omits graduation year or pedigree proxy to shield candidate from automated algorithmic filtering.",
      strategyDescription: ACTION_METADATA.redact_personal_info.strategy,
      isEvidenceSupported: true,
      expectedReward: 0,
      explorationBonus: 0,
      confidenceBound: 0,
    });
  }

  // 3. Contextual Framing
  if (isActionEvidenceSupported(RL_ACTION_IDS.CONTEXTUAL_FRAMING, span)) {
    options.push({
      actionId: RL_ACTION_IDS.CONTEXTUAL_FRAMING,
      label: ACTION_METADATA.contextual_framing.label,
      suggestedText: "professional development sabbatical",
      rationale: "Frames career pauses with constructive skill-advancement and continuous learning terminology.",
      strategyDescription: ACTION_METADATA.contextual_framing.strategy,
      isEvidenceSupported: true,
      expectedReward: 0,
      explorationBonus: 0,
      confidenceBound: 0,
    });
  }

  // 4. Competency Substitution
  if (isActionEvidenceSupported(RL_ACTION_IDS.COMPETENCY_SUBSTITUTION, span)) {
    options.push({
      actionId: RL_ACTION_IDS.COMPETENCY_SUBSTITUTION,
      label: ACTION_METADATA.competency_substitution.label,
      suggestedText: "high-velocity software engineer",
      rationale: "Replaces informal buzzwords with concrete, verifiable engineering competencies.",
      strategyDescription: ACTION_METADATA.competency_substitution.strategy,
      isEvidenceSupported: true,
      expectedReward: 0,
      explorationBonus: 0,
      confidenceBound: 0,
    });
  }

  // 5. Human Review Flag
  if (isActionEvidenceSupported(RL_ACTION_IDS.HUMAN_REVIEW_FLAG, span)) {
    options.push({
      actionId: RL_ACTION_IDS.HUMAN_REVIEW_FLAG,
      label: ACTION_METADATA.human_review_flag.label,
      suggestedText: text, // Keep original pending human reviewer evaluation
      rationale: "Borderline contextual finding: human reviewer verification recommended before modifying text.",
      strategyDescription: ACTION_METADATA.human_review_flag.strategy,
      isEvidenceSupported: true,
      expectedReward: 0,
      explorationBonus: 0,
      confidenceBound: 0,
    });
  }

  return options;
}

/**
 * Main selection pipeline:
 * Evaluates candidate options using LinUCB policy and selects the optimal recommendation.
 */
export function selectMitigationRecommendation(
  span: BiasSpan,
  baselineSuggestion?: RewriteSuggestion,
  policy: LinUCBBanditPolicy = globalBanditPolicy,
  feedbackStore: FeedbackStore = globalFeedbackStore,
): RLRecommendationSelection {
  const categoryStats = feedbackStore.getCategoryStats(span.category);
  const state = encodeStateVector(span, categoryStats.satisfactionRate);

  // 1. Generate eligible candidate options
  const candidateOptions = generateCandidateOptions(span, baselineSuggestion);

  // Filter only evidence-supported options
  const supportedOptions = candidateOptions.filter((opt) => opt.isEvidenceSupported);
  const eligibleActions = supportedOptions.map((opt) => opt.actionId);

  try {
    // 2. Score all options with LinUCB
    for (const opt of candidateOptions) {
      const evalArm = policy.evaluateArm(opt.actionId, state);
      opt.expectedReward = evalArm.expectedReward;
      opt.explorationBonus = evalArm.explorationBonus;
      opt.confidenceBound = evalArm.ucb;
    }

    // 3. Select action with highest UCB among evidence-supported arms
    const selection = policy.selectAction(state, eligibleActions);
    const chosenOption =
      candidateOptions.find((opt) => opt.actionId === selection.selectedAction) ||
      candidateOptions[0];

    // Sort options so the prioritized one is first
    const sortedOptions = [...candidateOptions].sort((a, b) => b.confidenceBound - a.confidenceBound);

    // 4. Construct explainability narrative
    const reasoning = generateSelectionReasoning({
      span,
      chosenOption,
      expectedReward: selection.expectedReward,
      bonus: selection.explorationBonus,
      categoryStats,
      policyVersion: policy.getVersion(),
    });

    return {
      spanId: span.id,
      selectedAction: chosenOption.actionId,
      selectedOption: chosenOption,
      allOptions: sortedOptions,
      decisionSource: "rl_policy",
      policyVersion: policy.getVersion(),
      stateFeatures: {
        category_affinity: state.features[0],
        severity_weight: state.features[1],
        confidence_score: state.features[2],
        context_syntax: state.features[3],
        sentence_length: state.features[4],
        section_type: state.features[5],
        historical_satisfaction: state.features[6],
      },
      reasoning,
      historicalCategoryStats: {
        totalInteractions: categoryStats.total,
        positiveRate: categoryStats.satisfactionRate,
      },
    };
  } catch (err) {
    // Safe fallback to baseline rule recommendation
    console.warn("[RecommendationEngine] RL selection fallback triggered:", err);

    const fallbackOption: RecommendationOption = {
      actionId: RL_ACTION_IDS.NEUTRAL_REPHRASE,
      label: "Default Rule Recommendation",
      suggestedText: baselineSuggestion?.suggested_text || span.matched_text,
      rationale: baselineSuggestion?.rationale || span.explanation,
      strategyDescription: "Rule-based fallback from heuristic taxonomy dictionary.",
      isEvidenceSupported: true,
      expectedReward: 0.5,
      explorationBonus: 0,
      confidenceBound: 0.5,
    };

    return {
      spanId: span.id,
      selectedAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
      selectedOption: fallbackOption,
      allOptions: [fallbackOption],
      decisionSource: "fallback_rule",
      policyVersion: "baseline_fallback",
      stateFeatures: {},
      reasoning: "Selected via baseline rule heuristic because RL policy was bypassed or unavailable.",
      historicalCategoryStats: {
        totalInteractions: categoryStats.total,
        positiveRate: categoryStats.satisfactionRate,
      },
    };
  }
}

function generateSelectionReasoning(params: {
  span: BiasSpan;
  chosenOption: RecommendationOption;
  expectedReward: number;
  bonus: number;
  categoryStats: { total: number; satisfactionRate: number };
  policyVersion: string;
}): string {
  const { span, chosenOption, expectedReward, bonus, categoryStats, policyVersion } = params;

  let rationale = `The RL recommendation agent (${policyVersion}) prioritized "${chosenOption.label}" `;
  rationale += `for finding "${span.matched_text}" (${span.category}, ${span.severity} severity). `;
  rationale += `Based on contextual features, the policy estimated an expected usefulness reward of ${expectedReward.toFixed(2)} `;
  rationale += `with an exploration confidence bound of +${bonus.toFixed(2)}. `;

  if (categoryStats.total > 0) {
    rationale += `Historical user feedback in category "${span.category}" has a ${(categoryStats.satisfactionRate * 100).toFixed(0)}% `;
    rationale += `satisfaction rate across ${categoryStats.total} previous interactions. `;
  } else {
    rationale += `Policy is operating with research-calibrated prior weights for ${span.category}. `;
  }

  rationale += `Selected strategy: ${chosenOption.strategyDescription}`;
  return rationale;
}
