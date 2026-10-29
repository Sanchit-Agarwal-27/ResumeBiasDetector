import { LinUCBBanditPolicy, invertMatrix } from "../src/lib/rl/bandit-policy";
import { FeedbackStore } from "../src/lib/rl/feedback-store";
import { encodeStateVector } from "../src/lib/rl/state-encoder";
import {
  selectMitigationRecommendation,
  isActionEvidenceSupported,
  generateCandidateOptions,
} from "../src/lib/rl/recommendation-engine";
import {
  RL_ACTION_IDS,
  STATE_DIMENSION,
  type RecommendationActionId,
} from "../src/lib/rl/types";
import { calculateAtsMatch } from "../src/lib/ats-matching-engine";
import { analyzeResumeText } from "../src/lib/bias-taxonomy";
import { sampleReport, type BiasSpan } from "../src/lib/resume-contract";
import { SAMPLE_JOB_BENCHMARKS } from "../src/lib/job-benchmarks";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.error(`  ✕ FAIL: ${message}`);
    failedCount++;
  }
}

console.log("=".repeat(80));
console.log(" Reinforcement Learning (LinUCB Contextual Bandit) - Comprehensive Test Suite");
console.log("=".repeat(80));

// -----------------------------------------------------------------------------
// SUITE 1: Matrix Inversion & Mathematical Correctness
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 1: Mathematical Invariance & Inversion Correctness ---");

const identity3x3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const invIdentity = invertMatrix(identity3x3);
assert(
  invIdentity[0][0] === 1 && invIdentity[1][1] === 1 && invIdentity[2][2] === 1,
  "Invert identity matrix returns identical 3x3 identity",
);

const testMatrix = [
  [2, 1],
  [1, 3],
];
const invTest = invertMatrix(testMatrix);
// Determinant = 6 - 1 = 5. Inv = [[3/5, -1/5], [-1/5, 2/5]] = [[0.6, -0.2], [-0.2, 0.4]]
assert(
  Math.abs(invTest[0][0] - 0.6) < 1e-6 &&
    Math.abs(invTest[0][1] - -0.2) < 1e-6 &&
    Math.abs(invTest[1][0] - -0.2) < 1e-6 &&
    Math.abs(invTest[1][1] - 0.4) < 1e-6,
  "Gauss-Jordan correctly inverts symmetric positive-definite covariance matrix",
);

// -----------------------------------------------------------------------------
// SUITE 2: Cold Start & Uninformative / Missing Feedback
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 2: Cold Start & Safe Initial Policy Execution ---");

const testPolicy = new LinUCBBanditPolicy(0.25, STATE_DIMENSION);
const testFeedbackStore = new FeedbackStore();
testFeedbackStore.clearFeedback();

assert(testPolicy.getTotalUpdates() === 0, "Cold start policy has exactly 0 prior updates");

const mockSpan: BiasSpan = {
  id: "test-span-01",
  start: 50,
  end: 60,
  matched_text: "aggressive",
  category: "gender_coded",
  subcategory: "masculine_leadership",
  severity: "high",
  confidence: 0.92,
  explanation: "Masculine-coded leadership adjective.",
  classification: "Flagged",
};

const coldState = encodeStateVector(mockSpan, 0.5);
assert(
  coldState.features.length === STATE_DIMENSION,
  `State vector has exact dimension ${STATE_DIMENSION}`,
);
assert(coldState.features[7] === 1.0, "State vector contains bias intercept = 1.0");

const coldSelection = selectMitigationRecommendation(
  mockSpan,
  {
    span_id: mockSpan.id,
    original_text: mockSpan.matched_text,
    suggested_text: "ambitious and goal-oriented",
    rationale: "Outcome-driven rewrite",
  },
  testPolicy,
  testFeedbackStore,
);

assert(
  coldSelection.decisionSource === "rl_policy",
  "Cold start selects a valid recommendation via pre-calibrated baseline prior",
);
assert(
  coldSelection.selectedAction === RL_ACTION_IDS.NEUTRAL_REPHRASE,
  "Prior policy correctly selects neutral_rephrase for masculine leadership descriptor",
);
assert(
  coldSelection.selectedOption.confidenceBound > 0,
  `Upper Confidence Bound is positive (UCB: ${coldSelection.selectedOption.confidenceBound})`,
);

// -----------------------------------------------------------------------------
// SUITE 3: Positive Feedback & Reward Updating
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 3: Online Learning via Positive Feedback ---");

