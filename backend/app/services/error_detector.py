import re
from typing import List, Tuple
from ..schemas import ResumeErrorFlag, ResumeErrorType, QualityMetrics, SeverityLevel
from .context_detector import extract_sentences

# 1. Passive Voice Patterns
PASSIVE_PATTERNS = [
    (r"\bwas responsible for\b", "Spearheaded", "Avoid passive responsibility phrasing; use an active leadership verb like 'Spearheaded' or 'Directed'."),
    (r"\bduties included\b", "Executed", "Resume screeners favor direct action over formal job duty listings; start directly with the accomplishment."),
    (r"\btasks involved\b", "Delivered", "Emphasize what you delivered rather than the tasks assigned to you."),
    (r"\bwas tasked with\b", "Appointed to engineer", "Active phrasing demonstrates initiative and ownership."),
    (r"\bwas assigned to\b", "Selected to lead", "Frames the opportunity as recognition of your capability."),
    (r"\bwere developed by\b", "Developed", "Passive agent construction; place the candidate/team in the active subject position."),
    (r"\bwas handled by\b", "Managed", "State your management contribution directly."),
]

# 2. Weak Action Verb Patterns
WEAK_VERB_PATTERNS = [
    (r"\bworked on\b", "Architected / Engineered", "Replace vague participation ('worked on') with your specific technical role ('Architected', 'Engineered', 'Spearheaded')."),
    (r"\bhelped with\b", "Facilitated / Accelerated", "Specify your exact contribution rather than passive assistance."),
    (r"\bassisted in\b", "Co-engineered / Contributed to", "Highlight the collaborative technical scope rather than subordination."),
    (r"\bassisted with\b", "Coordinated / Built", "Use active achievement verbs to articulate your role."),
    (r"\bparticipated in\b", "Collaborated on", "Highlight active collaborative engineering deliverables."),
    (r"\bhandled\b", "Administered / Orchestrated", "Demonstrate systematic ownership rather than reactive handling."),
    (r"\btried to\b", "Initiated", "Focus on technical initiatives and measurable outcomes achieved."),
]

# 3. Buzzwords & Clichés
BUZZWORD_PATTERNS = [
    (r"\bdetail-oriented\b", "Precise / Quality-focused", "Subjective buzzword; replace with evidence of rigorous QA, testing coverage, or zero-defect deployments."),
    (r"\bhard worker\b", "High-throughput contributor", "Cliché phrasing that ATS filters and recruiters discount; demonstrate with delivery velocity."),
    (r"\bgo-getter\b", "Proactive problem solver", "Informal cliché; replace with demonstrated leadership or independent project delivery."),
    (r"\bself-starter\b", "Self-directed specialist", "Substantiate self-direction with specific projects initiated and scaled."),
    (r"\bteam player\b", "Cross-functional collaborator", "Overused generic claim; state which teams you collaborated with (e.g., 'Product, Design, and DevOps')."),
    (r"\bthink outside the box\b", "Innovative / First-principles", "Cliché metaphor; explain the innovative solution or patented approach directly."),
    (r"\bfast learner\b", "Adaptable domain specialist", "Demonstrate learning agility through rapid technology adoption or new domain certifications."),
]

