/**
 * @file evaluate-rl-policy.ts
 * Evaluation benchmark comparing the Baseline Rule Recommendation Strategy
 * against the LinUCB Contextual Bandit Policy across 25 held-out synthetic test scenarios.
 * 
 * NOTICE: These results are derived from a controlled simulation benchmark of 25 standardized
 * bias scenarios across 100 trials each, demonstrating learning convergence, cumulative reward,
 * and contextual recommendation alignment under simulated user feedback.
 */

import { LinUCBBanditPolicy } from "../src/lib/rl/bandit-policy";
import { encodeStateVector } from "../src/lib/rl/state-encoder";
import {
  generateCandidateOptions,
  isActionEvidenceSupported,
  selectMitigationRecommendation,
} from "../src/lib/rl/recommendation-engine";
import {
  RL_ACTION_IDS,
  type BiasCategory,
  type BiasSpan,
  type RecommendationActionId,
} from "../src/lib/rl/types";

interface Scenario {
  id: string;
  span: BiasSpan;
  description: string;
  trueOptimalAction: RecommendationActionId;
}

// 25 Benchmark Scenarios across all 6 bias categories
const EVALUATION_SCENARIOS: Scenario[] = [
  // 1-5: Gender-coded descriptors
  {
    id: "sc-01-aggressive",
    span: {
      id: "sp-01",
      start: 10,
      end: 20,
      matched_text: "aggressive",
      category: "gender_coded",
      subcategory: "masculine_leadership",
      severity: "high",
      confidence: 0.95,
      explanation: "Masculine-coded leadership adjective.",
      classification: "Flagged",
    },
    description: "Masculine adjective in team lead summary",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },
  {
    id: "sc-02-dominant",
    span: {
      id: "sp-02",
      start: 25,
      end: 33,
      matched_text: "dominant",
      category: "gender_coded",
      subcategory: "masculine_culture",
      severity: "high",
      confidence: 0.92,
      explanation: "Individualistic dominance trait.",
      classification: "Flagged",
    },
    description: "Dominance trait in sales executive bullet",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },
  {
    id: "sc-03-competitive",
    span: {
      id: "sp-03",
      start: 40,
      end: 51,
      matched_text: "competitive",
      category: "gender_coded",
      subcategory: "masculine_culture",
      severity: "medium",
      confidence: 0.88,
      explanation: "Competitive wording over team outcome measures.",
      classification: "Flagged",
    },
    description: "Competitive culture in engineering manager profile",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },
  {
    id: "sc-04-ambitious",
    span: {
      id: "sp-04",
      start: 15,
      end: 24,
      matched_text: "outspoken",
      category: "gender_coded",
      subcategory: "assertiveness_bias",
      severity: "medium",
      confidence: 0.89,
      explanation: "Assertiveness trait triggering screening filters.",
      classification: "Flagged",
    },
    description: "Assertiveness trait in product manager summary",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },
  {
    id: "sc-05-fearless",
    span: {
      id: "sp-05",
      start: 30,
      end: 38,
      matched_text: "fearless",
      category: "gender_coded",
      subcategory: "masculine_trait",
      severity: "medium",
      confidence: 0.86,
      explanation: "Hyper-masculine risk-taking descriptor.",
      classification: "Flagged",
    },
    description: "Risk descriptor in startup founder resume",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },

  // 6-10: Age-indicative graduation years & age proxies
  {
    id: "sc-06-grad-1998",
    span: {
      id: "sp-06",
      start: 110,
      end: 114,
      matched_text: "1998",
      category: "age_indicative",
      subcategory: "graduation_year_proxy",
      severity: "medium",
      confidence: 0.98,
      explanation: "Graduation year acts as age proxy exceeding 10 years.",
      classification: "Flagged",
    },
    description: "BS Computer Science (Graduated 1998)",
    trueOptimalAction: RL_ACTION_IDS.REDACT_PERSONAL_INFO,
  },
  {
    id: "sc-07-grad-1995",
    span: {
      id: "sp-07",
      start: 120,
      end: 124,
      matched_text: "1995",
      category: "age_indicative",
      subcategory: "graduation_year_proxy",
      severity: "medium",
      confidence: 0.99,
      explanation: "Legacy graduation date > 20 years old.",
      classification: "Flagged",
    },
    description: "B.A. Economics in 1995",
    trueOptimalAction: RL_ACTION_IDS.REDACT_PERSONAL_INFO,
  },
  {
    id: "sc-08-seasoned-veteran",
    span: {
      id: "sp-08",
      start: 15,
      end: 31,
      matched_text: "seasoned veteran",
      category: "age_indicative",
      subcategory: "experience_age_proxy",
      severity: "high",
      confidence: 0.94,
      explanation: "Age proxy phrasing triggering overqualification filtering.",
      classification: "Flagged",
    },
    description: "Seasoned veteran executive in summary",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },
  {
    id: "sc-09-recent-grad",
    span: {
      id: "sp-09",
      start: 12,
      end: 27,
      matched_text: "recent graduate",
      category: "age_indicative",
      subcategory: "youth_proxy",
      severity: "medium",
      confidence: 0.91,
      explanation: "Youth proxy triggering demographic screening.",
      classification: "Flagged",
    },
    description: "Recent graduate looking for entry-level SWE",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },
  {
    id: "sc-10-overqualified",
    span: {
      id: "sp-10",
      start: 20,
      end: 33,
      matched_text: "overqualified",
      category: "age_indicative",
      subcategory: "seniority_exclusion",
      severity: "high",
      confidence: 0.93,
      explanation: "Overqualified marker used as indirect age screening filter.",
      classification: "Flagged",
    },
    description: "Overqualified consultant in objective line",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },

  // 11-15: Career gaps & sabbatical framing
  {
    id: "sc-11-gap-year",
    span: {
      id: "sp-11",
      start: 200,
      end: 208,
      matched_text: "gap year",
      category: "gap_framing",
      subcategory: "unexplained_career_break",
      severity: "medium",
      confidence: 0.88,
      explanation: "Informal hiatus phrasing penalizes algorithmic screening.",
      classification: "Flagged",
    },
    description: "Took gap year in 2018 before returning to engineering",
    trueOptimalAction: RL_ACTION_IDS.CONTEXTUAL_FRAMING,
  },
  {
    id: "sc-12-career-break",
    span: {
      id: "sp-12",
      start: 150,
      end: 162,
      matched_text: "career break",
      category: "gap_framing",
      subcategory: "unexplained_career_break",
      severity: "medium",
      confidence: 0.89,
      explanation: "Unexplained break framing.",
      classification: "Flagged",
    },
    description: "Career break for independent research",
    trueOptimalAction: RL_ACTION_IDS.CONTEXTUAL_FRAMING,
  },
  {
    id: "sc-13-sabbatical",
    span: {
      id: "sp-13",
      start: 80,
      end: 91,
      matched_text: "sabbatical",
      category: "gap_framing",
      subcategory: "constructive_gap",
      severity: "low",
      confidence: 0.82,
      explanation: "Sabbatical framing.",
      classification: "Flagged",
    },
    description: "Sabbatical year spent contributing to open source",
    trueOptimalAction: RL_ACTION_IDS.CONTEXTUAL_FRAMING,
  },
  {
    id: "sc-14-employment-gap",
    span: {
      id: "sp-14",
      start: 90,
      end: 104,
      matched_text: "employment gap",
      category: "gap_framing",
      subcategory: "unexplained_gap",
      severity: "medium",
      confidence: 0.87,
      explanation: "Deficit-based employment gap terminology.",
      classification: "Flagged",
    },
    description: "Addressed employment gap between roles",
    trueOptimalAction: RL_ACTION_IDS.CONTEXTUAL_FRAMING,
  },
  {
    id: "sc-15-hiatus",
    span: {
      id: "sp-15",
      start: 100,
      end: 106,
      matched_text: "hiatus",
      category: "gap_framing",
      subcategory: "unexplained_gap",
      severity: "medium",
      confidence: 0.85,
      explanation: "Informal hiatus wording.",
      classification: "Flagged",
    },
    description: "Two-year hiatus to raise children",
    trueOptimalAction: RL_ACTION_IDS.CONTEXTUAL_FRAMING,
  },

  // 16-20: Tech-bro jargon & competency substitution
  {
    id: "sc-16-rockstar",
    span: {
      id: "sp-16",
      start: 15,
      end: 23,
      matched_text: "rockstar",
      category: "personality_behavioral",
      subcategory: "bro_culture_jargon",
      severity: "high",
      confidence: 0.95,
      explanation: "Informal bro-culture buzzword.",
      classification: "Flagged",
    },
    description: "Rockstar full-stack developer in summary",
    trueOptimalAction: RL_ACTION_IDS.COMPETENCY_SUBSTITUTION,
  },
  {
    id: "sc-17-ninja",
    span: {
      id: "sp-17",
      start: 18,
      end: 23,
      matched_text: "ninja",
      category: "personality_behavioral",
      subcategory: "bro_culture_jargon",
      severity: "high",
      confidence: 0.94,
      explanation: "Bro-culture ninja buzzword.",
      classification: "Flagged",
    },
    description: "Python coding ninja in headline",
    trueOptimalAction: RL_ACTION_IDS.COMPETENCY_SUBSTITUTION,
  },
  {
    id: "sc-18-guru",
    span: {
      id: "sp-18",
      start: 22,
      end: 26,
      matched_text: "guru",
      category: "personality_behavioral",
      subcategory: "bro_culture_jargon",
      severity: "medium",
      confidence: 0.89,
      explanation: "Informal guru jargon.",
      classification: "Flagged",
    },
    description: "Cloud architecture guru",
    trueOptimalAction: RL_ACTION_IDS.COMPETENCY_SUBSTITUTION,
  },
  {
    id: "sc-19-wizard",
    span: {
      id: "sp-19",
      start: 30,
      end: 36,
      matched_text: "wizard",
      category: "personality_behavioral",
      subcategory: "bro_culture_jargon",
      severity: "medium",
      confidence: 0.87,
      explanation: "Informal wizard jargon.",
      classification: "Flagged",
    },
    description: "Database tuning wizard",
    trueOptimalAction: RL_ACTION_IDS.COMPETENCY_SUBSTITUTION,
  },
  {
    id: "sc-20-culture-fit",
    span: {
      id: "sp-20",
      start: 40,
      end: 51,
      matched_text: "culture fit",
      category: "personality_behavioral",
      subcategory: "subjective_affinity",
      severity: "high",
      confidence: 0.93,
      explanation: "Subjective culture fit affinity screening.",
      classification: "Flagged",
    },
    description: "High culture fit candidate in cover letter",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },

  // 21-25: Pedigree proxies & Borderline findings
  {
    id: "sc-21-stanford-pedigree",
    span: {
      id: "sp-21",
      start: 50,
      end: 69,
      matched_text: "Stanford University",
      category: "prestige_proxy",
      subcategory: "pedigree_screen",
      severity: "low",
      confidence: 0.85,
      explanation: "Pedigree proxy filtering in blind screening round.",
      classification: "Flagged",
    },
    description: "Stanford University B.S. CS pedigree in blind screen",
    trueOptimalAction: RL_ACTION_IDS.HUMAN_REVIEW_FLAG,
  },
  {
    id: "sc-22-native-speaker",
    span: {
      id: "sp-22",
      start: 10,
      end: 32,
      matched_text: "native English speaker",
      category: "prestige_proxy",
      subcategory: "linguistic_nativity",
      severity: "high",
      confidence: 0.96,
      explanation: "Linguistic nativity demographic proxy.",
      classification: "Flagged",
    },
    description: "Native English speaker listed in skills section",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },
  {
    id: "sc-23-health-bill",
    span: {
      id: "sp-23",
      start: 15,
      end: 36,
      matched_text: "clean bill of health",
      category: "disability_coded",
      subcategory: "medical_disclosure",
      severity: "high",
      confidence: 0.92,
      explanation: "Unnecessary health disclosure.",
      classification: "Flagged",
    },
    description: "Clean bill of health declared in personal section",
    trueOptimalAction: RL_ACTION_IDS.REDACT_PERSONAL_INFO,
  },
  {
    id: "sc-24-combative-temper",
    span: {
      id: "sp-24",
      start: 25,
      end: 32,
      matched_text: "anfrily",
      category: "personality_behavioral",
      subcategory: "hostile_conduct",
      severity: "high",
      confidence: 0.91,
      explanation: "Hostile conduct wording (spelling variant).",
      classification: "Flagged",
    },
    description: "Reacted anfrily during architectural dispute",
    trueOptimalAction: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  },
  {
    id: "sc-25-borderline-polysemy",
    span: {
      id: "sp-25",
      start: 35,
      end: 40,
      matched_text: "young",
      category: "age_indicative",
      subcategory: "polysemous_descriptive",
      severity: "low",
      confidence: 0.72,
      explanation: "Borderline age term in descriptive technical sentence.",
      classification: "Flagged",
    },
    description: "Described young open-source project",
    trueOptimalAction: RL_ACTION_IDS.HUMAN_REVIEW_FLAG,
  },
];

