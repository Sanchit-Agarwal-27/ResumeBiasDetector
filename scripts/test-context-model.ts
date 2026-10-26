/**
 * @file test-context-model.ts
 * Comprehensive test harness for the integrated BiasLens Context-Aware Bias Detection Engine:
 * 1. 30-sample benchmark evaluation suite
 * 2. 10 counterfactual pair tests
 * 3. End-to-end document analysis & regression tests
 * 4. Neutral chronology & age-bias precision tests
 */

import fs from "fs";
import path from "path";
import { classifySentence, classifyDocument, CLASSIFICATION } from "../src/lib/context-detector";
import { analyzeResumeText, runCounterfactualFairnessAudit } from "../src/lib/bias-taxonomy";
import { processResumeAnalysis } from "../src/lib/analysis-service";

interface BenchmarkSample {
  id: string;
  group: string;
  sentence: string;
  expectedClassification: "Fine" | "Flagged";
  keywordPresent: boolean;
  rationale: string;
}

interface CounterfactualPair {
  id: string;
  name: string;
  description: string;
  sentenceA: { text: string; expected: "Fine" | "Flagged" };
  sentenceB: { text: string; expected: "Fine" | "Flagged" };
  expectedBehavior: string;
}

console.log("================================================================================");
console.log(" BiasLens Context-Aware Model & Explainable AI (XAI) - Comprehensive Test Suite");
console.log("================================================================================\n");

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details = "") {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
    if (details) console.error(`    Details: ${details}`);
  }
}

// ============================================================================
// SUITE 1: 30-SAMPLE BENCHMARK EVALUATION DATASET
// ============================================================================
console.log("--------------------------------------------------------------------------------");
console.log(" SUITE 1: 30-Sample Benchmark Evaluation Dataset");
console.log("--------------------------------------------------------------------------------");

const evaluationSamplesPath = path.resolve("./data/evaluation_samples.json");
const evaluationSamples: BenchmarkSample[] = JSON.parse(
  fs.readFileSync(evaluationSamplesPath, "utf-8"),
);

let tp = 0;
let fp = 0;
let tn = 0;
let fn = 0;

evaluationSamples.forEach((sample, idx) => {
  const result = classifySentence(sample.sentence);
  const isMatch = result.classification === sample.expectedClassification;

  if (sample.expectedClassification === CLASSIFICATION.FLAGGED) {
    if (result.classification === CLASSIFICATION.FLAGGED) tp++;
    else fn++;
  } else {
    if (result.classification === CLASSIFICATION.FLAGGED) fp++;
    else tn++;
  }

  assert(
    isMatch,
    `[Sample ${idx + 1}/${evaluationSamples.length}] ${sample.id} (${sample.expectedClassification})`,
    `Sentence: "${sample.sentence}"\n    Expected: ${sample.expectedClassification}, Got: ${result.classification}\n    Explanation: ${result.explanation}`,
  );
});

const benchmarkAccuracy = (tp + tn) / evaluationSamples.length;
const benchmarkPrecision = tp + fp > 0 ? tp / (tp + fp) : 1;
const benchmarkRecall = tp + fn > 0 ? tp / (tp + fn) : 1;
const benchmarkFpr = fp + tn > 0 ? fp / (fp + tn) : 0;
const benchmarkF1 =
  benchmarkPrecision + benchmarkRecall > 0
    ? (2 * benchmarkPrecision * benchmarkRecall) / (benchmarkPrecision + benchmarkRecall)
    : 0;

console.log("\n  Benchmark Metrics Summary:");
console.log(`    Total Samples:        ${evaluationSamples.length}`);
console.log(`    True Positives (TP):  ${tp}`);
console.log(`    True Negatives (TN):  ${tn}`);
console.log(`    False Positives (FP): ${fp}`);
console.log(`    False Negatives (FN): ${fn}`);
console.log(`    Accuracy:             ${(benchmarkAccuracy * 100).toFixed(2)}%`);
console.log(`    Precision:            ${(benchmarkPrecision * 100).toFixed(2)}%`);
console.log(`    Recall:               ${(benchmarkRecall * 100).toFixed(2)}%`);
console.log(`    False Positive Rate:  ${(benchmarkFpr * 100).toFixed(2)}%`);
console.log(`    F1 Score:             ${(benchmarkF1 * 100).toFixed(2)}%\n`);

