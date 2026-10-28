from __future__ import annotations
import functools
import re
from typing import List, Dict, Any, Tuple, Optional, Set
from ..schemas import (
    ClassifiedSentence,
    ContextSummary,
    BiasSpan,
    BiasCategory,
    SeverityLevel,
    RewriteSuggestion,
)
from .taxonomy import EXPANDED_TAXONOMY, CATEGORY_MAP, SEVERITY_MAP

# --- Semantic Sets from semantic-patterns.ts ---
TECHNICAL_OBJECTS: Set[str] = {
    "pipeline", "pipelines", "latency", "throughput", "inference", "model", "models",
    "database", "databases", "query", "queries", "caching", "cache", "cluster", "clusters",
    "algorithm", "algorithms", "infrastructure", "architecture", "microservice", "microservices",
    "system", "systems", "code", "codebase", "server", "servers", "backend", "frontend",
    "api", "apis", "service", "services", "memory", "cpu", "gpu", "runtime", "execution",
    "compiler", "storage", "container", "containers", "kubernetes", "docker", "devops",
    "cloud", "bandwidth", "hardware", "stack", "framework", "frameworks", "component",
    "components", "module", "modules", "thread", "threads", "concurrency", "workload",
    "workloads", "index", "indices", "data", "dataset", "datasets",
    "python", "javascript", "typescript", "java", "rust", "go", "c++", "sql", "nosql",
    "react", "node", "angular", "vue", "aws", "gcp", "azure", "git", "linux",
    "accessibility", "a11y", "wcag", "screen-reader", "screen-readers", "compliance",
    "standards", "specifications", "specs", "requirements", "documentation", "proposals",
    "certifications", "certification", "credentials", "protocols",
}

TECHNICAL_ACTIONS: Set[str] = {
    "optimize", "optimized", "optimizing", "tunes", "tuned", "tuning", "refactor",
    "refactored", "refactoring", "scale", "scaled", "scaling", "benchmark", "benchmarked",
    "benchmarking", "profile", "profiled", "profiling", "parallelize", "parallelized",
    "parallelizing", "accelerate", "accelerated", "accelerating", "compress", "compressed",
    "compressing", "deploy", "deployed", "deploying", "engineer", "engineered", "engineering",
    "automate", "automated", "automating", "reduce", "reduced", "reducing", "boost",
    "boosted", "boosting", "overhaul", "overhauled", "overhauling", "debug", "debugged",
    "debugging", "develop", "developed", "developing", "build", "built", "building",
    "design", "designed", "designing", "implement", "implemented", "implementing",
    "author", "authored", "authoring", "ship", "shipped", "shipping", "deliver",
    "delivered", "delivering", "maintain", "maintained", "maintaining", "contribute",
    "contributed", "contributing", "modernize", "modernized", "modernizing", "certify",
    "certified", "certifying",
}

SKILL_AND_COMPETENCY_NOUNS: Set[str] = {
    "background", "proficiency", "expertise", "skill", "skills", "problem-solving",
    "problem", "problems", "analytical", "acumen", "knowledge", "competency",
    "competencies", "understanding", "mastery", "ability", "abilities", "contributor",
    "contributions", "presentation", "presentations",
}

STRATEGY_AND_BUSINESS_OBJECTS: Set[str] = {
    "strategy", "strategies", "approach", "approaches", "timeline", "timelines",
    "roadmap", "roadmaps", "schedule", "schedules", "growth", "expansion", "market",
    "markets", "sales", "revenue", "pricing", "cost", "costs", "budget", "budgets",
    "goal", "goals", "target", "targets", "benchmark", "benchmarks", "metric",
    "metrics", "kpi", "kpis", "plan", "plans", "campaign", "campaigns", "acquisition",
    "acquisitions", "positioning", "competitor", "competitors", "analysis", "compensation",
    "salary", "benefits", "programming", "contract", "contracts", "vendor", "vendors",
}

INTERPERSONAL_TARGETS: Set[str] = {
    "teammate", "teammates", "colleague", "colleagues", "peer", "peers", "coworker",
    "coworkers", "subordinate", "subordinates", "manager", "managers", "supervisor",
    "supervisors", "staff", "employee", "employees", "people", "person", "customer",
    "customers", "client", "clients", "stakeholder", "stakeholders", "report",
    "reports", "direct reports", "partner", "partners",
}