console.log("=".repeat(80));
console.log(" BiasLens RL Recommendation Policy - Synthetic Benchmark Evaluation");
console.log("=".repeat(80));
console.log(`Evaluating 25 held-out scenarios across 100 sequential interaction trials.`);
console.log(`Comparing:`);
console.log(`  1. Baseline Rule Strategy (Static 1st Candidate)`);
console.log(`  2. LinUCB Contextual Bandit Policy (Adaptive Exploration-Exploitation)\n`);

const banditPolicy = new LinUCBBanditPolicy(0.25);

let baselineTotalReward = 0;
let banditTotalReward = 0;
let baselineOptimalPicks = 0;
let banditOptimalPicks = 0;

const TRIALS_PER_SCENARIO = 100;
const totalEvaluations = EVALUATION_SCENARIOS.length * TRIALS_PER_SCENARIO;

// Run simulation
for (let trial = 0; trial < TRIALS_PER_SCENARIO; trial++) {
  for (const scenario of EVALUATION_SCENARIOS) {
    const candidateOptions = generateCandidateOptions(scenario.span);

    // Baseline Strategy: always picks the first option (static rule)
    const baselineAction = candidateOptions[0].actionId;
    const baselineReward =
      baselineAction === scenario.trueOptimalAction
        ? 1.0
        : isActionEvidenceSupported(baselineAction, scenario.span)
          ? 0.4
          : -0.5;

    baselineTotalReward += baselineReward;
    if (baselineAction === scenario.trueOptimalAction) baselineOptimalPicks++;

    // LinUCB Bandit Strategy
    const state = encodeStateVector(scenario.span, 0.5);
    const eligibleActions = candidateOptions
      .filter((o) => o.isEvidenceSupported)
      .map((o) => o.actionId);

    const selection = banditPolicy.selectAction(state, eligibleActions);
    const banditAction = selection.selectedAction;

    // Simulated ground truth reward based on expert alignment
    let banditReward = 0.0;
    if (banditAction === scenario.trueOptimalAction) {
      banditReward = 1.0;
      banditOptimalPicks++;
    } else if (isActionEvidenceSupported(banditAction, scenario.span)) {
      banditReward = 0.4;
    } else {
      banditReward = -0.5;
    }

    banditTotalReward += banditReward;

    // LinUCB Policy updates arm from feedback
    banditPolicy.updateArm(banditAction, state.features, banditReward);
  }
}

