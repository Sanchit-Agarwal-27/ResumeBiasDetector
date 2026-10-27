import { calculateAtsMatch } from "../src/lib/ats-matching-engine";
import {
  generateJobMatchExplanation,
  generateSupplementaryExplanation,
} from "../src/lib/job-match-explainability";
import { SAMPLE_JOB_BENCHMARKS } from "../src/lib/job-benchmarks";
import { sampleReport } from "../src/lib/resume-contract";

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
console.log(" Job Match Explainability & Score Invariance - Test Suite");
console.log("=".repeat(80));

// -----------------------------------------------------------------------------
// TEST SUITE 1: Score Preservation & Formula Invariance
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 1: Exact Score Invariance Across Resumes ---");

const alexResume = sampleReport.raw_text;
const fullstackJob = SAMPLE_JOB_BENCHMARKS[0]; // Senior Full-Stack Engineer

const matchResultAlex = calculateAtsMatch(alexResume, fullstackJob);

// 1. Verify formula weights and bounds
const expectedOverall = Math.min(
  100,
  Math.max(
    15,
    Math.round(
      matchResultAlex.hard_skills_score * 0.45 +
        matchResultAlex.semantic_relevance_score * 0.25 +
        matchResultAlex.soft_skills_score * 0.15 +
        matchResultAlex.section_coverage.overall_structure_score * 0.15,
    ),
  ),
);

assert(
  matchResultAlex.overall_match_score === expectedOverall,
  `Composite formula Math.round(hard*0.45 + sem*0.25 + soft*0.15 + sec*0.15) preserved (${matchResultAlex.overall_match_score}% === ${expectedOverall}%)`,
);

// Baseline verification: Calculate match score without explanation
assert(
  typeof matchResultAlex.overall_match_score === "number" &&
    matchResultAlex.overall_match_score >= 15 &&
    matchResultAlex.overall_match_score <= 100,
  `Overall match score is bounded and valid (${matchResultAlex.overall_match_score}%)`,
);

// Verify explanation generation does NOT alter the existing score
const explanationAlex = generateJobMatchExplanation(
  matchResultAlex,
  alexResume,
  fullstackJob.raw_text,
);

assert(
  explanationAlex.overallScore === matchResultAlex.overall_match_score,
  `Explainability overallScore (${explanationAlex.overallScore}%) strictly equals matchResult.overall_match_score (${matchResultAlex.overall_match_score}%)`,
);

assert(
  matchResultAlex.overall_match_score === expectedOverall,
  "Calling explanation generator did NOT mutate original matchResult score",
);

// -----------------------------------------------------------------------------
// TEST SUITE 2: Positive Match Explanations & Evidence Grounding
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 2: Grounded Positive Match Explanations ---");

assert(
  explanationAlex.positiveMatches.length > 0,
  `Generated ${explanationAlex.positiveMatches.length} positive match explanations`,
);

// Verify every positive match contains actual resume evidence
let allQuotesGrounded = true;
let allEvidenceTypesValid = true;

for (const match of explanationAlex.positiveMatches) {
  if (!alexResume.toLowerCase().includes(match.keyword.toLowerCase())) {
    // Check if alias is in resume
    const aliases = ["ts", "type-script", "js", "py", "python3", "postgres", "k8s", "iac"];
    const foundAlias = aliases.some((a) => alexResume.toLowerCase().includes(a));
    if (!foundAlias && !match.resumeEvidence.includes(match.keyword)) {
      allQuotesGrounded = false;
    }
  }

  const validTypes = [
    "project_experience",
    "explicit_skill",
    "qualification",
    "contextual_mention",
  ];
  if (!validTypes.includes(match.evidenceType)) {
    allEvidenceTypesValid = false;
  }
}

assert(allQuotesGrounded, "All positive matches are grounded in real resume content");
assert(allEvidenceTypesValid, "All positive matches have valid evidenceType classifications");

// Verify TypeScript match
const tsMatch = explanationAlex.positiveMatches.find((p) => p.keyword === "typescript");
assert(Boolean(tsMatch), "TypeScript is detected as a positive match");
if (tsMatch) {
  assert(
    tsMatch.resumeEvidence.length > 0,
    `TypeScript evidence extracted: "${tsMatch.resumeEvidence}"`,
  );
  assert(
    tsMatch.relevanceExplanation.length > 0,
    "TypeScript includes a clear relevance explanation",
  );
}

// Verify Docker match
const dockerMatch = explanationAlex.positiveMatches.find((p) => p.keyword === "docker");
assert(Boolean(dockerMatch), "Docker is detected as a positive match");
if (dockerMatch) {
  assert(
    dockerMatch.jobRequirement.toLowerCase().includes("docker"),
    `Job requirement correctly identified: "${dockerMatch.jobRequirement}"`,
  );
}

// -----------------------------------------------------------------------------
// TEST SUITE 3: Missing & Unverified Requirements with Honest Observations
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 3: Missing & Unverified Requirements Analysis ---");

assert(
  explanationAlex.missingRequirements.length > 0,
  `Identified ${explanationAlex.missingRequirements.length} missing/unverified requirements`,
);