BEHAVIORAL_CONDUCT_WORDS: Set[str] = {
    "behavior", "behaviors", "language", "words", "tone", "criticism", "criticizing",
    "criticized", "berating", "shouting", "yelling", "screaming", "arguing", "argued",
    "arguments", "insulting", "demeaning", "belittling", "interrupting", "interrupted",
    "confrontation", "confrontational", "demeanor towards", "attitude toward", "temper",
    "outburst", "outbursts", "harsh", "conduct", "combative", "hostile", "hostility",
}

CAREER_CONTINUITY_TOKENS: Set[str] = {
    "certification", "certifications", "certified", "upskilling", "learning", "research",
    "consulting", "completed", "published", "returned", "returning", "restart",
    "portfolio", "independent",
}


# --- Morphological Matcher Compilation ---
class CompiledVariant:
    def __init__(self, form: str, pattern: re.Pattern, word_count: int, entry: Dict[str, Any]):
        self.form = form
        self.pattern = pattern
        self.word_count = word_count
        self.entry = entry


def _compile_variants() -> List[CompiledVariant]:
    compiled: List[CompiledVariant] = []
    for entry in EXPANDED_TAXONOMY:
        for var in entry.get("variants", []):
            form = var["form"].strip()
            word_count = len(re.split(r"[\s-]+", form))
            escaped = re.escape(form).replace(r"\-", r"[\s-]")
            pattern = re.compile(rf"\b{escaped}\b", re.IGNORECASE)
            compiled.append(CompiledVariant(form, pattern, word_count, entry))

    # Longest multiword expressions first
    compiled.sort(key=lambda x: (x.word_count, len(x.form)), reverse=True)
    return compiled


COMPILED_VARIANTS = _compile_variants()


def tokenize(text: str) -> List[str]:
    cleaned = re.sub(r"[^a-zA-Z0-9+#-]", " ", text.lower())
    return [t for t in cleaned.split() if t]


def extract_sentences(text: str) -> List[Tuple[str, int, int]]:
    """Splits text into sentences while retaining exact character offsets within the document."""
    if not text:
        return []
    sentences = []
    pattern = re.compile(r"[^.!?\n]+(?:[.!?]+|$)", re.MULTILINE)
    for match in pattern.finditer(text):
        raw = match.group()
        trimmed = raw.strip()
        if trimmed:
            offset = match.start() + raw.find(trimmed)
            sentences.append((trimmed, offset, offset + len(trimmed)))
    return sentences


class CandidateMatch:
    def __init__(
        self,
        matched_text: str,
        category: BiasCategory,
        subcategory: str,
        severity: SeverityLevel,
        confidence: float,
        explanation: str,
        research_citation: str,
        replacement: str,
        start: int,
        end: int,
    ):
        self.matched_text = matched_text
        self.category = category
        self.subcategory = subcategory
        self.severity = severity
        self.confidence = confidence
        self.explanation = explanation
        self.research_citation = research_citation
        self.replacement = replacement
        self.start = start
        self.end = end


def scan_candidates(text: str) -> List[CandidateMatch]:
    matches: List[CandidateMatch] = []
    occupied_spans: List[Tuple[int, int]] = []

    for item in COMPILED_VARIANTS:
        for m in item.pattern.finditer(text):
            start = m.start()
            end = m.end()
            # Avoid overlaps
            overlaps = any(max(start, o_start) < min(end, o_end) for o_start, o_end in occupied_spans)
            if not overlaps:
                cat = CATEGORY_MAP.get(item.entry["category"], BiasCategory.PERSONALITY_BEHAVIORAL)
                sev = SEVERITY_MAP.get(item.entry.get("defaultSeverity", "medium"), SeverityLevel.MEDIUM)
                matches.append(CandidateMatch(
                    matched_text=m.group(),
                    category=cat,
                    subcategory=item.entry.get("subcategory", "general"),
                    severity=sev,
                    confidence=item.entry.get("confidence", 0.90),
                    explanation=item.entry.get("explanation", ""),
                    research_citation=item.entry.get("researchCitation", ""),
                    replacement=item.entry.get("replacement", "objective phrasing"),
                    start=start,
                    end=end,
                ))
                occupied_spans.append((start, end))

    # 2. Graduation dates older than 10-15 years (e.g. 1950 - 2015)
    grad_pattern = re.compile(r"\b(?:19[5-9]\d|200\d|201[0-5])\b")
    for m in grad_pattern.finditer(text):
        start = m.start()
        end = m.end()
        overlaps = any(max(start, o_start) < min(end, o_end) for o_start, o_end in occupied_spans)
        if not overlaps:
            matches.append(CandidateMatch(
                matched_text=m.group(),
                category=BiasCategory.AGE_INDICATIVE,
                subcategory="graduation_year_proxy",
                severity=SeverityLevel.MEDIUM,
                confidence=0.95,
                explanation="Listing graduation dates older than 10-15 years operates as an age proxy in automated candidate screening.",
                research_citation="EEOC ADEA Guidance & Neumark et al. (2019)",
                replacement="Remove graduation year",
                start=start,
                end=end,
            ))
            occupied_spans.append((start, end))

    matches.sort(key=lambda x: x.start)
    return matches