# 4. Profanity & Inappropriate Language (Fatal Resume Errors)
PROFANITY_PATTERNS = [
    (r"\b(?:fuck(?:ing|ed|er|s)?)\b", "High-impact", "Vulgarity/Profanity detected. Profanity is strictly disqualified by corporate ATS parsers and human recruiters.", SeverityLevel.HIGH),
    (r"\b(?:shit(?:ty|ting|s)?)\b", "Substandard / Legacy", "Profanity detected. Inappropriate for professional documentation.", SeverityLevel.HIGH),
    (r"\b(?:damn(?:ed)?)\b", "Substantial / Remarkable", "Profanity detected. Replace with an objective professional descriptor.", SeverityLevel.HIGH),
    (r"\b(?:bitch(?:ing|es)?)\b", "Remove", "Profanity detected. Unacceptable in candidate documentation.", SeverityLevel.HIGH),
    (r"\b(?:crap(?:py)?)\b", "Suboptimal / Deficient", "Informal vulgar slang; replace with precise engineering terminology.", SeverityLevel.HIGH),
    (r"\b(?:ass(?:hole|holes)?)\b", "Remove", "Profanity detected; remove immediately.", SeverityLevel.HIGH),
    (r"\b(?:badass(?:es)?)\b", "High-performing / Exceptional", "Informal slang; replace with professional competency descriptors.", SeverityLevel.HIGH),
    (r"\b(?:bastard(?:s)?)\b", "Remove", "Profanity detected; remove immediately.", SeverityLevel.HIGH),
    (r"\b(?:a hell of a|to hell|what the hell)\b", "A remarkable / Substantial", "Inappropriate conversational slang for a professional resume.", SeverityLevel.HIGH),
    (r"\b(?:pissed(?: off)?)\b", "Dissatisfied", "Unprofessional language; replace with formal corporate phrasing.", SeverityLevel.HIGH),
    (r"\b(?:bullshit)\b", "Inaccuracies / Discrepancies", "Profanity detected; replace with objective technical terminology.", SeverityLevel.HIGH),
]

# 5. Unprofessional Slang & Colloquialisms
SLANG_PATTERNS = [
    (r"\bgonna\b", "Scheduled to / Planning to", "Casual contraction; use formal business phrasing.", SeverityLevel.MEDIUM),
    (r"\bwanna\b", "Aspiring to / Aiming to", "Casual contraction; use standard professional verbs.", SeverityLevel.MEDIUM),
    (r"\bgotta\b", "Required to / Mandated to", "Informal slang; use formal active phrasing.", SeverityLevel.MEDIUM),
    (r"\bdunno\b", "Under evaluation", "Conversational slang; inappropriate for a professional resume.", SeverityLevel.MEDIUM),
    (r"\b(?:kinda|sorta)\b", "Partially / Approximately", "Vague conversational slang; be precise about technical scope.", SeverityLevel.MEDIUM),
    (r"\b(?:lol|lmao|rofl|omg)\b", "Remove internet acronym", "Social media acronyms are prohibited in professional resumes.", SeverityLevel.HIGH),
    (r"\b(?:lots of|a lot of)\b", "Numerous / Substantial", "Colloquial quantifier; replace with specific metrics or formal terms.", SeverityLevel.MEDIUM),
    (r"\ba bunch of\b", "Multiple / A suite of", "Informal phrasing; replace with specific technical deliverables.", SeverityLevel.MEDIUM),
    (r"\bstuff\b", "Deliverables / Components", "Vague placeholder noun; specify exact technologies, tools, or deliverables.", SeverityLevel.MEDIUM),
    (r"\bthings\b", "Systems / Assets", "Vague noun; replace with specific domain deliverables.", SeverityLevel.LOW),
    (r"\bcool\b", "Innovative / State-of-the-art", "Informal adjective; use technical descriptors.", SeverityLevel.LOW),
    (r"\b(?:super good|super fast)\b", "High-performance / Optimized", "Informal modifier; substantiate with specific benchmark metrics.", SeverityLevel.MEDIUM),
    (r"\b(?:freaking|freakin)\b", "Significantly / Considerably", "Informal intensifier; remove or replace with quantified impact.", SeverityLevel.HIGH),
    (r"\bhella\b", "Exceptionally / Highly", "Informal regional slang; use standard business language.", SeverityLevel.HIGH),
]

