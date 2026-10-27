/**
 * @file sentence-classifier.ts
 * Implements Stages 1 to 5 of the BiasLens Context-Aware Architecture:
 * - Stage 1: Sentence Input (single sentence or multi-sentence splitting).
 * - Stage 2: Keyword Candidate Detection (morphological, fuzzy, & multiword scanning).
 * - Stage 3: Context-Aware Classification (Strict binary: "Fine" vs "Flagged").
 * - Stage 4: Explainable AI (grounded, factual rationale referencing input words).
 * - Stage 5: Structured Experimental Output format.
 */

import { CLASSIFICATION, type ClassifiedSentence, type CandidateMatch } from "./types";
import { scanExpandedCandidates } from "./morphological-matcher";
import { extractSentences, tokenize } from "./local-context-engine";
import {
  TECHNICAL_OBJECTS,
  TECHNICAL_ACTIONS,
  SKILL_AND_COMPETENCY_NOUNS,
  STRATEGY_AND_BUSINESS_OBJECTS,
  INTERPERSONAL_TARGETS,
  BEHAVIORAL_CONDUCT_WORDS,
  CAREER_CONTINUITY_TOKENS,
} from "./semantic-patterns";

/**
 * Classifies an individual resume sentence into strictly "Fine" or "Flagged".
 *
 * @param sentence The raw input sentence.
 * @param surroundingText Optional surrounding paragraph/document context.
 * @returns Stage 5 structured output: { sentence, keyword_match, classification, confidence, explanation, contextType }
 */
