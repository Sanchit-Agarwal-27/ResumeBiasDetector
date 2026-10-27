import type { AtsMatchResult, KeywordMatchEntry } from "./resume-contract";
import { HARD_SKILLS_DICTIONARY, SOFT_SKILLS_DICTIONARY } from "./ats-matching-engine";

export type EvidenceType =
  "project_experience" | "explicit_skill" | "qualification" | "contextual_mention";

export interface PositiveMatchExplanation {
  keyword: string;
  category: "hard_skill" | "soft_skill" | "certification" | "tool_framework";
  jobRequirement: string;
  resumeEvidence: string;
  evidenceType: EvidenceType;
  relevanceExplanation: string;
  resumeSection?: string;
}

export interface MissingRequirementExplanation {
  keyword: string;
  category: "hard_skill" | "soft_skill" | "certification" | "tool_framework";
  jobRequirement: string;
  importance: "required" | "preferred" | "domain_context";
  importanceJustification: string;
  currentObservation: string;
  unverifiedAspects: string;
  actionableRecommendation: string;
}

export interface DimensionExplanation {
  dimension: string;
  score: number;
  weightDescription: string;
  status: "strong" | "moderate" | "growth_area";
  summary: string;
  evidenceSummary: string;
}

export interface JobMatchExplanationReport {
  overallScore: number;
  scoreVerdict: "Strong Alignment" | "Competitive Match" | "Partial Alignment" | "Developing Match";
  scoreSummaryNarrative: string;
  dimensionBreakdown: DimensionExplanation[];
  positiveMatches: PositiveMatchExplanation[];
  missingRequirements: MissingRequirementExplanation[];
  areasToImprove: string[];
  isSupplementaryAnalysis: boolean;
  evidenceQuotesCount: number;
  disclaimer: string;
}

interface ParsedSentence {
  text: string;
  section: string;
  isBullet: boolean;
  hasActionVerb: boolean;
}

const ACTION_VERBS = new Set([
  "achieved",
  "administered",
  "analyzed",
  "architected",
  "automated",
  "built",
  "collaborated",
  "configured",
  "constructed",
  "coordinated",
  "created",
  "debugged",
  "delivered",
  "deployed",
  "designed",
  "developed",
  "directed",
  "engineered",
  "established",
  "executed",
  "expanded",
  "facilitated",
  "formulated",
  "guided",
  "implemented",
  "improved",
  "increased",
  "initiated",
  "inspected",
  "instituted",
  "integrated",
  "introduced",
  "launched",
  "lead",
  "led",
  "maintained",
  "managed",
  "mentored",
  "migrated",
  "modeled",
  "monitored",
  "negotiated",
  "optimized",
  "orchestrated",
  "organized",
  "oversaw",
  "partnered",
  "performed",
  "pioneered",
  "planned",
  "produced",
  "programmed",
  "reduced",
  "refactored",
  "resolved",
  "restructured",
  "scaled",
  "shipped",
  "spearheaded",
  "standardized",
  "streamlined",
  "supervised",
  "tested",
  "trained",
  "transformed",
  "upgraded",
  "utilized",
]);

/**
 * Splits resume text into structured sentences with inferred section and action verb presence.
 */