let allMissingHaveRecommendations = true;
let noFabricationEncouraged = true;

for (const missing of explanationAlex.missingRequirements) {
  if (!missing.actionableRecommendation || missing.actionableRecommendation.length < 20) {
    allMissingHaveRecommendations = false;
  }
  // Check that advice does NOT say to lie or make up skills
  if (missing.actionableRecommendation.toLowerCase().includes("make up") ||
      missing.actionableRecommendation.toLowerCase().includes("fabricate")) {
    noFabricationEncouraged = false;
  }
}

assert(
  allMissingHaveRecommendations,
  "All missing requirements provide actionable recommendations",
);
assert(
  noFabricationEncouraged,
  "Recommendations emphasize truthful documentation, not fabrication",
);

// Verify importance justification
const firstMissing = explanationAlex.missingRequirements[0];
assert(
  firstMissing.importance === "required" || firstMissing.importance === "preferred",
  `Missing requirement "${firstMissing.keyword}" has valid importance (${firstMissing.importance})`,
);
assert(
  firstMissing.unverifiedAspects.includes("not mean you lack") ||
    firstMissing.unverifiedAspects.includes("unverified"),
  `Unverified aspect clarifies missing document evidence != missing candidate capability`,
);

// -----------------------------------------------------------------------------
// TEST SUITE 4: Non-Fabrication of Per-Skill Point Contributions
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 4: No Fabricated Per-Skill Point Claims ---");

// The prompt specifies: Never claim that adding Python or Docker will add +X points
let hasFabricatedSkillPoints = false;
const fullExplanationText = JSON.stringify(explanationAlex);

const fabricatedRegex = /\b(add|gain|increase)\s+(\+)?\d+%\s+for\s+[a-z]+/i;
if (fabricatedRegex.test(fullExplanationText)) {
  hasFabricatedSkillPoints = true;
}

assert(
  !hasFabricatedSkillPoints,
  "System does NOT invent per-skill score percentage contributions (e.g., '+5% for Python')",
);

// Verify dimension breakdown uses actual sub-scores
assert(
  explanationAlex.dimensionBreakdown.length === 4,
  "Dimension breakdown includes all 4 evaluation dimensions",
);

const hardDim = explanationAlex.dimensionBreakdown.find((d) => d.dimension.includes("Technical"));
assert(
  hardDim?.score === matchResultAlex.hard_skills_score,
  `Technical dimension score (${hardDim?.score}%) matches hard_skills_score (${matchResultAlex.hard_skills_score}%)`,
);

const semDim = explanationAlex.dimensionBreakdown.find((d) => d.dimension.includes("Semantic"));
assert(
  semDim?.score === matchResultAlex.semantic_relevance_score,
  `Semantic dimension score (${semDim?.score}%) matches semantic_relevance_score (${matchResultAlex.semantic_relevance_score}%)`,
);

// -----------------------------------------------------------------------------
// TEST SUITE 5: Fallback & Supplementary Mode
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 5: Fallback & Supplementary Analysis Mode ---");

const supplementaryReport = generateSupplementaryExplanation(
  78,
  alexResume,
  fullstackJob.raw_text,
);

assert(
  supplementaryReport.overallScore === 78,
  `Supplementary analysis preserves overall score exactly (78%)`,
);
assert(
  supplementaryReport.isSupplementaryAnalysis === true,
  "Supplementary analysis is clearly flagged with isSupplementaryAnalysis: true",
);
assert(
  supplementaryReport.disclaimer.includes("NOTICE: This is a supplementary textual analysis"),
  "Supplementary analysis includes prominent transparency disclaimer",
);
assert(
  supplementaryReport.positiveMatches.length > 0,
  `Supplementary mode extracted ${supplementaryReport.positiveMatches.length} verifiable textual matches`,
);

// -----------------------------------------------------------------------------
// TEST SUITE 6: Resilience & Score Isolation
// -----------------------------------------------------------------------------
console.log("\n--- SUITE 6: Score Isolation Under Empty or Malformed Input ---");

const emptyResumeResult = calculateAtsMatch("", fullstackJob);
assert(
  typeof emptyResumeResult.overall_match_score === "number",
  `Empty resume returns valid number score (${emptyResumeResult.overall_match_score}%)`,
);
assert(
  emptyResumeResult.explanation !== undefined,
  "Empty resume produces safe explanation without throwing",
);
assert(
  emptyResumeResult.explanation?.overallScore === emptyResumeResult.overall_match_score,
  "Score remains strictly equal to match score even on empty resume",
);

// Test with empty job description
const emptyJobResult = calculateAtsMatch(alexResume, {
  id: "empty-job",
  title: "General Role",
  raw_text: "",
});
assert(
  typeof emptyJobResult.overall_match_score === "number",
  `Empty job description returns valid number score (${emptyJobResult.overall_match_score}%)`,
);
assert(
  emptyJobResult.explanation !== undefined,
  "Empty job description produces safe explanation without throwing",
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
  console.log(" All explainability and score invariance tests passed successfully!\n");
}