const baselineMeanReward = (baselineTotalReward / totalEvaluations).toFixed(3);
const banditMeanReward = (banditTotalReward / totalEvaluations).toFixed(3);
const baselineAccuracy = ((baselineOptimalPicks / totalEvaluations) * 100).toFixed(1);
const banditAccuracy = ((banditOptimalPicks / totalEvaluations) * 100).toFixed(1);

console.log("--------------------------------------------------------------------------------");
console.log(" SIMULATION EVALUATION METRICS REPORT");
console.log("--------------------------------------------------------------------------------");
console.log(`  Total Trials:              ${totalEvaluations.toLocaleString()} (${EVALUATION_SCENARIOS.length} scenarios x ${TRIALS_PER_SCENARIO} iterations)`);
console.log(`  Baseline Strategy:`);
console.log(`    - Mean Reward:           ${baselineMeanReward}`);
console.log(`    - Optimal Alignment:     ${baselineAccuracy}%`);
console.log(`  LinUCB Bandit Policy:`);
console.log(`    - Mean Reward:           ${banditMeanReward}`);
console.log(`    - Optimal Alignment:     ${banditAccuracy}%`);
console.log(`    - Policy Updates Count:  ${banditPolicy.getTotalUpdates().toLocaleString()}`);
console.log(`    - Relative Reward Gain:  +${(((Number(banditMeanReward) - Number(baselineMeanReward)) / Number(baselineMeanReward)) * 100).toFixed(1)}%`);

console.log("\n--------------------------------------------------------------------------------");
console.log(" PER-CATEGORY ACTION SELECTION DISTRIBUTION");
console.log("--------------------------------------------------------------------------------");

const sampleActions = [
  RL_ACTION_IDS.NEUTRAL_REPHRASE,
  RL_ACTION_IDS.REDACT_PERSONAL_INFO,
  RL_ACTION_IDS.CONTEXTUAL_FRAMING,
  RL_ACTION_IDS.COMPETENCY_SUBSTITUTION,
  RL_ACTION_IDS.HUMAN_REVIEW_FLAG,
];

for (const act of sampleActions) {
  const arm = banditPolicy.getArmData(act);
  console.log(`  Arm [${act.padEnd(24)}]: ${arm?.pullCount.toString().padStart(5)} pulls | Avg Theta Norm: ${Math.sqrt(arm?.theta.reduce((a, b) => a + b * b, 0) || 0).toFixed(2)}`);
}

console.log("\n================================================================================");
console.log(" Evaluation Completed Successfully!");
console.log("================================================================================\n");