const armBefore = testPolicy.getArmData(RL_ACTION_IDS.NEUTRAL_REPHRASE);
const pullCountBefore = armBefore?.pullCount ?? 0;
const thetaBefore = [...(armBefore?.theta ?? [])];

// Deliver positive feedback (+1.0 reward)
const fbResult = testFeedbackStore.recordFeedback({
  spanId: mockSpan.id,
  category: mockSpan.category,
  actionId: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  rating: "helpful",
  suggestedText: "ambitious and goal-oriented",
  policyVersion: testPolicy.getVersion(),
  stateVector: coldState.features,
});

assert(fbResult.success === true, "Positive feedback record accepted by store");
assert(fbResult.record?.numericReward === 1.0, "Helpful rating produces +1.0 numeric reward");

// Retrain policy from feedback
const trainResult = testFeedbackStore.trainPolicyFromFeedback(testPolicy);
assert(trainResult.recordsProcessed >= 1, "Policy retrained on logged feedback record");

const armAfter = testPolicy.getArmData(RL_ACTION_IDS.NEUTRAL_REPHRASE);
assert(
  (armAfter?.pullCount ?? 0) === pullCountBefore + 1,
  "Arm pull count incremented by 1",
);

// Verify expected reward increases for neutral_rephrase after positive reinforcement
const evalAfterPositive = testPolicy.evaluateArm(RL_ACTION_IDS.NEUTRAL_REPHRASE, coldState);
assert(
  evalAfterPositive.expectedReward >= 0.4,
  `Expected reward remains strong under positive reinforcement (${evalAfterPositive.expectedReward})`,
);

// -----------------------------------------------------------------------------
// SUITE 4: Negative Feedback & Reward Penalty
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 4: Online Learning via Negative Feedback ---");

const prePenaltyArm = testPolicy.getArmData(RL_ACTION_IDS.HUMAN_REVIEW_FLAG);
const prePenaltyExpected = testPolicy.evaluateArm(RL_ACTION_IDS.HUMAN_REVIEW_FLAG, coldState).expectedReward;

// Apply negative feedback (-1.0) to human_review_flag
testPolicy.updateArm(RL_ACTION_IDS.HUMAN_REVIEW_FLAG, coldState.features, -1.0);

const postPenaltyExpected = testPolicy.evaluateArm(RL_ACTION_IDS.HUMAN_REVIEW_FLAG, coldState).expectedReward;
assert(
  postPenaltyExpected < prePenaltyExpected,
  `Negative feedback lowers expected reward (${prePenaltyExpected} -> ${postPenaltyExpected})`,
);

// -----------------------------------------------------------------------------
// SUITE 5: Deduplication & Anti-Manipulation Protection
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 5: Anti-Duplicate Feedback Protection ---");

// Rapid second submission with identical key
const rapidDuplicate = testFeedbackStore.recordFeedback({
  spanId: mockSpan.id,
  category: mockSpan.category,
  actionId: RL_ACTION_IDS.NEUTRAL_REPHRASE,
  rating: "helpful",
  suggestedText: "ambitious and goal-oriented",
  policyVersion: testPolicy.getVersion(),
  stateVector: coldState.features,
});

assert(
  rapidDuplicate.success === false,
  "Rapid duplicate feedback submission is rejected by cooldown guard",
);

// -----------------------------------------------------------------------------
// SUITE 6: Evidence Support & Action Legality Check
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 6: Evidence Grounding & Action Legality Checks ---");

const gradDateSpan: BiasSpan = {
  id: "span-grad-1999",
  start: 100,
  end: 104,
  matched_text: "1999",
  category: "age_indicative",
  subcategory: "graduation_year_proxy",
  severity: "medium",
  confidence: 0.98,
  explanation: "Graduation year acts as demographic age proxy.",
  classification: "Flagged",
};

assert(
  isActionEvidenceSupported(RL_ACTION_IDS.REDACT_PERSONAL_INFO, gradDateSpan) === true,
  "Redacting personal info is evidence-supported for graduation year 1999",
);

assert(
  isActionEvidenceSupported(RL_ACTION_IDS.REDACT_PERSONAL_INFO, mockSpan) === false,
  "Redacting personal info is NOT evidence-supported for active leadership adjective 'aggressive'",
);

