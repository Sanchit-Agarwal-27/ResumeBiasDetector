export type BiasCategory =
  "gender_coded" | "age_indicative" | "prestige_proxy" | "gap_framing" | "disability_coded";

export type SeverityLevel = "low" | "medium" | "high";

export interface BiasSpan {
  id: string;
  start: number;
  end: number;
  matched_text: string;
  category: BiasCategory;
  subcategory?: string;
  severity: SeverityLevel;
  confidence: number;
  explanation: string;
  research_citation?: string;
}

export interface RewriteSuggestion {
  span_id: string;
  original_text: string;
  suggested_text: string;
  rationale: string;
}

export interface FairnessMetric {
  metric_name: string;
  value: number;
  threshold: number;
  passes_rule: boolean;
  notes: string;
}

export interface EvaluationBenchmark {
  model_name: string;
  precision: number;
  recall: number;
  f1_score: number;
}

export interface JobDescriptionProfile {
  id: string;
  title: string;
  company?: string;
  raw_text: string;
  target_seniority?: string;
}

export type KeywordImportance = "required" | "preferred" | "domain_context";
export type MatchStatus = "exact" | "synonym" | "missing";

export interface KeywordMatchEntry {
  keyword: string;
  category: "hard_skill" | "soft_skill" | "certification" | "tool_framework";
  importance: KeywordImportance;
  status: MatchStatus;
  foundInResume: boolean;
  frequencyInJob: number;
  frequencyInResume: number;
  suggestedAction?: string;
}

export interface AtsSectionCoverage {
  contact_info: boolean;
  work_experience: boolean;
  education: boolean;
  skills_section: boolean;
  overall_structure_score: number;
}

export interface CounterfactualJobSimulation {
  baseline_ats_score: number;
  debiased_ats_score: number;
  score_delta: number;
  ats_verdict:
    "Strong Candidate" | "Interview Threshold" | "Risky Filter Trigger" | "Likely Screened Out";
  adverse_impact_risk: "Low" | "Medium" | "High";
  net_verdict_explanation: string;
  recommendations: string[];
}

export interface AtsMatchResult {
  job_profile: JobDescriptionProfile;
  overall_match_score: number; // 0 - 100
  hard_skills_score: number; // 0 - 100
  soft_skills_score: number; // 0 - 100
  semantic_relevance_score: number; // 0 - 100
  section_coverage: AtsSectionCoverage;
  matched_keywords: KeywordMatchEntry[];
  missing_keywords: KeywordMatchEntry[];
  counterfactual_simulation: CounterfactualJobSimulation;
  analyzed_at: string;
}

export interface ResumeBiasReport {
  document_id: string;
  file_name: string;
  raw_text: string;
  neutrality_score: number;
  summary: {
    total_flags: number;
    by_category: Record<BiasCategory, number>;
    by_severity: Record<SeverityLevel, number>;
  };
  spans: BiasSpan[];
  suggestions: Record<string, RewriteSuggestion>;
  fairness_audit?: {
    disparate_impact_ratio: FairnessMetric;
    demographic_parity: FairnessMetric;
    counterfactual_permutations_tested: number;
  };
  evaluation_benchmarks?: EvaluationBenchmark[];
  target_job?: JobDescriptionProfile;
  ats_match?: AtsMatchResult;
}

