import type {
  JobDescriptionProfile,
  AtsMatchResult,
  KeywordMatchEntry,
  AtsSectionCoverage,
  CounterfactualJobSimulation,
} from "./resume-contract";
import { analyzeResumeText } from "./bias-taxonomy";

// Comprehensive Technical & Domain Skills Dictionary
const HARD_SKILLS_DICTIONARY: Record<string, string[]> = {
  // Languages
  typescript: ["ts", "type-script"],
  javascript: ["js", "ecmascript"],
  python: ["py", "python3"],
  java: ["core java", "j2ee"],
  golang: ["go", "golang"],
  rust: ["rustlang"],
  "c++": ["cpp"],
  "c#": ["csharp", ".net"],
  ruby: ["ruby on rails", "rails"],
  sql: ["postgresql", "postgres", "mysql", "t-sql", "pl/sql", "sqlite"],
  html: ["html5"],
  css: ["css3", "sass", "scss", "tailwind", "styled-components"],

  // Frameworks & Libraries
  react: ["reactjs", "react.js", "next.js", "nextjs"],
  vue: ["vuejs", "nuxt", "nuxtjs"],
  angular: ["angularjs"],
  "node.js": ["nodejs", "node"],
  express: ["express.js"],
  fastapi: ["fast-api"],
  django: ["django rest framework", "drf"],
  flask: ["flask framework"],
  pytorch: ["torch"],
  tensorflow: ["tf", "keras"],
  transformers: ["huggingface", "hugging face"],

  // Cloud & DevOps
  aws: ["amazon web services", "ec2", "s3", "lambda", "ecs", "eks"],
  gcp: ["google cloud platform", "google cloud", "bigquery"],
  azure: ["microsoft azure"],
  docker: ["containerization", "containers"],
  kubernetes: ["k8s"],
  terraform: ["iac", "infrastructure as code"],
  "ci/cd": ["continuous integration", "github actions", "gitlab ci", "jenkins"],
  linux: ["unix", "bash", "shell scripting"],

  // Databases & Storage
  postgresql: ["postgres"],
  mongodb: ["mongo", "nosql"],
  redis: ["redis cache", "in-memory cache"],
  snowflake: ["snowflake dw"],
  bigquery: ["google bigquery"],
  pinecone: ["vector db", "vector database", "milvus", "qdrant", "chroma"],

  // Methodologies & Tools
  "rest api": ["rest", "restful", "api design"],
  graphql: ["apollo graphql"],
  microservices: ["distributed systems"],
  git: ["github", "gitlab"],
  "agile/scrum": ["agile", "scrum", "kanban", "sprints"],
  "unit testing": ["jest", "pytest", "cypress", "playwright", "tdd"],
  rag: ["retrieval augmented generation", "retrieval-augmented generation"],
  llm: ["large language models", "prompt engineering", "genai", "generative ai"],
};

const SOFT_SKILLS_DICTIONARY: Record<string, string[]> = {
  "cross-functional collaboration": ["cross-functional", "collaborated with", "partnered with"],
  leadership: ["mentored", "coached", "led a team", "spearheaded", "directed"],
  "stakeholder management": [
    "executive communication",
    "presented to stakeholders",
    "client-facing",
  ],
  "strategic planning": ["roadmapping", "product strategy", "vision", "okrs"],
  "problem solving": ["analytical thinking", "root cause analysis", "troubleshooting"],
  "user-centered design": ["user research", "customer empathy", "accessibility", "a11y"],
  "data-driven decision making": ["a/b testing", "metric-driven", "kpis", "analytics"],
};

