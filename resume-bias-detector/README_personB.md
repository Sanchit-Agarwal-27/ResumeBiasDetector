# Person B — Fairness Audit + Rewrite Engine

This is a complete, runnable starting point for your lane of the AI
Resume Bias Detector project: **proving bias exists (fairness audit)**
and **fixing what's flagged (rewrite engine)**. It works standalone,
right now, without needing Person A's detector or a real ATS model —
so you can demo it today and swap in real pieces as your teammates
finish theirs.

## Quick start

```bash
pip install -r requirements.txt
python run_demo.py
```

You'll see two things print: rewrite suggestions for a sample biased
resume snippet, and a fairness audit report run twice (once against a
neutral scorer, once against a deliberately biased one, to prove the
audit actually catches bias when it's there).

## What each file does

**`bias_taxonomy.py`**
A small, temporary bias lexicon (gender-coded words, age-coded phrases,
university-prestige markers) plus a `flag_sample_text()` function that
scans text and returns flagged phrases. This is a *stand-in* for Person
A's real NLP detector — once their module is ready, swap their output
in wherever this file is used. The important thing is the shape stays
the same: each flag has a `text`, `category`, `severity`, and
`explanation`.

**`counterfactual_generator.py`**
Builds resume **pairs** that are identical except for one variable —
name (gender/ethnicity proxy), university prestige, or employment-gap
framing. This is the core method of the fairness audit: if two
otherwise-identical resumes get scored differently, the difference must
be caused by that one variable. `scale_pairs()` cycles the base pairs
to give you a bigger sample for statistics — replace with real varied
resume bodies as you have time.

**`mock_scorer.py`**
A placeholder "ATS" scoring function (`score(resume_text) -> float`),
since your team doesn't have a real scoring model yet. It scores purely
on keyword overlap with a job description — no bias rules — so it acts
as a sanity check: the audit should find little bias here.

**`mock_scorer_biased.py`**
A second placeholder scorer with bias built in **on purpose** (penalizes
certain names, less-known universities, and employment gaps). Run your
audit against this one to *prove your statistics pipeline works* —
this is your strongest demo/viva moment: "here's a known-biased model,
and here's our audit correctly catching it."

**`fairness_audit.py`**
The actual statistics. Takes resume pairs + a scorer, and for each
variable tested computes:
- Mean score gap between variant A and variant B
- A paired t-test p-value (is the gap statistically meaningful?)
- Disparate impact ratio (the "80% rule" — a standard HR/legal fairness
  benchmark: if one group's selection rate is under 80% of the other's,
  that's flagged)

**`rewrite_engine.py`**
Turns a flagged phrase into a neutral rewrite suggestion. Tries the
Anthropic API first (needs `pip install anthropic` and an
`ANTHROPIC_API_KEY` environment variable set); if that's not available,
falls back to a small hand-written dictionary so the demo still works
offline. Both paths return through the same `suggest_rewrite()`
function, so nothing else in the codebase needs to know which mode is
active.

**`run_demo.py`**
Ties everything together and is the file you actually run. Shows
rewrite suggestions for a sample resume, then runs the fairness audit
twice (neutral scorer vs. biased scorer) so you can see the pipeline
correctly distinguish a fair model from a biased one.

## How this connects to your teammates

- **Person A (detection engine)**: once their module exists, replace
  the `flag_sample_text()` calls in `run_demo.py` with calls to their
  real detector. Keep the `FlaggedPhrase` shape (`text`, `category`,
  `severity`, `explanation`) the same, or update `rewrite_engine.py`'s
  input type to match theirs.
- **Person C (UI/integration)**: `fairness_audit.print_report()` and
  `rewrite_engine.suggest_rewrite()` are the two functions they'll call
  from the web app to display results. Consider having them call a
  `run_full_pipeline(resume_text) -> dict` wrapper function (not yet
  written — worth adding once A's detector is ready) that returns clean
  JSON for the frontend instead of printing to console.
- **Real scoring model**: if the team decides to source or build a real
  ATS-style model instead of the mocks, just point `run_audit()` at its
  `score()`-shaped function — nothing else changes.

## Known limitations (worth stating in your write-up)

- The counterfactual pairs currently use one example per variable,
  scaled up by repetition (`scale_pairs`) — this inflates your sample
  size artificially. Before your final report, write more varied
  resume bodies by hand or synthetically to make the statistics
  genuinely robust, not just repeated.
- The mock scorers are not real models. Your fairness-audit *method* is
  valid research methodology; your *specific numbers* are only as
  meaningful as whatever scorer you plug in.
- Disparate impact ratio depends heavily on the shortlist threshold you
  pick — say so explicitly when you present results, and consider
  showing results at 2–3 different thresholds.
