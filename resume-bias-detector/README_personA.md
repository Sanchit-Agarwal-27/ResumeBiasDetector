# Person A — Data & Detection Core (NLP Engine)

Status: ~85% complete. Core pipeline runs end-to-end on real data.

## What this delivers

One function, `analyze_resume(text)` in `bias_detector.py`, that takes raw
resume text and returns a structured bias report. This is the only thing
Person B and Person C need to import and call.

```python
from bias_detector import analyze_resume, load_lexicon

lexicon = load_lexicon()
report = analyze_resume(resume_text, lexicon, run_contextual=False)
```

Set `run_contextual=True` to also run the transformer-based contextual pass
(slower — downloads a ~1.6GB model on first use, needs `transformers`+`torch`).

## Output contract (final — B and C should build against this)

```json
{
  "text_length": 190,
  "flags": [
    {
      "category": "gender_coded.masculine_coded",
      "span": "aggressive",
      "start": 59,
      "end": 69,
      "severity": 1-3,
      "source": "lexicon" | "contextual" | "ner",
      "explanation": "...",
      "occurrences": 1,
      "positions": [{"start": 59, "end": 69}]
    }
  ],
  "entities": {
    "names": [...],
    "orgs": [...],
    "dates": [...],
    "education_years": [...]
  }
}
```

- **Person B** (rewrite suggestions / fairness metrics): loop over `flags`,
  use `category` + `span` to generate a neutral rewrite per flag. If a flag
  has `occurrences > 1`, loop `positions` to rewrite every instance, not
  just the first.
- **Person C** (UI): use `flags` to highlight spans in the resume text via
  `start`/`end` (or `positions` for repeated terms). `entities` is available
  but not required for the core UI — see known limitations below.

## What's done and verified

- **Lexicon-based detection** (`lexicon_scan`) — taxonomy covers gender
  (masculine/feminine, split into severe + mild severity), age-coded
  language, ability-coded language, prestige bias, and gap-negative
  framing. Validated against 100 real resumes from the Kaggle "Resume
  Dataset" (Snehaan Bhawal).
- **Graduation-year detection** — sentence-scoped, only flags years that
  appear alongside an actual education keyword (degree, university,
  graduated, etc.), so ordinary work-history date ranges (e.g. "2001-2004")
  are correctly ignored.
- **Deduplication** — repeated identical flags collapse into one entry with
  an `occurrences` count and full `positions` list.
- **Contextual pass** (`contextual_scan`) — uses zero-shot classification
  (facebook/bart-large-mnli) to catch tone/implication the keyword list
  misses. Confirmed working end-to-end on GPU. Segments resume text by line
  (not sentence punctuation) since resumes are bullet-structured, not prose.
- **Entity extraction** (`ner_scan`) — spaCy-based, whitespace-normalized
  before tagging to reduce noise from PDF-extraction artifacts.

## Known limitations (worth stating explicitly in the Phase 7 write-up)

1. **RESOLVED: `ability_coded`, `prestige_bias`, and `gap_negative_framing`
   lexicon categories originally produced zero hits across 100 real
   resumes.** Root cause: the original phrasing (e.g. "must be able to
   stand for long periods") was job-posting language, not resume language
   — a candidate would never write that about themselves. Rewritten with
   self-reported phrasing candidates actually use (e.g. "excellent physical
   condition", "summa cum laude", "took time off to") — verified these now
   fire correctly. Note: `gap_negative_framing` is still expected to stay
   rare even with better phrasing, since candidates rarely explain
   employment gaps in resume body text (more common in cover letters) —
   that's a legitimate scope limitation, documented rather than a bug.
2. **NER (`names`/`orgs`) has a real quality ceiling on this dataset.**
   Resume PDFs extract to text with irregular spacing/column artifacts that
   confuse a general-purpose NER model — you'll still see some noise (e.g.
   action verbs misread as names). This is documented and accepted rather
   than fixed further, since `names`/`orgs` are informational only and
   don't feed any bias flag.
3. **Contextual pass is comparatively slow** (transformer inference per
   resume line) — fine for a demo on a handful of resumes, but running it
   across the full dataset will take real time. Consider only running it
   on resumes/lines the lexicon pass didn't already flag, to cut redundant
   work, if speed becomes an issue during integration or demo.
4. **PARTIALLY RESOLVED: contextual pass false positives.** Two systematic
   false-positive patterns found through live testing, both fixed in code:
   (a) job-header lines (date range + company name) were being misread as
   "age-biased" purely for containing years — fixed by skipping lines
   matching a date-range pattern before classification; (b) bare acronym
   strings like "FMLA/ADA/EEO/WC" were getting flagged across multiple
   categories at once since the model has nothing substantive to classify
   — fixed by requiring a minimum word count before a segment reaches the
   classifier. Residual, undocumented risk: short skill-bullet fragments
   (e.g. "HR Policies & Procedures   Staff Recruitment & Retention") still
   pass the word-count filter but aren't real prose either, and may still
   produce some noise. Given time constraints this is accepted as a known
   limitation rather than further engineered — consistent with the
   project's own stated framing that the tool "detects proxies for bias,
   not ground truth," so some false positives are expected and the
   contextual layer should be treated as a signal to review, not a verdict.

## Files in this folder

- `lexicon.json` — the bias taxonomy/word lists. Still worth expanding,
  especially the three zero-hit categories above.
- `bias_detector.py` — `lexicon_scan()`, `ner_scan()`, `contextual_scan()`,
  `analyze_resume()`. Fully documented in the module docstring.

## Remaining work (in priority order)

1. Run the full dataset (or a larger sample) through the contextual pass
   to sanity-check quality now that line-based segmentation is fixed.
2. Hand this README + both files to Person B and Person C as the final
   contract — they should stop building against mock data.