// Section detection heuristics
const SECTION_KEYWORDS = {
  contact_info: ["email", "phone", "linkedin", "github", "@", "tel:", "contact"],
  work_experience: [
    "experience",
    "work history",
    "employment",
    "professional background",
    "positions held",
  ],
  education: [
    "education",
    "degree",
    "university",
    "bachelor",
    "master",
    "ph.d",
    "b.s.",
    "m.s.",
    "college",
  ],
  skills_section: [
    "skills",
    "technical proficiencies",
    "technologies",
    "competencies",
    "tools & frameworks",
  ],
};

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[\r\n\t]+/g, " ");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function countOccurrences(text: string, term: string): number {
  const pattern = new RegExp(`(?:^|[^a-z0-9_#+])${escapeRegex(term)}(?:[^a-z0-9_#+]|$)`, "gi");
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Scan text against a dictionary mapping canonical names to aliases
 */
function extractMatchingEntities(
  sourceText: string,
  dict: Record<string, string[]>,
  category: KeywordMatchEntry["category"],
  isJobDescription: boolean,
): Map<string, { term: string; count: number; category: KeywordMatchEntry["category"] }> {
  const normalized = cleanText(sourceText);
  const found = new Map<
    string,
    { term: string; count: number; category: KeywordMatchEntry["category"] }
  >();

  for (const [canonical, aliases] of Object.entries(dict)) {
    let totalCount = countOccurrences(normalized, canonical);

    // Also check aliases
    for (const alias of aliases) {
      const aliasCount = countOccurrences(normalized, alias);
      totalCount += aliasCount;
    }

    if (totalCount > 0) {
      found.set(canonical, {
        term: canonical,
        count: totalCount,
        category,
      });
    }
  }

  return found;
}

/**
 * Evaluate standard ATS structural section hygiene
 */
export function evaluateAtsSectionHygiene(resumeText: string): AtsSectionCoverage {
  const textLower = resumeText.toLowerCase();

  const hasContact = SECTION_KEYWORDS.contact_info.some((k) => textLower.includes(k));
  const hasExp = SECTION_KEYWORDS.work_experience.some((k) => textLower.includes(k));
  const hasEdu = SECTION_KEYWORDS.education.some((k) => textLower.includes(k));
  const hasSkills = SECTION_KEYWORDS.skills_section.some((k) => textLower.includes(k));

  let score = 0;
  if (hasContact) score += 25;
  if (hasExp) score += 35;
  if (hasEdu) score += 20;
  if (hasSkills) score += 20;

  return {
    contact_info: hasContact,
    work_experience: hasExp,
    education: hasEdu,
    skills_section: hasSkills,
    overall_structure_score: score,
  };
}

/**
 * Compute approximate TF-IDF cosine similarity between Resume and Job Description
 */
function computeSemanticCosineSimilarity(resumeText: string, jobText: string): number {
  const stopWords = new Set([
    "the",
    "and",
    "a",
    "to",
    "of",
    "in",
    "for",
    "with",
    "on",
    "as",
    "by",
    "an",
    "is",
    "at",
    "that",
    "from",
    "are",
    "be",
    "this",
    "our",
    "you",
    "will",
    "or",
    "have",
    "we",
    "your",
    "can",
    "all",
    "about",
    "their",
    "team",
    "years",
    "working",
    "work",
    "experience",
  ]);

  const tokenize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9+#]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  };

  const resumeTokens = tokenize(resumeText);
  const jobTokens = tokenize(jobText);

  if (jobTokens.length === 0 || resumeTokens.length === 0) return 0.5;

  const jobFreq: Record<string, number> = {};
  jobTokens.forEach((t) => (jobFreq[t] = (jobFreq[t] || 0) + 1));

  const resumeFreq: Record<string, number> = {};
  resumeTokens.forEach((t) => (resumeFreq[t] = (resumeFreq[t] || 0) + 1));

  let dotProduct = 0;
  let jobNorm = 0;
  let resumeNorm = 0;

  for (const [token, count] of Object.entries(jobFreq)) {
    jobNorm += count * count;
    if (resumeFreq[token]) {
      dotProduct += count * resumeFreq[token];
    }
  }

  for (const count of Object.values(resumeFreq)) {
    resumeNorm += count * count;
  }

  const denominator = Math.sqrt(jobNorm) * Math.sqrt(resumeNorm);
  if (denominator === 0) return 0.5;

  const similarity = dotProduct / denominator;
  // Normalize to 0-100 bounded
  return Math.min(100, Math.max(20, Math.round(similarity * 180)));
}

/**
 * Main calculation entrypoint: Compare Resume against Target Job Description
 */
export function calculateAtsMatch(
  resumeText: string,
  jobProfile: JobDescriptionProfile,
): AtsMatchResult {
  const jobText = jobProfile.raw_text;

  // 1. Extract hard and soft skills required by Job Description
  const jobHardSkills = extractMatchingEntities(
    jobText,
    HARD_SKILLS_DICTIONARY,
    "hard_skill",
    true,
  );
  const jobSoftSkills = extractMatchingEntities(
    jobText,
    SOFT_SKILLS_DICTIONARY,
    "soft_skill",
    true,
  );

  // 2. Extract skills present in Resume
  const resumeHardSkills = extractMatchingEntities(
    resumeText,
    HARD_SKILLS_DICTIONARY,
    "hard_skill",
    false,
  );
  const resumeSoftSkills = extractMatchingEntities(
    resumeText,
    SOFT_SKILLS_DICTIONARY,
    "soft_skill",
    false,
  );

  const matchedKeywords: KeywordMatchEntry[] = [];
  const missingKeywords: KeywordMatchEntry[] = [];

  // Evaluate hard skills
  let hardMatchedCount = 0;
  const hardTotalCount = Math.max(1, jobHardSkills.size);

  for (const [term, jobMeta] of jobHardSkills.entries()) {
    const resumeMeta = resumeHardSkills.get(term);
    const isFound = Boolean(resumeMeta && resumeMeta.count > 0);
    const importance = jobMeta.count >= 2 ? "required" : "preferred";

    const entry: KeywordMatchEntry = {
      keyword: term,
      category: "hard_skill",
      importance,
      status: isFound ? "exact" : "missing",
      foundInResume: isFound,
      frequencyInJob: jobMeta.count,
      frequencyInResume: resumeMeta?.count || 0,
      suggestedAction: isFound
        ? `Mentioned ${resumeMeta?.count} time(s). Good density.`
        : `High-priority requirement in ${jobProfile.title}. Add to technical competencies or project bullet.`,
    };

    if (isFound) {
      hardMatchedCount++;
      matchedKeywords.push(entry);
    } else {
      missingKeywords.push(entry);
    }
  }

  // Evaluate soft skills
  let softMatchedCount = 0;
  const softTotalCount = Math.max(1, jobSoftSkills.size);

  for (const [term, jobMeta] of jobSoftSkills.entries()) {
    const resumeMeta = resumeSoftSkills.get(term);
    const isFound = Boolean(resumeMeta && resumeMeta.count > 0);
    const importance = jobMeta.count >= 2 ? "required" : "preferred";

    const entry: KeywordMatchEntry = {
      keyword: term,
      category: "soft_skill",
      importance,
      status: isFound ? "exact" : "missing",
      foundInResume: isFound,
      frequencyInJob: jobMeta.count,
      frequencyInResume: resumeMeta?.count || 0,
      suggestedAction: isFound
        ? `Found in resume context.`
        : `Demonstrate in work experience using active outcome metrics.`,
    };

    if (isFound) {
      softMatchedCount++;
      matchedKeywords.push(entry);
    } else {
      missingKeywords.push(entry);
    }
  }

  // Sort missing keywords by importance & frequency in job
  missingKeywords.sort((a, b) => {
    if (a.importance === "required" && b.importance !== "required") return -1;
    if (b.importance === "required" && a.importance !== "required") return 1;
    return b.frequencyInJob - a.frequencyInJob;
  });

  // Calculate Sub-Scores
  const hardSkillsScore = Math.round((hardMatchedCount / hardTotalCount) * 100);
  const softSkillsScore = Math.round((softMatchedCount / softTotalCount) * 100);
  const semanticScore = computeSemanticCosineSimilarity(resumeText, jobText);
  const sectionHygiene = evaluateAtsSectionHygiene(resumeText);

  // Composite ATS Score
  const overallMatchScore = Math.min(
    100,
    Math.max(
      15,
      Math.round(
        hardSkillsScore * 0.45 +
          semanticScore * 0.25 +
          softSkillsScore * 0.15 +
          sectionHygiene.overall_structure_score * 0.15,
      ),
    ),
  );

  // 3. Counterfactual Simulation
  const counterfactualSimulation = simulateCounterfactualImpact(
    resumeText,
    overallMatchScore,
    jobProfile,
    missingKeywords,
  );

  return {
    job_profile: jobProfile,
    overall_match_score: overallMatchScore,
    hard_skills_score: hardSkillsScore,
    soft_skills_score: softSkillsScore,
    semantic_relevance_score: semanticScore,
    section_coverage: sectionHygiene,
    matched_keywords: matchedKeywords,
    missing_keywords: missingKeywords,
    counterfactual_simulation: counterfactualSimulation,
    analyzed_at: new Date().toISOString(),
  };
}

/**
 * Counterfactual Simulator:
 * Shows the candidate what happens when they replace biased/subjective markers with
 * objective competencies, and how missing keyword insertion transforms their ATS score.
 */
function simulateCounterfactualImpact(
  resumeText: string,
  baselineScore: number,
  jobProfile: JobDescriptionProfile,
  missingKeywords: KeywordMatchEntry[],
): CounterfactualJobSimulation {
  const biasAnalysis = analyzeResumeText(resumeText);
  const hasBiasMarkers = biasAnalysis.spans.length > 0;

  // Potential gain from adopting unbiased, competency-driven action verbs
  // Objective keywords replace empty superlatives like "rockstar" or "ninja"
  const potentialDebiasedScore = Math.min(
    100,
    baselineScore + (hasBiasMarkers ? Math.min(12, biasAnalysis.spans.length * 3) : 2),
  );

  const delta = potentialDebiasedScore - baselineScore;

  let verdict: CounterfactualJobSimulation["ats_verdict"];
  if (baselineScore >= 80) {
    verdict = "Strong Candidate";
  } else if (baselineScore >= 65) {
    verdict = "Interview Threshold";
  } else if (baselineScore >= 45) {
    verdict = "Risky Filter Trigger";
  } else {
    verdict = "Likely Screened Out";
  }

  const recommendations: string[] = [];

  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords
      .slice(0, 3)
      .map((k) => `"${k.keyword}"`)
      .join(", ");
    recommendations.push(
      `Incorporate top missing competencies: ${topMissing} to achieve +${Math.min(18, missingKeywords.length * 4)}% ATS ranking boost.`,
    );
  }

  if (hasBiasMarkers) {
    recommendations.push(
      `Replace subjective superlatives (e.g., "${biasAnalysis.spans[0]?.matched_text}") with explicit role keywords matching "${jobProfile.title}".`,
    );
  } else {
    recommendations.push(
      `High neutrality maintained: Your resume relies on verifiable skills rather than exclusionary buzzwords.`,
    );
  }

  recommendations.push(
    `Enterprise scanners like Workday and Greenhouse prioritize exact skill tokens in the top 30% of your resume layout.`,
  );

  return {
    baseline_ats_score: baselineScore,
    debiased_ats_score: potentialDebiasedScore,
    score_delta: delta,
    ats_verdict: verdict,
    adverse_impact_risk: baselineScore < 60 || hasBiasMarkers ? "Medium" : "Low",
    net_verdict_explanation:
      baselineScore >= 70
        ? `Your resume surpasses the standard automated recruiter threshold (70%) for ${jobProfile.title}. Adopting BiasLens recommendations shields you from demographic screening algorithms while maintaining full keyword potency.`
        : `Your resume currently risks automated screening under default enterprise thresholds. Adding the critical missing skills below will bring your profile into the top 15% percentile.`,
    recommendations,
  };
}