@functools.lru_cache(maxsize=4096)
def _classify_sentence_uncached(trimmed: str) -> ClassifiedSentence:
    start = 0
    end = len(trimmed)
    if not trimmed:
        return ClassifiedSentence(
            sentence="",
            keyword_match=[],
            classification="Fine",
            confidence=1.0,
            explanation="Sentence is empty or contains only whitespace.",
            contextType="empty",
            start=start,
            end=end,
        )

    lower = trimmed.lower()
    tokens = tokenize(trimmed)
    token_set = set(tokens)

    # Stage 2: Candidate detection
    candidates = scan_candidates(trimmed)
    if not candidates:
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=[],
            classification="Fine",
            confidence=0.95,
            explanation="No bias-related candidate keywords were detected in the sentence; language appears neutral and job-relevant.",
            contextType="neutral_no_keywords",
            start=start,
            end=end,
        )

    matched_keywords = list(dict.fromkeys(c.matched_text for c in candidates))

    # Stage 3: Syntactic flags
    has_tech_obj = any(t in TECHNICAL_OBJECTS for t in token_set)
    has_tech_act = any(t in TECHNICAL_ACTIONS for t in token_set)
    has_skill_noun = any(t in SKILL_AND_COMPETENCY_NOUNS for t in token_set)
    has_strat_obj = any(t in STRATEGY_AND_BUSINESS_OBJECTS for t in token_set)
    has_interpersonal = any(t in INTERPERSONAL_TARGETS for t in token_set)
    has_behavioral = any(t in BEHAVIORAL_CONDUCT_WORDS for t in token_set)
    has_career_cont = any(t in CAREER_CONTINUITY_TOKENS for t in token_set)

    has_hiring_pref = any(k in lower for k in [
        "prefer", "prefers", "preference", "seeking", "looking for",
        "must be", "required to be", "ideal candidate is",
    ])

    has_deficit = any(k in lower for k in [
        "less committed", "lack of commitment", "not committed", "uncommitted",
        "out of date", "outdated", "unreliable", "excessive supervision", "burden", "liability",
    ])

    # Rule 1: Explicit Hiring Preference on Protected / Sensitive Characteristics
    if has_hiring_pref:
        age_gender_health = [
            c for c in candidates
            if c.category in (BiasCategory.AGE_INDICATIVE, BiasCategory.GENDER_CODED, BiasCategory.DISABILITY_CODED, BiasCategory.PRESTIGE_PROXY)
        ]
        if age_gender_health:
            terms = " and ".join(f"'{c.matched_text}'" for c in age_gender_health)
            return ClassifiedSentence(
                sentence=trimmed,
                keyword_match=matched_keywords,
                classification="Flagged",
                confidence=0.96,
                explanation=f"The sentence explicitly expresses a hiring preference for {terms}, introducing an unlawful or discriminatory screening criterion under EEOC/ADEA guidelines.",
                contextType="explicit_hiring_preference",
                start=start,
                end=end,
            )

    # Rule 2: Explicit Negative Inference or Deficit Framing
    if has_deficit:
        gap_or_disability = [
            c for c in candidates
            if c.category in (BiasCategory.GAP_FRAMING, BiasCategory.DISABILITY_CODED)
            or any(w in c.matched_text.lower() for w in ["career break", "employment gap", "disability"])
        ]
        if gap_or_disability:
            terms = " and ".join(f"'{c.matched_text}'" for c in gap_or_disability)
            return ClassifiedSentence(
                sentence=trimmed,
                keyword_match=matched_keywords,
                classification="Flagged",
                confidence=0.95,
                explanation=f"The sentence explicitly uses {terms} to infer reduced professional commitment or capability, creating an unfair and discriminatory deficit assumption.",
                contextType="negative_deficit_inference",
                start=start,
                end=end,
            )

    # Rule 3: Protected Demographic & Health Proxies
    proxies = [
        "digital native", "clean bill of health", "differently abled", "differently-abled",
        "rockstar", "ninja", "10x engineer", "over 25 years of experience", "seasoned veteran",
    ]
    proxy_cand = next((c for c in candidates if any(p in c.matched_text.lower() for p in proxies) or c.category == BiasCategory.PRESTIGE_PROXY), None)
    if proxy_cand:
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Flagged",
            confidence=0.94,
            explanation=f"The phrase '{proxy_cand.matched_text}' functions as an overt proxy for protected characteristics (such as age, physical health status, or elitist pedigree), introducing disparate screening barriers.",
            contextType="protected_demographic_proxy",
            start=start,
            end=end,
        )

    # Rule 4: Subjective Behavioral Assertions and Interpersonal Conflict
    conflict_terms = ["difficult personality", "hard to work with", "not a team player"]
    conflict_cand = next((c for c in candidates if any(ct in c.matched_text.lower() for ct in conflict_terms)), None)
    if conflict_cand:
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Flagged",
            confidence=0.93,
            explanation=f"Contains unsubstantiated subjective behavioral assertions ('{conflict_cand.matched_text}') that introduce personality conflict bias rather than objective, documented performance metrics.",
            contextType="subjective_behavioral_assertion",
            start=start,
            end=end,
        )

    # Rule 5: Culture Fit & Affinity Screening Proxies
    culture_terms = ["culture fit", "cultural fit", "personality fit", "team fit"]
    culture_cand = next((c for c in candidates if any(cf in c.matched_text.lower() for cf in culture_terms)), None)
    if culture_cand:
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Flagged",
            confidence=0.91,
            explanation=f"Evaluating candidates based on '{culture_cand.matched_text}' introduces an unstandardized affinity proxy that frequently reproduces demographic homogeneity and unconscious bias.",
            contextType="culture_fit_affinity_proxy",
            start=start,
            end=end,
        )

    # Rule 6: Interpersonal Conduct Targeting People
    if has_interpersonal and (has_behavioral or any(k in lower for k in ["criticiz", "shout", "language"])):
        behavioral_words = ["aggressive", "combative", "hostile", "confrontational"]
        b_cand = next((c for c in candidates if any(bw in c.matched_text.lower() for bw in behavioral_words)), None)
        if b_cand:
            return ClassifiedSentence(
                sentence=trimmed,
                keyword_match=matched_keywords,
                classification="Flagged",
                confidence=0.92,
                explanation=f"The word '{b_cand.matched_text}' characterizes interpersonal communication directed at coworkers; unsubstantiated negative behavioral characterizations warrant review to verify objective evidence.",
                contextType="interpersonal_conduct_risk",
                start=start,
                end=end,
            )

    # Rule 7: Ambiguous Leadership Style, Management Demeanor, or Subjective Personality Judgment
    has_subjective_style_or_role = any(
        w in lower for w in [
            "leadership", "management", "style", "attitude", "personality",
            "temperament", "demeanor", "communication", "manager", "developer",
            "engineer", "leader", "candidate"
        ]
    )
    agentic_cand = next(
        (c for c in candidates if any(k in c.matched_text.lower() for k in ["aggressive", "dominant", "controlling", "forceful", "combative"])),
        None
    )
    if agentic_cand and has_subjective_style_or_role and not has_tech_obj and not has_tech_act and not has_strat_obj:
        phrase_text = f"'{agentic_cand.matched_text}'" if "style" in agentic_cand.matched_text.lower() else f"'{agentic_cand.matched_text} leadership style'"
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Flagged",
            confidence=0.90,
            explanation=f"The phrase {phrase_text} represents a subjective personality judgment relevant to hiring that can reflect gender-coded stereotypes. Although the immediate sentence context is insufficient to establish whether the judgment is unfair, subjective personality labels without objective metrics represent an unstandardized screening risk.",
            contextType="subjective_leadership_style",
            start=start,
            end=end,
        )