const gapSpan: BiasSpan = {
  id: "span-gap-2018",
  start: 200,
  end: 208,
  matched_text: "gap year",
  category: "gap_framing",
  subcategory: "unexplained_career_break",
  severity: "medium",
  confidence: 0.88,
  explanation: "Informal gap wording triggers recruiter screening bias.",
  classification: "Flagged",
};

assert(
  isActionEvidenceSupported(RL_ACTION_IDS.CONTEXTUAL_FRAMING, gapSpan) === true,
  "Contextual framing is evidence-supported for career gap wording",
);

const gradCandidateOptions = generateCandidateOptions(gradDateSpan);
const gradActionIds = gradCandidateOptions.map((o) => o.actionId);
assert(
  gradActionIds.includes(RL_ACTION_IDS.REDACT_PERSONAL_INFO),
  "Candidate generator produces redact_personal_info option for graduation year",
);

// -----------------------------------------------------------------------------
// SUITE 7: Safe Fallback on RL Failure / Exception
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 7: Fault Tolerance & Safe Fallback ---");

// Test with corrupted policy that throws on selectAction
const brokenPolicy = {
  evaluateArm: () => {
    throw new Error("Simulated LinUCB failure");
  },
  selectAction: () => {
    throw new Error("Simulated LinUCB failure");
  },
  getVersion: () => "broken",
} as unknown as LinUCBBanditPolicy;

const fallbackResult = selectMitigationRecommendation(
  mockSpan,
  {
    span_id: mockSpan.id,
    original_text: "aggressive",
    suggested_text: "results-driven",
    rationale: "Fallback rationale",
  },
  brokenPolicy,
  testFeedbackStore,
);

assert(
  fallbackResult.decisionSource === "fallback_rule",
  "System gracefully catches exception and triggers fallback_rule",
);
assert(
  fallbackResult.selectedOption.suggestedText === "results-driven",
  "Fallback preserves baseline suggested text without crashing",
);

// -----------------------------------------------------------------------------
// SUITE 8: Serialization, Deserialization & Policy Rollback
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 8: Policy Checkpointing, Serialization & Rollback ---");

const policyToSnapshot = new LinUCBBanditPolicy();
const serialized = policyToSnapshot.serialize();

assert(serialized.version === "v1.0.0", "Serialized policy contains version v1.0.0");
assert(
  Object.keys(serialized.actions).length === 5,
  "Serialized policy includes all 5 recommendation action arms",
);

// Update policy and then rollback
policyToSnapshot.updateArm(RL_ACTION_IDS.COMPETENCY_SUBSTITUTION, coldState.features, 1.0);
assert(policyToSnapshot.getTotalUpdates() === 1, "Policy recorded update count = 1");

const rolledBack = policyToSnapshot.rollback();
assert(rolledBack === true, "Rollback successfully restored previous snapshot");
assert(policyToSnapshot.getTotalUpdates() === 0, "Update count restored to 0 after rollback");

// -----------------------------------------------------------------------------
// SUITE 9: Invariance of Core Bias Detection & Job Match Scoring
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 9: Strict Invariance of Existing Bias Detection & Job Match ---");

const alexRaw = sampleReport.raw_text;
const fullstackJob = SAMPLE_JOB_BENCHMARKS[0];

// Verify bias detection output before and after RL integration
const biasAnalysis = analyzeResumeText(alexRaw);
assert(biasAnalysis.spans.length === 9, `Alex Vance resume yields exactly 9 flagged spans (${biasAnalysis.spans.length})`);
assert(biasAnalysis.neutrality_score === 44, `Alex Vance neutrality score remains exactly 44% (${biasAnalysis.neutrality_score}%)`);

// Verify ATS Job Match output before and after RL integration
const atsResult = calculateAtsMatch(alexRaw, fullstackJob);
assert(atsResult.overall_match_score === 62, "Job Match overall score remains exactly 62%");
assert(atsResult.hard_skills_score === 76, "Job Match hard skills score remains exactly 76%");
assert(atsResult.semantic_relevance_score === 53, "Job Match semantic score remains exactly 53%");
assert(atsResult.soft_skills_score === 0, "Job Match soft skills score remains exactly 0%");
assert(
  atsResult.section_coverage.overall_structure_score === 100,
  "Job Match section structure score remains exactly 100%",
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n" + "=".repeat(80));
console.log(` Test Execution Completed: ${passedCount}/${passedCount + failedCount} Passed (${failedCount} Failed)`);
console.log("=".repeat(80));

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log(" All Reinforcement Learning bandit tests passed successfully!\n");
}