function parseResumeSentences(resumeText: string): ParsedSentence[] {
  if (!resumeText) return [];

  const lines = resumeText.split(/\r?\n/);
  const result: ParsedSentence[] = [];
  let currentSection = "summary";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect section header
    const lower = line.toLowerCase();
    if (/^(work\s+)?experience|employment|professional\s+history/i.test(lower)) {
      currentSection = "experience";
      continue;
    }
    if (/^education|academic|degrees?/i.test(lower)) {
      currentSection = "education";
      continue;
    }
    if (/^(technical\s+)?skills|technologies|competencies|tools|proficiencies/i.test(lower)) {
      currentSection = "skills";
      continue;
    }
    if (/^projects?|personal\s+projects/i.test(lower)) {
      currentSection = "projects";
      continue;
    }
    if (/^certifications?|licenses?/i.test(lower)) {
      currentSection = "certifications";
      continue;
    }
    if (/^summary|profile|about\s+me/i.test(lower)) {
      currentSection = "summary";
      continue;
    }

    const isBullet = /^[-*•–—]\s*/.test(line);
    const cleanedLine = line.replace(/^[-*•–—]\s*/, "");

    // Split compound sentences if they contain multiple distinct bullet thoughts
    const sentences = cleanedLine.split(/(?<=[.!?])\s+(?=[A-Z])/);
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (!s) continue;

      const words = s.toLowerCase().split(/\W+/);
      const hasActionVerb = words.some((w) => ACTION_VERBS.has(w));

      result.push({
        text: s,
        section: currentSection,
        isBullet,
        hasActionVerb,
      });
    }
  }

  return result;
}

/**
 * Splits job description into structured requirement sentences / bullets.
 */
function parseJobRequirements(jobText: string): string[] {
  if (!jobText) return [];
  const lines = jobText.split(/\r?\n/);
  const result: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const cleaned = line.replace(/^[-*•–—]\s*/, "").trim();
    if (!cleaned) continue;

    // If long paragraph, split by period
    if (cleaned.length > 120 && cleaned.includes(". ")) {
      const parts = cleaned.split(/(?<=[.!?])\s+/);
      for (const p of parts) {
        if (p.trim().length > 10) result.push(p.trim());
      }
    } else {
      result.push(cleaned);
    }
  }

  return result;
}

/**
 * Checks if a sentence contains a given keyword or any of its known dictionary aliases.
 */
function findTermInText(
  text: string,
  term: string,
  aliases: string[] = [],
): { found: boolean; matchedAlias?: string } {
  const lowerText = text.toLowerCase();
  const allTerms = [term, ...aliases];

  for (const t of allTerms) {
    // For single/two-character terms like C or Go or R or CI/CD, use strict boundary
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i");
    if (regex.test(lowerText)) {
      return { found: true, matchedAlias: t };
    }
  }

  return { found: false };
}

/**
 * Get known aliases for a keyword.
 */
function getAliases(term: string): string[] {
  return HARD_SKILLS_DICTIONARY[term] || SOFT_SKILLS_DICTIONARY[term] || [];
}

/**
 * Finds the most relevant supporting sentence from the parsed resume.
 */
function findBestResumeEvidence(
  term: string,
  parsedSentences: ParsedSentence[],
): { sentence: string; section: string; evidenceType: EvidenceType } | null {
  const aliases = getAliases(term);
  const candidates: {
    sentence: string;
    section: string;
    evidenceType: EvidenceType;
    priority: number;
  }[] = [];

  for (const s of parsedSentences) {
    const { found } = findTermInText(s.text, term, aliases);
    if (!found) continue;

    let evidenceType: EvidenceType = "contextual_mention";
    let priority = 1;

    if (s.section === "experience" || s.section === "projects" || s.hasActionVerb) {
      evidenceType = "project_experience";
      priority = 4;
    } else if (
      s.section === "education" ||
      /degree|bachelor|master|b\.s\.|m\.s\.|university|college|gpa/i.test(s.text)
    ) {
      evidenceType = "qualification";
      priority = 3;
    } else if (s.section === "skills" || s.text.includes(",") || s.text.includes(":")) {
      evidenceType = "explicit_skill";
      priority = 2;
    }

    candidates.push({
      sentence: s.text,
      section: s.section,
      evidenceType,
      priority,
    });
  }

  if (candidates.length === 0) return null;

  // Sort by priority descending, then by length descending (prefer rich context)
  candidates.sort((a, b) => b.priority - a.priority || b.sentence.length - a.sentence.length);
  return candidates[0];
}

/**
 * Finds the most relevant requirement excerpt from the job description.
 */