# Rule 8: Technical Accessibility Feature for Disabled Users
    is_a11y_feature = (
        any(k in lower for k in ["accessibility", "accommodation", "wcag", "screen-reader"])
        and any(t in token_set for t in ["application", "developed", "built", "improves", "implemented", "features", "supported", "software"])
    )
    if is_a11y_feature:
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Fine",
            confidence=0.96,
            explanation="The sentence describes an engineering contribution building digital accessibility features for people with disabilities, representing a legitimate technical deliverable rather than a discriminatory assumption.",
            contextType="technical_accessibility_contribution",
            start=start,
            end=end,
        )

    # Rule 9: Technical Achievement, Engineering Action, or Software Performance Optimization
    if (has_tech_obj or has_tech_act) and not has_interpersonal and not has_hiring_pref:
        young_cand = next((c for c in candidates if c.matched_text.lower() == "young"), None)
        if young_cand:
            return ClassifiedSentence(
                sentence=trimmed,
                keyword_match=matched_keywords,
                classification="Fine",
                confidence=0.92,
                explanation="The word 'young' is used descriptively to modify the engineer within a technical achievement sentence ('developed a distributed system'). It does not establish an employer screening restriction or hiring preference.",
                contextType="descriptive_age_achievement",
                start=start,
                end=end,
            )

        tech_cand = candidates[0]
        matched_obj = next((t for t in tokens if t in TECHNICAL_OBJECTS), "technical system")
        matched_act = next((t for t in tokens if t in TECHNICAL_ACTIONS), "optimization")
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Fine",
            confidence=0.96,
            explanation=f"The word '{tech_cand.matched_text}' describes a technical achievement ({matched_act} on {matched_obj}) rather than interpersonal conduct or demographic stereotyping.",
            contextType="technical_achievement",
            start=start,
            end=end,
        )

    # Rule 10: Technical Skills, Competencies, and Inanimate Architecture
    if has_skill_noun or "architecture" in token_set or "framework" in token_set:
        skill_cand = next((c for c in candidates if c.matched_text.lower() in ("strong", "flexible", "adaptable")), None)
        if skill_cand:
            target = next((t for t in tokens if t in SKILL_AND_COMPETENCY_NOUNS), "technical architecture")
            return ClassifiedSentence(
                sentence=trimmed,
                keyword_match=matched_keywords,
                classification="Fine",
                confidence=0.95,
                explanation=f"The word '{skill_cand.matched_text}' describes technical proficiency and competency depth ({target}) rather than an agentic gender stereotype.",
                contextType="technical_competency_depth",
                start=start,
                end=end,
            )

    # Rule 11: Inanimate Business Strategy / Competitive Market Analysis
    if has_strat_obj and not has_interpersonal:
        strat_obj = next((t for t in tokens if t in STRATEGY_AND_BUSINESS_OBJECTS), "business strategy")
        strat_cand = candidates[0]
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Fine",
            confidence=0.95,
            explanation=f"The word '{strat_cand.matched_text}' qualifies an inanimate operational strategy ({strat_obj}) rather than personal interpersonal behavior or discriminatory bias.",
            contextType="inanimate_business_strategy",
            start=start,
            end=end,
        )

    # Rule 11B: Commercial Client Relationship & Account Leadership
    client_words = {"client", "clients", "accounts", "contract", "contracts", "renewals"}
    metric_words = {"renewals", "increase", "generated", "revenue", "growth"}
    if any(cw in token_set for cw in client_words) and any(mw in token_set for mw in metric_words):
        comm_cand = candidates[0]
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Fine",
            confidence=0.94,
            explanation=f"The term '{comm_cand.matched_text}' describes professional commercial relationship management and client account leadership accompanied by verifiable business metrics, rather than a gendered stereotype.",
            contextType="commercial_account_leadership",
            start=start,
            end=end,
        )

    # Rule 12: Constructive Career Gap with Upskilling / Education
    if ("career break" in lower or "employment gap" in lower) and has_career_cont:
        return ClassifiedSentence(
            sentence=trimmed,
            keyword_match=matched_keywords,
            classification="Fine",
            confidence=0.94,
            explanation="The career break is contextually accompanied by active professional upskilling, education, or certification without negative inferences of diminished competence.",
            contextType="constructive_career_transition",
            start=start,
            end=end,
        )

    # Rule 13: Neutral/Harmless Qualification Mention
    # STRICT: Only applies to genuinely neutral qualification terms (experienced, strong, flexible, adaptable).
    safe_qual_terms = {"experienced", "strong", "stronger", "strongest", "flexible", "adaptable"}
    has_only_safe_qual = all(c.matched_text.lower() in safe_qual_terms for c in candidates)
    qualification_words = {"engineer", "developer", "analyst", "manager", "consultant", "specialist", "designer", "professional", "strategy", "skills", "experience"}
    if has_only_safe_qual and any(qw in token_set for qw in qualification_words):
        has_disc = any(c.category == BiasCategory.GENDER_CODED and c.matched_text in ("manly", "girly", "macho") for c in candidates)
        if not has_disc and not has_hiring_pref and not has_deficit:
            return ClassifiedSentence(
                sentence=trimmed,
                keyword_match=matched_keywords,
                classification="Fine",
                confidence=0.91,
                explanation=f"The terms [{', '.join(matched_keywords)}] describe legitimate professional qualifications and background without unfair assumptions.",
                contextType="neutral_professional_qualification",
                start=start,
                end=end,
            )

    # Fallback: Uncontextualized Sensitive Term
    primary_cand = candidates[0]
    return ClassifiedSentence(
        sentence=trimmed,
        keyword_match=matched_keywords,
        classification="Flagged",
        confidence=0.85,
        explanation=f"The term '{primary_cand.matched_text}' ({primary_cand.category.value}) appears without sufficient technical or objective context, posing a potential stereotyping or subjective screening risk.",
        contextType="uncontextualized_sensitive_term",
        start=start,
        end=end,
    )