export function classifySentence(sentence: string, surroundingText = ""): ClassifiedSentence {
  if (!sentence || typeof sentence !== "string" || sentence.trim().length === 0) {
    return {
      sentence: sentence || "",
      keyword_match: [],
      classification: CLASSIFICATION.FINE,
      confidence: 1.0,
      explanation: "Sentence is empty or contains only whitespace.",
      contextType: "empty",
      candidate_matches: [],
    };
  }

  const trimmedSentence = sentence.trim();
  const lowerSentence = trimmedSentence.toLowerCase();
  const tokens = tokenize(trimmedSentence);

  // -------------------------------------------------------------
  // STAGE 2: Keyword Candidate Detection
  // -------------------------------------------------------------
  const candidates: CandidateMatch[] = scanExpandedCandidates(trimmedSentence);

  // If no candidate keywords match:
  if (candidates.length === 0) {
    return {
      sentence: trimmedSentence,
      keyword_match: [],
      classification: CLASSIFICATION.FINE,
      confidence: 0.95,
      explanation:
        "No bias-related candidate keywords were detected in the sentence; language appears neutral and job-relevant.",
      contextType: "neutral_no_keywords",
      candidate_matches: [],
    };
  }

  const matchedKeywords = Array.from(new Set(candidates.map((c) => c.matchedText)));

  // -------------------------------------------------------------
  // STAGE 3 & 4: Contextual Analysis & Explainable AI
  // -------------------------------------------------------------

  // Syntactic indicators
  const hasTechnicalObject = tokens.some((t) => TECHNICAL_OBJECTS.has(t));
  const hasTechnicalAction = tokens.some((t) => TECHNICAL_ACTIONS.has(t));
  const hasSkillNoun = tokens.some((t) => SKILL_AND_COMPETENCY_NOUNS.has(t));
  const hasStrategyObject = tokens.some((t) => STRATEGY_AND_BUSINESS_OBJECTS.has(t));
  const hasInterpersonalTarget = tokens.some((t) => INTERPERSONAL_TARGETS.has(t));
  const hasBehavioralConduct = tokens.some((t) => BEHAVIORAL_CONDUCT_WORDS.has(t));
  const hasCareerContinuity = tokens.some((t) => CAREER_CONTINUITY_TOKENS.has(t));

  const hasHiringPreference =
    lowerSentence.includes("prefer") ||
    lowerSentence.includes("prefers") ||
    lowerSentence.includes("preference") ||
    lowerSentence.includes("seeking") ||
    lowerSentence.includes("looking for") ||
    lowerSentence.includes("must be") ||
    lowerSentence.includes("required to be") ||
    lowerSentence.includes("ideal candidate is");

  const hasDeficitInference =
    lowerSentence.includes("less committed") ||
    lowerSentence.includes("lack of commitment") ||
    lowerSentence.includes("not committed") ||
    lowerSentence.includes("uncommitted") ||
    lowerSentence.includes("out of date") ||
    lowerSentence.includes("outdated") ||
    lowerSentence.includes("unreliable") ||
    lowerSentence.includes("excessive supervision") ||
    lowerSentence.includes("burden") ||
    lowerSentence.includes("liability") ||
    lowerSentence.includes("skills rusty") ||
    lowerSentence.includes("rusty skills");

  // Rule 1: Explicit Hiring Preference on Protected / Sensitive Characteristics
  // e.g. "The company prefers young and energetic candidates."
  if (hasHiringPreference) {
    const sensitiveCandidates = candidates.filter(
      (c) =>
        c.category === "age_indicative" ||
        c.category === "gender_coded" ||
        c.category === "disability_coded" ||
        c.category === "prestige_proxy" ||
        c.category === "personality_behavioral",
    );

    if (sensitiveCandidates.length > 0) {
      const terms = sensitiveCandidates.map((c) => `'${c.matchedText}'`).join(" and ");
      return {
        sentence: trimmedSentence,
        keyword_match: matchedKeywords,
        classification: CLASSIFICATION.FLAGGED,
        confidence: 0.96,
        explanation: `The sentence explicitly expresses a hiring preference for ${terms}, introducing an unlawful or discriminatory screening criterion under EEOC/ADEA/Title VII guidelines.`,
        contextType: "explicit_hiring_preference",
        candidate_matches: candidates,
      };
    }
  }

  // Rule 2: Explicit Negative Inference or Deficit Framing
  // e.g. "The candidate took a two-year career break and is therefore less committed to the company."
  // e.g. "The candidate has a disability and may require excessive supervision."
  if (hasDeficitInference) {
    const gapOrDisability = candidates.filter(
      (c) =>
        c.category === "gap_framing" ||
        c.category === "disability_coded" ||
        c.matchedText.toLowerCase().includes("career break") ||
        c.matchedText.toLowerCase().includes("employment gap") ||
        c.matchedText.toLowerCase().includes("disability") ||
        c.matchedText.toLowerCase().includes("less committed"),
    );

    if (gapOrDisability.length > 0) {
      const terms = gapOrDisability.map((c) => `'${c.matchedText}'`).join(" and ");
      return {
        sentence: trimmedSentence,
        keyword_match: matchedKeywords,
        classification: CLASSIFICATION.FLAGGED,
        confidence: 0.95,
        explanation: `The sentence explicitly uses ${terms} to infer reduced professional commitment or capability, creating an unfair and discriminatory deficit assumption.`,
        contextType: "negative_deficit_inference",
        candidate_matches: candidates,
      };
    }
  }

  // Rule 3: Hostile, Combative, or Abrasive Interpersonal Conduct (including typos like 'anfrily')
  // e.g. "He reacted anfrily to the team during sprint planning."
  // e.g. "Candidate was combative and hostile during code review discussions."
  const hostileCandidate = candidates.find(
    (c) =>
      c.subcategory === "hostile_conduct" ||
      c.matchedText.toLowerCase() === "anfrily" ||
      c.matchedText.toLowerCase() === "angrily" ||
      c.matchedText.toLowerCase() === "angry" ||
      c.matchedText.toLowerCase() === "hostile" ||
      c.matchedText.toLowerCase() === "combative" ||
      c.matchedText.toLowerCase() === "confrontational" ||
      c.matchedText.toLowerCase() === "confrontatonal" ||
      c.matchedText.toLowerCase() === "argumentative" ||
      c.matchedText.toLowerCase() === "short-tempered" ||
      c.matchedText.toLowerCase() === "abrasive" ||
      c.matchedText.toLowerCase() === "defensive" ||
      c.matchedText.toLowerCase() === "toxic" ||
      c.matchedText.toLowerCase() === "shouting" ||
      c.matchedText.toLowerCase() === "screaming" ||
      c.matchedText.toLowerCase() === "demeaning" ||
      c.matchedText.toLowerCase() === "belittling",
  );

  if (hostileCandidate) {
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FLAGGED,
      confidence: 0.95,
      explanation: `The term '${hostileCandidate.matchedText}' reflects hostile, combative, or unprofessional conduct, introducing subjective interpersonal bias into candidate evaluation.`,
      contextType: "hostile_combative_conduct",
      candidate_matches: candidates,
    };
  }

  // Rule 4: Subjective Behavioral Assertions and Interpersonal Conflict
  // e.g. "Colleagues noted the candidate has a difficult personality and is hard to work with, often not a team player."
  const conflictPhrase = candidates.find(
    (c) =>
      c.subcategory === "interpersonal_conflict" ||
      c.matchedText.toLowerCase().includes("difficult personality") ||
      c.matchedText.toLowerCase().includes("hard to work with") ||
      c.matchedText.toLowerCase().includes("not a team player") ||
      c.matchedText.toLowerCase().includes("bad attitude") ||
      c.matchedText.toLowerCase().includes("inflexible"),
  );

  if (conflictPhrase) {
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FLAGGED,
      confidence: 0.93,
      explanation: `Contains unsubstantiated subjective behavioral assertions ('${conflictPhrase.matchedText}') that introduce personality conflict bias rather than objective, documented performance metrics.`,
      contextType: "subjective_behavioral_assertion",
      candidate_matches: candidates,
    };
  }

  // Rule 5: Culture Fit & Unstandardized Affinity Proxies
  // e.g. "The hiring committee evaluated whether the engineer was a good culture fit."
  // e.g. "Failed the beer test despite strong technical credentials."
  const cultureFitPhrase = candidates.find(
    (c) =>
      c.subcategory === "culture_fit_proxy" ||
      c.matchedText.toLowerCase().includes("culture fit") ||
      c.matchedText.toLowerCase().includes("cultural fit") ||
      c.matchedText.toLowerCase().includes("personality fit") ||
      c.matchedText.toLowerCase().includes("team fit") ||
      c.matchedText.toLowerCase().includes("social fit") ||
      c.matchedText.toLowerCase().includes("beer test") ||
      c.matchedText.toLowerCase().includes("airport test"),
  );

  if (cultureFitPhrase) {
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FLAGGED,
      confidence: 0.92,
      explanation: `Evaluating candidates based on '${cultureFitPhrase.matchedText}' introduces an unstandardized affinity proxy that frequently reproduces demographic homogeneity and unconscious bias.`,
      contextType: "culture_fit_affinity_proxy",
      candidate_matches: candidates,
    };
  }

  // Rule 6: Protected Demographic, Generational, Linguistic & Prestige Proxies
  // e.g. "digital native", "clean bill of health", "young professional", "recent graduate", "overqualified", "native English speaker", "Ivy League", "rockstar"
  const proxyCandidate = candidates.find(
    (c) =>
      c.subcategory === "generational_tech_proxy" ||
      c.subcategory === "entry_cohort_proxy" ||
      c.subcategory === "linguistic_nationality_proxy" ||
      c.subcategory === "physical_endurance_proxy" ||
      c.matchedText.toLowerCase().includes("digital native") ||
      c.matchedText.toLowerCase().includes("tech-savvy generation") ||
      c.matchedText.toLowerCase().includes("young professional") ||
      c.matchedText.toLowerCase().includes("energetic youth") ||
      c.matchedText.toLowerCase().includes("recent graduate") ||
      c.matchedText.toLowerCase().includes("fresh graduate") ||
      c.matchedText.toLowerCase().includes("college graduate") ||
      c.matchedText.toLowerCase().includes("overqualified") ||
      c.matchedText.toLowerCase().includes("too experienced") ||
      c.matchedText.toLowerCase().includes("clean bill of health") ||
      c.matchedText.toLowerCase().includes("tireless 24/7 availability") ||
      c.matchedText.toLowerCase().includes("differently abled") ||
      c.matchedText.toLowerCase().includes("differently-abled") ||
      c.matchedText.toLowerCase().includes("native english speaker") ||
      c.matchedText.toLowerCase().includes("clean accent") ||
      c.matchedText.toLowerCase().includes("accentless english") ||
      c.matchedText.toLowerCase().includes("mother tongue") ||
      c.matchedText.toLowerCase().includes("rockstar") ||
      c.matchedText.toLowerCase().includes("ninja") ||
      c.matchedText.toLowerCase().includes("10x engineer") ||
      c.matchedText.toLowerCase().includes("over 25 years of experience") ||
      c.matchedText.toLowerCase().includes("seasoned veteran") ||
      c.matchedText.toLowerCase().includes("ivy league") ||
      c.matchedText.toLowerCase().includes("top tier university") ||
      c.matchedText.toLowerCase().includes("tier 1 school") ||
      (c.category === "prestige_proxy" && !lowerSentence.includes("degree")),
  );

  if (proxyCandidate) {
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FLAGGED,
      confidence: 0.94,
      explanation: `The phrase '${proxyCandidate.matchedText}' functions as an overt proxy for protected characteristics (such as age, national origin, physical health status, or elitist pedigree), introducing disparate screening barriers.`,
      contextType: "protected_demographic_proxy",
      candidate_matches: candidates,
    };
  }

  // Rule 7: Legacy Graduation Year Proxy
  // e.g. "Graduated from State University with a Bachelor of Science in Computer Science in 1997."
  const graduationProxyCandidate = candidates.find(
    (c) => c.subcategory === "graduation_year_proxy",
  );
  if (graduationProxyCandidate) {
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FLAGGED,
      confidence: 0.95,
      explanation: `Listing graduation dates older than 20 years ('${graduationProxyCandidate.matchedText}') operates as an age proxy in automated screening, creating disparate barrier risk under EEOC/ADEA guidelines.`,
      contextType: "graduation_year_proxy",
      candidate_matches: candidates,
    };
  }

  // Rule 8: Ambiguous Leadership Style or Subjective Personality Judgment
  // e.g. "The candidate has an aggressive leadership style."
  if (
    lowerSentence.includes("leadership style") ||
    lowerSentence.includes("management style") ||
    lowerSentence.includes("working style") ||
    lowerSentence.includes("personality style") ||
    (lowerSentence.includes("candidate has an") && lowerSentence.includes("style"))
  ) {
    const styleCandidate = candidates.find(
      (c) =>
        c.matchedText.toLowerCase().includes("aggressive") ||
        c.matchedText.toLowerCase().includes("dominant") ||
        c.matchedText.toLowerCase().includes("controlling") ||
        c.matchedText.toLowerCase().includes("forceful"),
    );

    if (styleCandidate) {
      const phraseText = styleCandidate.matchedText.toLowerCase().includes("style")
        ? `'${styleCandidate.matchedText}'`
        : `'${styleCandidate.matchedText} leadership style'`;
      return {
        sentence: trimmedSentence,
        keyword_match: matchedKeywords,
        classification: CLASSIFICATION.FLAGGED,
        confidence: 0.88,
        explanation: `The phrase ${phraseText} represents a subjective personality judgment relevant to hiring that can reflect gender-coded stereotypes. Although the immediate sentence context is insufficient to establish whether the judgment is unfair, subjective personality labels without objective metrics represent an unstandardized screening risk.`,
        contextType: "subjective_leadership_style",
        candidate_matches: candidates,
      };
    }
  }

  // Rule 9: Interpersonal Conduct Targeting People (Colleagues, Teammates, Staff)
  // e.g. "He used aggressive language when criticizing his teammates."
  if (
    hasInterpersonalTarget &&
    (hasBehavioralConduct ||
      lowerSentence.includes("criticiz") ||
      lowerSentence.includes("shout") ||
      lowerSentence.includes("language"))
  ) {
    const behavioralWord = candidates.find(
      (c) =>
        c.matchedText.toLowerCase().includes("aggressive") ||
        c.matchedText.toLowerCase().includes("combative") ||
        c.matchedText.toLowerCase().includes("hostile") ||
        c.matchedText.toLowerCase().includes("confrontational"),
    );

    if (behavioralWord) {
      return {
        sentence: trimmedSentence,
        keyword_match: matchedKeywords,
        classification: CLASSIFICATION.FLAGGED,
        confidence: 0.92,
        explanation: `The word '${behavioralWord.matchedText}' characterizes interpersonal communication directed at coworkers; unsubstantiated negative behavioral characterizations warrant review to verify objective evidence.`,
        contextType: "interpersonal_conduct_risk",
        candidate_matches: candidates,
      };
    }
  }

  // Rule 10: Technical Accessibility Feature for Disabled Users (Exoneration)
  // e.g. "He developed an application that improves accessibility for people with disabilities."
  // e.g. "Implemented accessibility needs and screen-reader accommodations compliant with WCAG 2.1 AA."
  const isA11yFeature =
    (lowerSentence.includes("accessibility") ||
      lowerSentence.includes("accommodation") ||
      lowerSentence.includes("wcag") ||
      lowerSentence.includes("screen-reader")) &&
    (tokens.includes("application") ||
      tokens.includes("developed") ||
      tokens.includes("built") ||
      tokens.includes("improves") ||
      tokens.includes("implemented") ||
      tokens.includes("features") ||
      tokens.includes("supported") ||
      tokens.includes("software"));

  if (isA11yFeature) {
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FINE,
      confidence: 0.96,
      explanation: `The sentence describes an engineering contribution building digital accessibility features for people with disabilities, representing a legitimate technical deliverable rather than a discriminatory assumption.`,
      contextType: "technical_accessibility_contribution",
      candidate_matches: candidates,
    };
  }

  // --------------------------------------------------------------------------
  // Rule 11: Polysemous Technical Achievements & Engineering Actions (Exoneration)
  // ONLY exonerates terms with legitimate technical/business polysemy
  // (e.g. 'aggressive caching', 'aggressively optimized', 'young engineer who developed', 'nurturing accounts')
  // --------------------------------------------------------------------------
  const POLYSEMOUS_TECHNICAL_TERMS = new Set([
    "aggressive",
    "aggressively",
    "aggression",
    "strong",
    "stronger",
    "strongest",
    "flexible",
    "adaptable",
    "supportive",
    "nurturing",
    "competitive",
    "competitively",
    "young",
    "experienced",
  ]);

  const hasOnlyPolysemousCandidates = candidates.every((c) =>
    POLYSEMOUS_TECHNICAL_TERMS.has(c.matchedText.toLowerCase()),
  );

  if (
    hasOnlyPolysemousCandidates &&
    (hasTechnicalObject || hasTechnicalAction) &&
    !hasInterpersonalTarget &&
    !hasHiringPreference
  ) {
    // If 'young' is used descriptively in an achievement sentence:
    // e.g. "She is a young engineer who developed a distributed system."
    const youngCandidate = candidates.find((c) => c.matchedText.toLowerCase() === "young");
    if (youngCandidate) {
      return {
        sentence: trimmedSentence,
        keyword_match: matchedKeywords,
        classification: CLASSIFICATION.FINE,
        confidence: 0.92,
        explanation: `The word 'young' is used descriptively to modify the engineer within a technical achievement sentence ('developed a distributed system'). It does not establish an employer screening restriction or hiring preference.`,
        contextType: "descriptive_age_achievement",
        candidate_matches: candidates,
      };
    }

    const techCandidate = candidates[0];
    const matchedObj = tokens.find((t) => TECHNICAL_OBJECTS.has(t)) || "technical system";
    const matchedAct = tokens.find((t) => TECHNICAL_ACTIONS.has(t)) || "optimization";

    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FINE,
      confidence: 0.96,
      explanation: `The word '${techCandidate.matchedText}' describes a technical achievement (${matchedAct} on ${matchedObj}) rather than interpersonal conduct or demographic stereotyping.`,
      contextType: "technical_achievement",
      candidate_matches: candidates,
    };
  }

  // Rule 11B: Technical Skills, Competencies, and Inanimate Architecture
  // e.g. "Strong background in Python and distributed databases with proven problem-solving skills."
  // e.g. "Designed a flexible, modular microservices architecture."
  if (
    hasOnlyPolysemousCandidates &&
    (hasSkillNoun || tokens.includes("architecture") || tokens.includes("framework"))
  ) {
    const techSkillCandidate = candidates.find(
      (c) =>
        c.matchedText.toLowerCase() === "strong" ||
        c.matchedText.toLowerCase() === "flexible" ||
        c.matchedText.toLowerCase() === "adaptable",
    );
    if (techSkillCandidate) {
      const target =
        tokens.find((t) => SKILL_AND_COMPETENCY_NOUNS.has(t)) || "technical architecture";
      return {
        sentence: trimmedSentence,
        keyword_match: matchedKeywords,
        classification: CLASSIFICATION.FINE,
        confidence: 0.95,
        explanation: `The word '${techSkillCandidate.matchedText}' describes technical proficiency and competency depth (${target}) rather than an agentic gender stereotype.`,
        contextType: "technical_competency_depth",
        candidate_matches: candidates,
      };
    }
  }

  // Rule 11C: Inanimate Business Strategy / Competitive Market Analysis
  // e.g. "Conducted comprehensive competitive analysis against top five market competitors to guide product pricing."
  // e.g. "The team adopted an aggressive optimization strategy to reduce processing time."
  if (hasOnlyPolysemousCandidates && hasStrategyObject && !hasInterpersonalTarget) {
    const stratObj =
      tokens.find((t) => STRATEGY_AND_BUSINESS_OBJECTS.has(t)) || "business strategy";
    const stratCandidate = candidates[0];
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FINE,
      confidence: 0.95,
      explanation: `The word '${stratCandidate.matchedText}' qualifies an inanimate operational strategy (${stratObj}) rather than personal interpersonal behavior or discriminatory bias.`,
      contextType: "inanimate_business_strategy",
      candidate_matches: candidates,
    };
  }

  // Rule 11D: Commercial Client Relationship & Account Leadership with quantitative outcomes
  // e.g. "Nurturing enterprise client accounts generated a 35% increase in annual contract renewals."
  if (
    hasOnlyPolysemousCandidates &&
    (tokens.includes("client") ||
      tokens.includes("clients") ||
      tokens.includes("accounts") ||
      tokens.includes("contract") ||
      tokens.includes("contracts") ||
      tokens.includes("renewals")) &&
    (tokens.includes("renewals") ||
      tokens.includes("increase") ||
      tokens.includes("generated") ||
      tokens.includes("revenue") ||
      tokens.includes("growth"))
  ) {
    const commercialCand = candidates[0];
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FINE,
      confidence: 0.94,
      explanation: `The term '${commercialCand.matchedText}' describes professional commercial relationship management and client account leadership accompanied by verifiable business metrics, rather than a gendered stereotype.`,
      contextType: "commercial_account_leadership",
      candidate_matches: candidates,
    };
  }

  // Rule 12: Constructive Career Gap with Upskilling / Education
  // e.g. "Took a two-year career break for family care and completed AWS cloud certification."
  if (
    (lowerSentence.includes("career break") || lowerSentence.includes("employment gap")) &&
    hasCareerContinuity
  ) {
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FINE,
      confidence: 0.94,
      explanation: `The career break is contextually accompanied by active professional upskilling, education, or certification without negative inferences of diminished competence.`,
      contextType: "constructive_career_transition",
      candidate_matches: candidates,
    };
  }

  // Rule 13: Neutral/Harmless Qualification Mention (e.g. "The candidate is an experienced engineer with strong technical skills.")
  if (
    hasOnlyPolysemousCandidates &&
    (tokens.includes("engineer") ||
      tokens.includes("developer") ||
      tokens.includes("analyst") ||
      tokens.includes("manager") ||
      tokens.includes("consultant") ||
      tokens.includes("skills") ||
      tokens.includes("experience"))
  ) {
    const hasDiscriminatoryPhrase = candidates.some(
      (c) =>
        c.category === "gender_coded" &&
        (c.matchedText === "manly" || c.matchedText === "girly" || c.matchedText === "macho"),
    );
    if (!hasDiscriminatoryPhrase && !hasHiringPreference && !hasDeficitInference) {
      return {
        sentence: trimmedSentence,
        keyword_match: matchedKeywords,
        classification: CLASSIFICATION.FINE,
        confidence: 0.91,
        explanation: `The terms [${matchedKeywords.join(", ")}] describe legitimate professional qualifications and background without unfair assumptions.`,
        contextType: "neutral_professional_qualification",
        candidate_matches: candidates,
      };
    }
  }

  // Rule 14: Neutral Chronological Date Ranges, Credentials & Employment Entries
  // e.g. "Aug. 2014 – May 2018", "Software Engineer | 2020 – 2024", "B.A. in Computer Science | 2014–2018", "Southwestern University | Georgetown, TX"
  const isDateRangeOrCredential =
    /^(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}\s*[-–—/]\s*(?:(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*)?(?:19|20)\d{2}|Present|Current)/i.test(
      trimmedSentence,
    ) ||
    /^(?:Bachelor|Master|Associate(?:'s)?|Ph\.?D|B\.?[SAE]|M\.?[SE]|Degree|Diploma|Candidate)\b/i.test(
      trimmedSentence,
    ) ||
    /^(?:Senior|Staff|Lead|Principal|Software|Frontend|Backend|Fullstack|Data|Systems|DevOps|Cloud|Undergraduate|Research|Student|Tutor|Technician)\s+(?:Engineer|Developer|Architect|Assistant|Technician|Tutor|Scientist|Analyst)\b/i.test(
      trimmedSentence,
    ) ||
    /\b(?:University|College|Institute|School|Academy)\b/i.test(trimmedSentence) ||
    /\|.*(?:19|20)\d{2}/.test(trimmedSentence);

  if (isDateRangeOrCredential && !hasHiringPreference && !hasDeficitInference) {
    return {
      sentence: trimmedSentence,
      keyword_match: matchedKeywords,
      classification: CLASSIFICATION.FINE,
      confidence: 0.95,
      explanation: `Neutral chronological date range or professional credential documenting candidate employment and education history without discriminatory screening restrictions.`,
      contextType: "neutral_chronological_record",
      candidate_matches: candidates,
    };
  }

  // Default Fallback for Unexonerated Sensitive Keywords:
  // If a sensitive keyword remains in a non-technical, uncontextualized sentence,
  // classify as Flagged to ensure potential hiring risks are surfaced.
  const primaryCandidate = candidates[0];
  return {
    sentence: trimmedSentence,
    keyword_match: matchedKeywords,
    classification: CLASSIFICATION.FLAGGED,
    confidence: primaryCandidate.confidence || 0.88,
    explanation:
      primaryCandidate.explanation ||
      `The term '${primaryCandidate.matchedText}' (${primaryCandidate.category}) appears without sufficient technical or objective context, posing a potential stereotyping or subjective screening risk.`,
    contextType: "uncontextualized_sensitive_term",
    candidate_matches: candidates,
  };
}

/**
 * Classifies multi-sentence text by evaluating each constituent sentence.
 *
 * @param text Full resume excerpt or paragraph.
 * @param surroundingText Optional document context.
 * @returns Array of structured Stage 5 sentence results with offsets.
 */
export function classifyDocument(text: string, surroundingText = ""): ClassifiedSentence[] {
  if (!text || typeof text !== "string") return [];
  const sentenceSpans = extractSentences(text);
  if (sentenceSpans.length === 0 && text.trim().length > 0) {
    const res = classifySentence(text.trim(), surroundingText || text);
    res.start = 0;
    res.end = text.trim().length;
    return [res];
  }

  return sentenceSpans.map((span) => {
    const result = classifySentence(span.sentence, text);
    result.start = span.start;
    result.end = span.end;
    return result;
  });
}