assert(benchmarkAccuracy === 1.0, "Benchmark achieves 100% accuracy on all 30 samples");
assert(
  benchmarkFpr === 0.0,
  "Benchmark achieves 0% False Positive Rate (zero false alarms on technical sentences)",
);
assert(benchmarkRecall === 1.0, "Benchmark achieves 100% Recall (zero missed biases)");

// ============================================================================
// SUITE 2: 10 COUNTERFACTUAL PAIR CONSISTENCY TESTS
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log(" SUITE 2: 10 Counterfactual Pair Tests");
console.log("--------------------------------------------------------------------------------");

const counterfactualPairsPath = path.resolve("./data/counterfactual_pairs.json");
const counterfactualPairs: CounterfactualPair[] = JSON.parse(
  fs.readFileSync(counterfactualPairsPath, "utf-8"),
);

counterfactualPairs.forEach((pair, idx) => {
  const resultA = classifySentence(pair.sentenceA.text);
  const resultB = classifySentence(pair.sentenceB.text);

  const aMatches = resultA.classification === pair.sentenceA.expected;
  const bMatches = resultB.classification === pair.sentenceB.expected;

  assert(
    aMatches && bMatches,
    `[Pair ${idx + 1}/${counterfactualPairs.length}] ${pair.name}`,
    `Sentence A: "${pair.sentenceA.text}" -> Got ${resultA.classification} (Expected ${pair.sentenceA.expected})\n    Sentence B: "${pair.sentenceB.text}" -> Got ${resultB.classification} (Expected ${pair.sentenceB.expected})`,
  );
});

// ============================================================================
// SUITE 3: END-TO-END PIPELINE & REGRESSION TESTS
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log(" SUITE 3: End-to-End Pipeline & Regression Tests");
console.log("--------------------------------------------------------------------------------");

// Test 3.1: Completely neutral resume
const neutralResume = `
Software Engineer with 5 years of experience in distributed systems.
Designed RESTful APIs using TypeScript, Node.js, and PostgreSQL.
Automated container deployments using Kubernetes and GitHub Actions.
Bachelor of Science in Computer Science, University of California (2020).
`;
const neutralResult = analyzeResumeText(neutralResume);
assert(
  neutralResult.neutrality_score === 100,
  "Neutral resume receives 100% neutrality score",
  `Got score ${neutralResult.neutrality_score}, spans: ${neutralResult.spans.length}`,
);
assert(neutralResult.spans.length === 0, "Neutral resume generates 0 flagged spans");

// Test 3.2: Technical achievements with polysemous keywords (aggressively, caching tiers, accessibility)
const technicalAchievementsResume = `
Senior Platform Engineer.
She aggressively optimized the machine learning pipeline, reducing inference latency by 40%.
Reduced database query latency by 60% through aggressive caching tiers and Redis cluster optimization.
He developed an application that improves accessibility for people with disabilities compliant with WCAG 2.1 AA.
Took a two-year career break for family care and completed AWS cloud certification.
`;
const technicalResult = analyzeResumeText(technicalAchievementsResume);
assert(
  technicalResult.neutrality_score === 100,
  "Technical resume with sensitive words contextually exonerated receives 100% neutrality score",
  `Got score ${technicalResult.neutrality_score}, flagged spans: ${technicalResult.spans.length}`,
);
assert(
  technicalResult.spans.length === 0,
  "Technical resume with sensitive words produces 0 flagged spans (100% false positive reduction)",
);
assert(
  (technicalResult.context_summary?.exonerated_keywords ?? 0) > 0,
  "Context summary tracks exonerated keywords correctly",
  `Exonerated count: ${technicalResult.context_summary?.exonerated_keywords}`,
);