function findBestJobRequirement(term: string, jobRequirements: string[]): string {
  const aliases = getAliases(term);

  for (const req of jobRequirements) {
    const { found } = findTermInText(req, term, aliases);
    if (found) {
      return req;
    }
  }

  return `Demonstrated knowledge and experience with ${term}.`;
}

/**
 * Formats a clean explanation of why the evidence satisfies the requirement.
 */
function generateRelevanceExplanation(
  term: string,
  evidenceType: EvidenceType,
  section: string,
  evidenceText: string,
  jobReqText: string,
): string {
  const snippet = evidenceText.length > 80 ? `${evidenceText.slice(0, 77)}...` : evidenceText;

  switch (evidenceType) {
    case "project_experience":
      return `The resume documents practical, hands-on experience under ${capitalize(section)}: "${snippet}". This demonstrates applied competency that directly fulfills the role's requirement for ${term}.`;
    case "qualification":
      return `The resume verifies academic or accredited qualification under ${capitalize(section)}: "${snippet}". This provides recognized formal grounding for the ${term} requirement.`;
    case "explicit_skill":
      return `The resume explicitly lists ${term} under ${capitalize(section)}: "${snippet}". The competency is clearly declared; detailing a specific project outcome using ${term} would make this demonstration even stronger.`;
    case "contextual_mention":
    default:
      return `The resume references ${term} within relevant career context: "${snippet}". This aligns with the job requirement specified in the target role.`;
  }
}