# 6. First-Person Pronouns (Strict Resume Standard: Implied Third Person)
FIRST_PERSON_PATTERNS = [
    (r"\bI\s+(?:am|was)\b", "Remove 'I am'", "Avoid first-person state-of-being phrases ('I am', 'I was'). Resumes should start directly with strong action verbs or professional titles.", SeverityLevel.MEDIUM),
    (r"\bI\s+(worked|built|led|managed|developed|created|designed|implemented|spearheaded|architected|engineered|analyzed|wrote|have)\b",
     r"\1", "Resumes must use implied third-person phrasing with direct action verbs. Remove 'I' and capitalize the action verb.", SeverityLevel.MEDIUM),
    (r"\bI\b", "Remove 'I'", "Industry standard (Harvard, Wharton, ATS) mandates omitting 'I'. Start sentences directly with active verbs.", SeverityLevel.MEDIUM),
    (r"\bmy\b", "the / corporate", "Avoid first-person possessives. Replace with 'the', 'project', or organizational scope.", SeverityLevel.LOW),
    (r"\bme\b", "the engineer / the team", "Avoid first-person pronouns; frame achievements around deliverables.", SeverityLevel.LOW),
    (r"\bmyself\b", "independently", "Replace first-person reflexive pronouns with active descriptive adverbs.", SeverityLevel.LOW),
    (r"\bwe\s+(built|created|developed|designed|implemented|managed|spearheaded|architected|shipped)\b",
     r"Co-\1", "Highlight personal technical contribution or use 'Co-developed / Co-engineered' rather than ambiguous 'we'.", SeverityLevel.LOW),
    (r"\b(?:we|us|our)\b", "the team / collaborative", "Avoid ambiguous plural first-person pronouns; emphasize your individual contribution.", SeverityLevel.LOW),
]

# 7. Common Resume Typos & Misspellings
COMMON_TYPOS = {
    "manger": ("Manager", "Likely typo for 'Manager'. A misspelling in a job title severely degrades candidate credibility."),
    "experiance": ("Experience", "Common spelling error. Correct spelling is 'Experience'."),
    "responsable": ("Responsible", "Spelling error. Correct spelling is 'Responsible'."),
    "achive": ("Achieve", "Spelling error. Correct spelling is 'Achieve'."),
    "achived": ("Achieved", "Spelling error. Correct spelling is 'Achieved'."),
    "succesful": ("Successful", "Spelling error. Correct spelling is 'Successful'."),
    "succesfully": ("Successfully", "Spelling error. Correct spelling is 'Successfully'."),
    "recieve": ("Receive", "Spelling error ('i' before 'e' except after 'c'). Correct spelling is 'Receive'."),
    "recieved": ("Received", "Spelling error. Correct spelling is 'Received'."),
    "seperate": ("Separate", "Spelling error. Correct spelling is 'Separate'."),
    "proffesional": ("Professional", "Spelling error. Correct spelling is 'Professional'."),
    "enviroment": ("Environment", "Spelling error. Correct spelling is 'Environment'."),
    "definitly": ("Definitely", "Spelling error. Correct spelling is 'Definitely'."),
    "occured": ("Occurred", "Spelling error. Correct spelling is 'Occurred'."),
    "untill": ("Until", "Spelling error. Correct spelling is 'Until'."),
    "maintainance": ("Maintenance", "Spelling error. Correct spelling is 'Maintenance'."),
    "comunication": ("Communication", "Spelling error. Correct spelling is 'Communication'."),
    "collaberate": ("Collaborate", "Spelling error. Correct spelling is 'Collaborate'."),
    "implimented": ("Implemented", "Spelling error. Correct spelling is 'Implemented'."),
    "oppurtunity": ("Opportunity", "Spelling error. Correct spelling is 'Opportunity'."),
    "teh": ("the", "Typographical error for 'the'."),
}

# 8. Outdated Clichés & Wasteful Fillers
CLICHE_PATTERNS = [
    (r"\breferences\s+(?:available\s+)?upon\s+request\b", "Remove line", "Outdated 1990s resume artifact. Recruiters expect references later in the hiring loop; remove to save valuable resume space.", SeverityLevel.LOW),
    (r"\bseeking\s+a\s+challenging\s+position\b", "Replace with executive summary", "Generic objective statement; modern resumes use a targeted Executive Summary.", SeverityLevel.LOW),
    (r"\bobjective\s*:\s*to\s+obtain\s+a\b", "Replace with Professional Summary", "Objective statements are outdated; replace with a skills summary.", SeverityLevel.LOW),
]