export const sampleReport: ResumeBiasReport = {
  document_id: "doc-sample-tech-lead-01",
  file_name: "Alex_Vance_Resume.pdf",
  raw_text: `Alex Vance
alex.vance@cloudtech.io | (555) 382-9102 | San Francisco, CA | linkedin.com/in/alexvance

PROFESSIONAL SUMMARY
Senior Engineering Lead with 22 years of experience architecting large-scale cloud infrastructure and leading distributed platforms. An aggressive and competitive team driver who graduated from Stanford University in 1999. Took a sabbatical gap year in 2018 before returning to lead enterprise infrastructure scaling.

WORK EXPERIENCE
Senior Engineering Lead | CloudScale Infrastructure | San Francisco, CA (2019 – Present)
• Directed 24 distributed platform engineers responsible for multi-region microservices handling 120M daily transactions.
• Architected automated Kubernetes container deployments, reducing mean time to recovery (MTTR) by 45%.
• Spearheaded migration from legacy monoliths to event-driven Kafka pipelines with 99.995% uptime SLA.
• Partnered with executive leadership to establish engineering recruitment rubrics and mentor senior engineers.

Staff Systems Engineer | Apex Distributed Systems | San Jose, CA (2012 – 2018)
• Designed resilient distributed storage engines using Go, Rust, and PostgreSQL for global enterprise clients.
• Reduced database query latency by 60% through aggressive caching tiers and Redis cluster optimization.
• Led cross-functional incident post-mortems and instituted automated chaos engineering testing across production environments.

EDUCATION
Stanford University | Stanford, CA
Bachelor of Science in Computer Science (Graduated in 1999)

TECHNICAL SKILLS & CERTIFICATIONS
• Languages & Frameworks: Go, Python, TypeScript, Node.js, Java, SQL, Rust, React
• Cloud & DevOps: AWS (Solutions Architect Professional), Google Cloud Platform, Kubernetes, Docker, Terraform
• Architecture: Distributed Systems, High Availability, Microservices, Event-Driven Architecture, CI/CD`,
  neutrality_score: 74,
  summary: {
    total_flags: 5,
    by_category: {
      gender_coded: 2,
      age_indicative: 1,
      prestige_proxy: 1,
      gap_framing: 1,
      disability_coded: 0,
    },
    by_severity: { high: 1, medium: 3, low: 1 },
  },
  spans: [
    {
      id: "span-001",
      start: 258,
      end: 268,
      matched_text: "aggressive",
      category: "gender_coded",
      subcategory: "masculine_leadership",
      severity: "high",
      confidence: 0.94,
      explanation:
        "Masculine-coded adjective according to Gaucher et al. research; often triggers adverse subconscious screening in collaborative culture filters.",
      research_citation: "Gaucher, Friesen, & Kay (2011)",
    },
    {
      id: "span-002",
      start: 273,
      end: 284,
      matched_text: "competitive",
      category: "gender_coded",
      subcategory: "masculine_culture",
      severity: "medium",
      confidence: 0.88,
      explanation: "Over-indexing on individualistic dominance traits over team outcome measures.",
      research_citation: "Gaucher et al. (2011)",
    },
    {
      id: "span-003",
      start: 316,
      end: 335,
      matched_text: "Stanford University",
      category: "prestige_proxy",
      subcategory: "institution_weighting",
      severity: "low",
      confidence: 0.82,
      explanation:
        "Institutional brand creates pedigree bias in automated ATS algorithms; can mask core skill parity.",
      research_citation: "Rivera (2012) Pedigree Screen Study",
    },
    {
      id: "span-004",
      start: 339,
      end: 343,
      matched_text: "1999",
      category: "age_indicative",
      subcategory: "graduation_year_proxy",
      severity: "medium",
      confidence: 0.98,
      explanation:
        "Listing graduation years older than 10-15 years acts as an overt age proxy that triggers screening bias.",
      research_citation: "EEOC Age Discrimination Guidelines",
    },
    {
      id: "span-005",
      start: 363,
      end: 371,
      matched_text: "gap year",
      category: "gap_framing",
      subcategory: "unexplained_career_break",
      severity: "medium",
      confidence: 0.86,
      explanation:
        "Framing career pauses with informal hiatus wording can negatively bias algorithmic resume parsing.",
      research_citation: "Weisshaar (2018) Opt-Out vs Career Continuity Study",
    },
  ],
  suggestions: {
    "span-001": {
      span_id: "span-001",
      original_text: "aggressive",
      suggested_text: "ambitious and goal-oriented",
      rationale:
        "Replaces gender-skewed phrasing with an objective, outcome-oriented achievement descriptor.",
    },
    "span-002": {
      span_id: "span-002",
      original_text: "competitive",
      suggested_text: "results-driven",
      rationale: "Emphasizes team achievement rather than hyper-individualistic phrasing.",
    },
    "span-003": {
      span_id: "span-003",
      original_text: "Stanford University",
      suggested_text: "Accredited University (B.S. Computer Science)",
      rationale: "Optional blinded-resume format option for initial blind screening rounds.",
    },
    "span-004": {
      span_id: "span-004",
      original_text: "in 1999",
      suggested_text: "",
      rationale:
        "Standard industry recommendation is to omit graduation dates beyond 10 years to prevent age filtering.",
    },
    "span-005": {
      span_id: "span-005",
      original_text: "gap year",
      suggested_text: "professional development sabbatical",
      rationale:
        "Frames intentional career pauses with constructive skill-advancement terminology.",
    },
  },
  fairness_audit: {
    disparate_impact_ratio: {
      metric_name: "Four-Fifths Rule (Adverse Impact Ratio)",
      value: 0.86,
      threshold: 0.8,
      passes_rule: true,
      notes: "Selection rate across demographic name substitutions passes the EEOC 80% guideline.",
    },
    demographic_parity: {
      metric_name: "Demographic Parity Variance",
      value: 0.03,
      threshold: 0.05,
      passes_rule: true,
      notes: "Score variation remains under 5% across ethnicity and gender proxy swaps.",
    },
    counterfactual_permutations_tested: 48,
  },
  evaluation_benchmarks: [
    {
      model_name: "Lexicon Baseline (Dictionary Match)",
      precision: 0.68,
      recall: 0.61,
      f1_score: 0.64,
    },
    {
      model_name: "Hybrid Lexicon + DistilBERT (Current)",
      precision: 0.89,
      recall: 0.84,
      f1_score: 0.86,
    },
  ],
};