function capitalize(s: string): string {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Generates an explainability report on top of existing match results without modifying scores.
 */
export function generateJobMatchExplanation(
  matchResult: AtsMatchResult,
  resumeText: string,
  jobText?: string,
): JobMatchExplanationReport {
  const effectiveJobText = jobText || matchResult.job_profile?.raw_text || "";
  const parsedResume = parseResumeSentences(resumeText);
  const parsedJob = parseJobRequirements(effectiveJobText);

  // 1. Build Positive Match Explanations
  const positiveMatches: PositiveMatchExplanation[] = [];
  for (const entry of matchResult.matched_keywords) {
    const bestEvidence = findBestResumeEvidence(entry.keyword, parsedResume);
    const jobReq = findBestJobRequirement(entry.keyword, parsedJob);

    const evidenceText =
      bestEvidence?.sentence || `Mentioned ${entry.frequencyInResume} time(s) in resume text.`;
    const evidenceType: EvidenceType = bestEvidence?.evidenceType || "explicit_skill";
    const section = bestEvidence?.section || "resume";

    const explanation = generateRelevanceExplanation(
      entry.keyword,
      evidenceType,
      section,
      evidenceText,
      jobReq,
    );

    positiveMatches.push({
      keyword: entry.keyword,
      category: entry.category,
      jobRequirement: jobReq,
      resumeEvidence: evidenceText,
      evidenceType,
      relevanceExplanation: explanation,
      resumeSection: capitalize(section),
    });
  }

  // 2. Build Missing / Unverified Requirement Explanations
  const missingRequirements: MissingRequirementExplanation[] = [];
  for (const entry of matchResult.missing_keywords) {
    const jobReq = findBestJobRequirement(entry.keyword, parsedJob);
    const aliases = getAliases(entry.keyword);

    // Check if mentioned in skills section only or completely absent
    const partialMention = parsedResume.find(
      (s) => findTermInText(s.text, entry.keyword, aliases).found,
    );

    let currentObservation: string;
    let unverifiedAspects: string;
    let actionableRecommendation: string;

    if (partialMention) {
      currentObservation = `The keyword "${entry.keyword}" is referenced in the ${capitalize(partialMention.section)} section, but lacks an accompanying project or work bullet describing practical execution.`;
      unverifiedAspects = `Demonstrated hands-on experience and production outcomes using ${entry.keyword} remain unverified in the narrative descriptions.`;
      actionableRecommendation = `If you have utilized ${entry.keyword} professionally, expand an existing experience bullet to outline the specific problem you addressed and your measurable outcome. Do not fabricate experience.`;
    } else {
      currentObservation = `No documented mention of "${entry.keyword}" was identified in the submitted resume text.`;
      unverifiedAspects = `Demonstrated proficiency with ${entry.keyword} is not evidenced in the current document (this does not mean you lack the skill, only that it is not documented).`;
      actionableRecommendation = `If you have experience or transferable skills with ${entry.keyword}, add a concise, factual bullet point illustrating your work. If this is a growth area, consider highlighting adjacent competencies or coursework without fabricating credentials.`;
    }

    const importanceJustification =
      entry.importance === "required"
        ? `High-priority requirement in ${matchResult.job_profile?.title || "target job"} (frequency: ${entry.frequencyInJob}x in job description).`
        : `Preferred qualification in ${matchResult.job_profile?.title || "target job"}.`;

    missingRequirements.push({
      keyword: entry.keyword,
      category: entry.category,
      jobRequirement: jobReq,
      importance: entry.importance,
      importanceJustification,
      currentObservation,
      unverifiedAspects,
      actionableRecommendation,
    });
  }

  // 3. Build Dimension Explanations using exact existing sub-scores
  const hardScore = matchResult.hard_skills_score;
  const softScore = matchResult.soft_skills_score;
  const semanticScore = matchResult.semantic_relevance_score;
  const structureScore = matchResult.section_coverage.overall_structure_score;

  const totalHard =
    matchResult.matched_keywords.filter((k) => k.category === "hard_skill").length +
    matchResult.missing_keywords.filter((k) => k.category === "hard_skill").length;
  const matchedHard = matchResult.matched_keywords.filter(
    (k) => k.category === "hard_skill",
  ).length;

  const totalSoft =
    matchResult.matched_keywords.filter((k) => k.category === "soft_skill").length +
    matchResult.missing_keywords.filter((k) => k.category === "soft_skill").length;
  const matchedSoft = matchResult.matched_keywords.filter(
    (k) => k.category === "soft_skill",
  ).length;

  const dimensionBreakdown: DimensionExplanation[] = [
    {
      dimension: "Technical & Role Competencies",
      score: hardScore,
      weightDescription: "Core technical capabilities demanded by the job description",
      status: hardScore >= 75 ? "strong" : hardScore >= 50 ? "moderate" : "growth_area",
      summary: `${matchedHard} of ${Math.max(1, totalHard)} required technical competencies verified in your resume.`,
      evidenceSummary:
        matchedHard > 0
          ? `Demonstrated strengths in: ${positiveMatches
              .filter((p) => p.category === "hard_skill")
              .slice(0, 4)
              .map((p) => p.keyword)
              .join(", ")}.`
          : "No explicit technical requirements currently documented.",
    },
    {
      dimension: "Semantic Terminology Alignment",
      score: semanticScore,
      weightDescription: "Overall vocabulary and contextual phrasing overlap with the job posting",
      status: semanticScore >= 70 ? "strong" : semanticScore >= 45 ? "moderate" : "growth_area",
      summary: `Cosine terminology similarity between your resume text and the job description is ${semanticScore}%.`,
      evidenceSummary:
        semanticScore >= 60
          ? "Resume phrasing closely mirrors the technical vocabulary and domain context of the role."
          : "Resume phrasing uses alternative terminology from the phrasing found in the job description.",
    },
    {
      dimension: "Soft & Collaborative Competencies",
      score: softScore,
      weightDescription: "Interpersonal, leadership, and cross-functional signals",
      status: softScore >= 70 ? "strong" : softScore >= 40 ? "moderate" : "growth_area",
      summary: `${matchedSoft} of ${Math.max(1, totalSoft)} soft competencies identified in the job description are documented.`,
      evidenceSummary:
        matchedSoft > 0
          ? `Evidenced collaborative traits: ${
              positiveMatches
                .filter((p) => p.category === "soft_skill")
                .map((p) => p.keyword)
                .join(", ") || "Active team engagement"
            }.`
          : "Soft skills are implied but not explicitly stated with action verbs.",
    },
    {
      dimension: "Resume Structure & ATS Hygiene",
      score: structureScore,
      weightDescription:
        "Standard section layout readability (Experience, Education, Skills, Contact)",
      status: structureScore >= 80 ? "strong" : structureScore >= 50 ? "moderate" : "growth_area",
      summary: `Standard structural formatting score: ${structureScore}%.`,
      evidenceSummary: [
        matchResult.section_coverage.contact_info ? "Contact Info present" : "Contact Info unclear",
        matchResult.section_coverage.work_experience
          ? "Work Experience verified"
          : "Work Experience missing",
        matchResult.section_coverage.education ? "Education verified" : "Education missing",
        matchResult.section_coverage.skills_section
          ? "Skills section present"
          : "Skills section missing",
      ].join(", "),
    },
  ];

  // 4. Synthesize Overall Narrative
  const overall = matchResult.overall_match_score;
  let verdict: JobMatchExplanationReport["scoreVerdict"] = "Developing Match";
  if (overall >= 80) verdict = "Strong Alignment";
  else if (overall >= 65) verdict = "Competitive Match";
  else if (overall >= 45) verdict = "Partial Alignment";

  const topMatchesStr = positiveMatches
    .slice(0, 3)
    .map((p) => `"${p.keyword}"`)
    .join(", ");
  const topGapsStr = missingRequirements
    .slice(0, 3)
    .map((m) => `"${m.keyword}"`)
    .join(", ");

  let narrative = `Your current match score is ${overall}%. `;
  if (positiveMatches.length > 0) {
    narrative += `Your resume demonstrates verified alignment in key competencies including ${topMatchesStr}, supported by explicit project and qualification evidence. `;
  }
  if (missingRequirements.length > 0) {
    narrative += `However, several requirements from the target role (${topGapsStr}) are not documented in the submitted text, which accounts for the score gap. `;
  } else {
    narrative += `All key competencies requested in the job description were identified in your resume text. `;
  }
  narrative += `Review the detailed evidence breakdown and actionable improvement suggestions below to see where your application aligns and where documenting genuine experience may help.`;

  // 5. Actionable Areas to Improve
  const areasToImprove: string[] = [];
  if (missingRequirements.length > 0) {
    const requiredGaps = missingRequirements.filter((m) => m.importance === "required");
    if (requiredGaps.length > 0) {
      areasToImprove.push(
        `Address high-priority requirements: The job description explicitly emphasizes ${requiredGaps
          .slice(0, 3)
          .map((m) => `"${m.keyword}"`)
          .join(
            ", ",
          )}. If you have practical experience with these competencies, document concrete projects where you applied them.`,
      );
    }
  }

  // Explicit skills that lack project context
  const skillsWithoutProject = positiveMatches.filter((p) => p.evidenceType === "explicit_skill");
  if (skillsWithoutProject.length > 0) {
    areasToImprove.push(
      `Strengthen competency depth: ${skillsWithoutProject
        .slice(0, 2)
        .map((p) => `"${p.keyword}"`)
        .join(
          ", ",
        )} are listed in your skills inventory but lack accompanying project or employment context. Adding a quantifiable outcome will strengthen proof of capability.`,
    );
  }

  if (softScore < 60) {
    areasToImprove.push(
      `Highlight collaborative outcomes: Frame your achievements using action-driven leadership verbs (e.g., "collaborated cross-functionally", "spearheaded", "mentored") to demonstrate how you work within teams.`,
    );
  }

  if (areasToImprove.length === 0) {
    areasToImprove.push(
      `Maintain strong alignment: Your resume thoroughly covers the job description's primary requirements with documented project evidence and clean ATS formatting.`,
    );
  }

  return {
    overallScore: overall,
    scoreVerdict: verdict,
    scoreSummaryNarrative: narrative,
    dimensionBreakdown,
    positiveMatches,
    missingRequirements,
    areasToImprove,
    isSupplementaryAnalysis: false,
    evidenceQuotesCount: positiveMatches.filter((p) => p.resumeEvidence.length > 0).length,
    disclaimer:
      "All explanations are grounded directly in the supplied resume and job description. Missing evidence reflects document content only, not candidate capabilities. Score calculations are strictly preserved without modification.",
  };
}

/**
 * Fallback mode when only an overall score is provided and intermediate matching data is missing.
 * Analyzes resume and job description separately to produce a transparent supplementary explanation.
 */
export function generateSupplementaryExplanation(
  overallScore: number,
  resumeText: string,
  jobText: string,
): JobMatchExplanationReport {
  const parsedResume = parseResumeSentences(resumeText);
  const parsedJob = parseJobRequirements(jobText);

  let verdict: JobMatchExplanationReport["scoreVerdict"] = "Developing Match";
  if (overallScore >= 80) verdict = "Strong Alignment";
  else if (overallScore >= 65) verdict = "Competitive Match";
  else if (overallScore >= 45) verdict = "Partial Alignment";

  const positiveMatches: PositiveMatchExplanation[] = [];
  const missingRequirements: MissingRequirementExplanation[] = [];

  // Inspect all known dictionary terms to discover observable alignment
  const allTerms = Object.keys(HARD_SKILLS_DICTIONARY).concat(Object.keys(SOFT_SKILLS_DICTIONARY));

  for (const term of allTerms) {
    const aliases = getAliases(term);
    const inJob = parsedJob.some((req) => findTermInText(req, term, aliases).found);
    if (!inJob) continue;

    const inResume = findBestResumeEvidence(term, parsedResume);
    const jobReq = findBestJobRequirement(term, parsedJob);

    if (inResume) {
      positiveMatches.push({
        keyword: term,
        category: HARD_SKILLS_DICTIONARY[term] ? "hard_skill" : "soft_skill",
        jobRequirement: jobReq,
        resumeEvidence: inResume.sentence,
        evidenceType: inResume.evidenceType,
        relevanceExplanation: generateRelevanceExplanation(
          term,
          inResume.evidenceType,
          inResume.section,
          inResume.sentence,
          jobReq,
        ),
        resumeSection: capitalize(inResume.section),
      });
    } else {
      missingRequirements.push({
        keyword: term,
        category: HARD_SKILLS_DICTIONARY[term] ? "hard_skill" : "soft_skill",
        jobRequirement: jobReq,
        importance: "required",
        importanceJustification: `Identified as a relevant competency in the target job description.`,
        currentObservation: `No direct mention of "${term}" was identified in the provided resume text.`,
        unverifiedAspects: `Practical application of ${term} is not documented in the uploaded resume.`,
        actionableRecommendation: `If you have experience with ${term}, add a factual bullet point detailing your work. Do not fabricate credentials.`,
      });
    }
  }

  const narrative = `Your current match score is ${overallScore}%. This supplementary analysis identified ${positiveMatches.length} matching competencies with textual evidence in your resume, and noted ${missingRequirements.length} requirements that are unverified in the document text. This analysis is supplementary and does not alter the original match score.`;

  return {
    overallScore,
    scoreVerdict: verdict,
    scoreSummaryNarrative: narrative,
    dimensionBreakdown: [
      {
        dimension: "Supplementary Textual Analysis",
        score: overallScore,
        weightDescription: "Based on overall document textual comparison",
        status: overallScore >= 70 ? "strong" : "moderate",
        summary: `Overall score: ${overallScore}%.`,
        evidenceSummary: `Observed ${positiveMatches.length} matching competencies and ${missingRequirements.length} unverified requirements.`,
      },
    ],
    positiveMatches,
    missingRequirements,
    areasToImprove: [
      `Review unverified requirements: Ensure that all genuine qualifications matching the job description are documented clearly in your resume bullets.`,
    ],
    isSupplementaryAnalysis: true,
    evidenceQuotesCount: positiveMatches.length,
    disclaimer:
      "NOTICE: This is a supplementary textual analysis generated because granular scoring outputs were not supplied. It does not recalculate or modify the existing match score.",
  };
}