# 9. Inappropriate Personal Details (Discriminatory Exposure)
PERSONAL_INFO_PATTERNS = [
    (r"\bmarital\s+status\s*[:\-]?\s*(?:single|married|divorced|widowed)?\b", "Remove line", "Personal marital status should never appear on modern resumes. Violates EEOC non-discrimination guidelines.", SeverityLevel.HIGH),
    (r"\b(?:date\s+of\s+birth|dob)\s*[:\-]\s*[0-9\/\-]+\b", "Remove date of birth", "Date of birth invites age discrimination (ADEA violation) and identity theft risks. Remove from resume.", SeverityLevel.HIGH),
    (r"\breligion\s*[:\-]\s*\w+\b", "Remove religious affiliation", "Religious affiliations should be excluded from professional resumes to prevent bias.", SeverityLevel.HIGH),
    (r"\bsalary\s+(?:expectation|requirements|history)\s*[:\-]?\s*[\$\w0-9\-,/ ]+\b", "Remove salary line", "Do not disclose salary requirements on your resume; negotiate during offer stages.", SeverityLevel.MEDIUM),
]

IMPACT_VERBS = [
    "increased", "decreased", "reduced", "improved", "accelerated", "boosted",
    "optimized", "saved", "maximized", "minimized", "streamlined", "generated"
]