// Test 3.3: Blatantly biased resume
const biasedResume = `
Executive Search Profile.
The company prefers young and energetic candidates for this entry-level role.
The candidate took a two-year career break and is therefore less committed to the company.
Colleagues noted the candidate has a difficult personality and is hard to work with.
`;
const biasedResult = analyzeResumeText(biasedResume);
assert(
  biasedResult.neutrality_score < 80,
  "Biased resume receives appropriate penalty score",
  `Score: ${biasedResult.neutrality_score}`,
);
assert(
  biasedResult.spans.length >= 3,
  "Biased resume flags all discriminatory statements",
  `Flagged count: ${biasedResult.spans.length}`,
);

// Verify grounded XAI explanations exist on all flagged spans
const allHaveExplanations = biasedResult.spans.every(
  (s) => s.explanation && s.explanation.length > 20 && s.classification === "Flagged",
);
assert(allHaveExplanations, "All flagged spans contain rich, grounded XAI explanations");

// Test 3.4: Counterfactual audit execution
const audit = runCounterfactualFairnessAudit(technicalAchievementsResume, technicalResult.spans);
assert(
  audit.disparate_impact_ratio.passes_rule === true,
  "Counterfactual audit passes EEOC 80% rule on technical achievements resume",
  `DIR: ${audit.disparate_impact_ratio.value}`,
);
assert(
  audit.demographic_parity.passes_rule === true,
  "Counterfactual audit passes Demographic Parity variance threshold",
  `Variance: ${audit.demographic_parity.value}`,
);

// Test 3.5: Full async processResumeAnalysis service layer
async function testServiceLayer() {
  const serviceReport = await processResumeAnalysis(
    technicalAchievementsResume,
    "Jane_Doe_Resume.pdf",
  );
  assert(serviceReport.file_name === "Jane_Doe_Resume.pdf", "Service layer preserves file name");
  assert(
    serviceReport.neutrality_score === 100,
    "Service layer returns 100% neutrality score for technical resume",
  );
  assert(
    Array.isArray(serviceReport.classified_sentences),
    "Service layer returns classified_sentences array",
  );
  assert(
    serviceReport.context_summary !== undefined,
    "Service layer returns context_summary metadata",
  );
}

await testServiceLayer();

// ============================================================================
// SUITE 4: NEUTRAL CHRONOLOGY & AGE-BIAS PRECISION TESTS
// ============================================================================
console.log("\n--------------------------------------------------------------------------------");
console.log(" SUITE 4: Neutral Chronology & Age-Bias Precision Tests");
console.log("--------------------------------------------------------------------------------");

const c1 = classifySentence("B.A. in Computer Science | 2014–2018");
assert(c1.classification === CLASSIFICATION.FINE, "B.A. in Computer Science | 2014–2018 is classified as Fine");
assert(
  c1.contextType === "neutral_chronological_record" || c1.contextType === "neutral_no_keywords",
  "Context type is neutral chronology or no keywords",
);

const c2 = classifySentence("Software Engineer | 2020–2024");
assert(c2.classification === CLASSIFICATION.FINE, "Software Engineer | 2020–2024 is classified as Fine");

const c3 = classifySentence("Aug. 2014 – May 2018");
assert(c3.classification === CLASSIFICATION.FINE, "Aug. 2014 – May 2018 is classified as Fine (zero false alarm on date range)");

const c4 = classifySentence("June 2020 – Present College Station, TX");
assert(c4.classification === CLASSIFICATION.FINE, "June 2020 – Present College Station, TX is classified as Fine");

const c5 = classifySentence("Applicants must be younger than 30 for this junior role.");
assert(c5.classification === CLASSIFICATION.FLAGGED, "Explicit age exclusion 'younger than 30' is classified as Flagged");

const c6 = classifySentence("Graduated from State University with a Bachelor of Science in Computer Science in 1997.");
assert(c6.classification === CLASSIFICATION.FLAGGED, "Legacy graduation year proxy (1997) is classified as Flagged");

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log("\n================================================================================");
console.log(
  ` Test Execution Completed: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`,
);
console.log("================================================================================");

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log(" All test suites passed successfully!\n");
  process.exit(0);
}