def classify_sentence(sentence: str, start: int = 0, end: int = 0) -> ClassifiedSentence:
    """Classifies a single sentence strictly into 'Fine' or 'Flagged' with LRU caching."""
    trimmed = sentence.strip()
    if not trimmed:
        return ClassifiedSentence(
            sentence="",
            keyword_match=[],
            classification="Fine",
            confidence=1.0,
            explanation="Sentence is empty or contains only whitespace.",
            contextType="empty",
            start=start,
            end=end,
        )
    res = _classify_sentence_uncached(trimmed)
    if res.start == start and res.end == end:
        return res
    return ClassifiedSentence(
        sentence=res.sentence,
        keyword_match=res.keyword_match,
        classification=res.classification,
        confidence=res.confidence,
        explanation=res.explanation,
        contextType=res.contextType,
        start=start,
        end=end,
    )

def analyze_document_text(text: str, file_name: str = "document.txt") -> Tuple[
    List[BiasSpan],
    Dict[str, RewriteSuggestion],
    List[ClassifiedSentence],
    ContextSummary,
]:
    sentences_data = extract_sentences(text)
    spans: List[BiasSpan] = []
    suggestions: Dict[str, RewriteSuggestion] = {}
    classified_sentences: List[ClassifiedSentence] = []

    total_candidates = 0
    exonerated_count = 0
    span_idx = 1

    for sent_text, s_start, s_end in sentences_data:
        c_sent = classify_sentence(sent_text, s_start, s_end)
        classified_sentences.append(c_sent)

        cands = scan_candidates(sent_text)
        total_candidates += len(cands)

        if c_sent.classification == "Fine":
            exonerated_count += len(cands)
        else:
            for cand in cands:
                span_id = f"span-{span_idx:03d}"
                span_idx += 1

                abs_start = s_start + cand.start
                abs_end = s_start + cand.end

                spans.append(BiasSpan(
                    id=span_id,
                    start=abs_start,
                    end=abs_end,
                    matched_text=cand.matched_text,
                    category=cand.category,
                    subcategory=cand.subcategory,
                    severity=cand.severity,
                    confidence=cand.confidence,
                    explanation=cand.explanation or c_sent.explanation,
                    research_citation=cand.research_citation,
                    classification="Flagged",
                    sentence=sent_text,
                    sentence_start=s_start,
                    sentence_end=s_end,
                    context_type=cand.category.value,
                ))

                suggestions[span_id] = RewriteSuggestion(
                    span_id=span_id,
                    original_text=cand.matched_text,
                    suggested_text=cand.replacement,
                    rationale=cand.explanation,
                )

    context_summary = ContextSummary(
        total_sentences=len(sentences_data),
        flagged_sentences=sum(1 for s in classified_sentences if s.classification == "Flagged"),
        fine_sentences=sum(1 for s in classified_sentences if s.classification == "Fine"),
        candidate_keywords_detected=total_candidates,
        exonerated_keywords=exonerated_count,
    )

    return spans, suggestions, classified_sentences, context_summary