def detect_resume_errors(text: str) -> Tuple[List[ResumeErrorFlag], QualityMetrics]:
    """
    Comprehensive multi-category resume quality and error scanner.
    Detects:
    1. Profanity & Vulgarity
    2. Unprofessional Slang & Internet acronyms
    3. First-Person Pronouns (I, me, my, we)
    4. Common Typographical & Spelling Errors
    5. Passive Voice Phrasing
    6. Weak Action Verbs
    7. Unquantified Impact Claims
    8. Overused Buzzwords & Empty Clichés
    9. Inappropriate Personal Details
    """
    sentences_data = extract_sentences(text)
    error_flags: List[ResumeErrorFlag] = []
    
    passive_count = 0
    weak_verb_count = 0
    unquantified_count = 0
    profanity_count = 0
    slang_count = 0
    first_person_count = 0
    spelling_count = 0
    total_bullets = 0
    quantified_count = 0
    
    flag_idx = 1
    
    # Global check for personal info and outdated clichés
    for pattern, suggestion, explanation, severity in PERSONAL_INFO_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            matched_str = text[match.start():match.end()]
            error_flags.append(ResumeErrorFlag(
                id=f"err-{flag_idx:03d}",
                error_type=ResumeErrorType.PERSONAL_INFO,
                sentence=matched_str,
                start=match.start(),
                end=match.end(),
                matched_text=matched_str,
                suggestion=suggestion,
                explanation=explanation,
                severity=severity
            ))
            flag_idx += 1

    for pattern, suggestion, explanation, severity in CLICHE_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            matched_str = text[match.start():match.end()]
            error_flags.append(ResumeErrorFlag(
                id=f"err-{flag_idx:03d}",
                error_type=ResumeErrorType.CLICHE,
                sentence=matched_str,
                start=match.start(),
                end=match.end(),
                matched_text=matched_str,
                suggestion=suggestion,
                explanation=explanation,
                severity=severity
            ))
            flag_idx += 1

    for sent_text, s_start, s_end in sentences_data:
        s_lower = sent_text.lower()
        is_bullet = bool(re.match(r"^[\s•\-*0-9.]+", sent_text)) or len(sent_text) > 20
        if is_bullet:
            total_bullets += 1

        occupied_spans: List[Tuple[int, int]] = []

        def overlaps(st: int, en: int) -> bool:
            for s, e in occupied_spans:
                if max(st, s) < min(en, e):
                    return True
            return False

        # 1. Profanity Check (FATAL)
        for pattern, suggestion, explanation, severity in PROFANITY_PATTERNS:
            for match in re.finditer(pattern, s_lower):
                if overlaps(match.start(), match.end()):
                    continue
                occupied_spans.append((match.start(), match.end()))
                profanity_count += 1
                matched_str = sent_text[match.start():match.end()]
                error_flags.append(ResumeErrorFlag(
                    id=f"err-{flag_idx:03d}",
                    error_type=ResumeErrorType.PROFANITY,
                    sentence=sent_text,
                    start=s_start + match.start(),
                    end=s_start + match.end(),
                    matched_text=matched_str,
                    suggestion=suggestion,
                    explanation=explanation,
                    severity=severity
                ))
                flag_idx += 1

        # 2. Slang & Informal Language
        for pattern, suggestion, explanation, severity in SLANG_PATTERNS:
            for match in re.finditer(pattern, s_lower):
                if overlaps(match.start(), match.end()):
                    continue
                occupied_spans.append((match.start(), match.end()))
                slang_count += 1
                matched_str = sent_text[match.start():match.end()]
                error_flags.append(ResumeErrorFlag(
                    id=f"err-{flag_idx:03d}",
                    error_type=ResumeErrorType.SLANG,
                    sentence=sent_text,
                    start=s_start + match.start(),
                    end=s_start + match.end(),
                    matched_text=matched_str,
                    suggestion=suggestion,
                    explanation=explanation,
                    severity=severity
                ))
                flag_idx += 1

        # 3. First-Person Pronouns
        for pattern, suggestion, explanation, severity in FIRST_PERSON_PATTERNS:
            for match in re.finditer(pattern, sent_text):
                if overlaps(match.start(), match.end()):
                    continue
                occupied_spans.append((match.start(), match.end()))
                first_person_count += 1
                matched_str = sent_text[match.start():match.end()]
                # Format smart replacement suggestion
                clean_sugg = suggestion
                if "\\" in suggestion:
                    clean_sugg = re.sub(pattern, suggestion, matched_str)
                    clean_sugg = clean_sugg.capitalize()

                error_flags.append(ResumeErrorFlag(
                    id=f"err-{flag_idx:03d}",
                    error_type=ResumeErrorType.FIRST_PERSON,
                    sentence=sent_text,
                    start=s_start + match.start(),
                    end=s_start + match.end(),
                    matched_text=matched_str,
                    suggestion=clean_sugg,
                    explanation=explanation,
                    severity=severity
                ))
                flag_idx += 1

        # 4. Common Typos & Spelling Mistakes
        for w_match in re.finditer(r"\b[A-Za-z]+\b", sent_text):
            w = w_match.group()
            w_lower = w.lower()
            if w_lower in COMMON_TYPOS:
                if overlaps(w_match.start(), w_match.end()):
                    continue
                occupied_spans.append((w_match.start(), w_match.end()))
                correct_word, explanation = COMMON_TYPOS[w_lower]
                if w.isupper():
                    correct_word = correct_word.upper()
                elif w[0].isupper():
                    correct_word = correct_word.capitalize()
                else:
                    correct_word = correct_word.lower()

                spelling_count += 1
                error_flags.append(ResumeErrorFlag(
                    id=f"err-{flag_idx:03d}",
                    error_type=ResumeErrorType.SPELLING,
                    sentence=sent_text,
                    start=s_start + w_match.start(),
                    end=s_start + w_match.end(),
                    matched_text=w,
                    suggestion=correct_word,
                    explanation=explanation,
                    severity=SeverityLevel.HIGH
                ))
                flag_idx += 1

        # 5. Passive Voice Check
        for pattern, suggestion, explanation in PASSIVE_PATTERNS:
            match = re.search(pattern, s_lower)
            if match:
                if overlaps(match.start(), match.end()):
                    continue
                occupied_spans.append((match.start(), match.end()))
                passive_count += 1
                matched_str = sent_text[match.start():match.end()]
                error_flags.append(ResumeErrorFlag(
                    id=f"err-{flag_idx:03d}",
                    error_type=ResumeErrorType.PASSIVE_VOICE,
                    sentence=sent_text,
                    start=s_start + match.start(),
                    end=s_start + match.end(),
                    matched_text=matched_str,
                    suggestion=suggestion,
                    explanation=explanation,
                    severity=SeverityLevel.HIGH
                ))
                flag_idx += 1
                break

        # 6. Weak Verb Check
        for pattern, suggestion, explanation in WEAK_VERB_PATTERNS:
            match = re.search(pattern, s_lower)
            if match:
                if overlaps(match.start(), match.end()):
                    continue
                occupied_spans.append((match.start(), match.end()))
                weak_verb_count += 1
                matched_str = sent_text[match.start():match.end()]
                error_flags.append(ResumeErrorFlag(
                    id=f"err-{flag_idx:03d}",
                    error_type=ResumeErrorType.WEAK_VERB,
                    sentence=sent_text,
                    start=s_start + match.start(),
                    end=s_start + match.end(),
                    matched_text=matched_str,
                    suggestion=suggestion,
                    explanation=explanation,
                    severity=SeverityLevel.MEDIUM
                ))
                flag_idx += 1
                break

        # 7. Buzzword / Cliché Check
        for pattern, suggestion, explanation in BUZZWORD_PATTERNS:
            match = re.search(pattern, s_lower)
            if match:
                if overlaps(match.start(), match.end()):
                    continue
                occupied_spans.append((match.start(), match.end()))
                matched_str = sent_text[match.start():match.end()]
                error_flags.append(ResumeErrorFlag(
                    id=f"err-{flag_idx:03d}",
                    error_type=ResumeErrorType.BUZZWORD_CLICHE,
                    sentence=sent_text,
                    start=s_start + match.start(),
                    end=s_start + match.end(),
                    matched_text=matched_str,
                    suggestion=suggestion,
                    explanation=explanation,
                    severity=SeverityLevel.LOW
                ))
                flag_idx += 1
                break

        # 8. Quantification & Impact Check
        has_numbers = bool(
            re.search(
                r"\b\d+(?:\.\d+)?%?|\$\d+|\b\d+\s*(?:ms|sec|hours|days|x|k|m|users|engineers|sla)\b",
                s_lower,
            )
        )
        has_impact_claim = any(re.search(r"\b" + iv + r"\b", s_lower) for iv in IMPACT_VERBS)

        if has_numbers:
            quantified_count += 1
        elif has_impact_claim:
            unquantified_count += 1
            error_flags.append(ResumeErrorFlag(
                id=f"err-{flag_idx:03d}",
                error_type=ResumeErrorType.UNQUANTIFIED_IMPACT,
                sentence=sent_text,
                start=s_start,
                end=s_end,
                matched_text=sent_text[:40] + ("..." if len(sent_text) > 40 else ""),
                suggestion="Add quantifiable metric (e.g. 'by 40%', 'saving $25k', 'under 150ms')",
                explanation="This sentence claims an improvement without a metric. The Google XYZ formula ('Accomplished [X] measured by [Y] by doing [Z]') scores 3x higher with recruiters.",
                severity=SeverityLevel.MEDIUM,
            ))
            flag_idx += 1

    # Quality Scores (0 - 100)
    action_verb_score = max(10, int(100 - (weak_verb_count * 12) - (passive_count * 15) - (first_person_count * 10)))

    if total_bullets > 0:
        quantification_score = min(100, max(20, int((quantified_count / total_bullets) * 100)))
    else:
        quantification_score = 70 if quantified_count > 0 else 45

    # ATS Readability deductions include profanity, slang, spelling errors
    ats_deductions = (
        (profanity_count * 35) +
        (spelling_count * 15) +
        (slang_count * 10) +
        (first_person_count * 8) +
        (passive_count * 6) +
        (weak_verb_count * 4) +
        (unquantified_count * 4)
    )
    ats_readability_score = max(10, min(100, 100 - ats_deductions))

    metrics = QualityMetrics(
        action_verb_score=action_verb_score,
        quantification_score=quantification_score,
        passive_voice_count=passive_count,
        weak_verb_count=weak_verb_count,
        unquantified_bullet_count=unquantified_count,
        total_bullet_count=total_bullets,
        ats_readability_score=ats_readability_score,
        profanity_count=profanity_count,
        slang_count=slang_count,
        first_person_count=first_person_count,
        spelling_error_count=spelling_count
    )

    return error_flags, metrics
