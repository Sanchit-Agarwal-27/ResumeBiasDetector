/**
 * @file morphological-matcher.ts
 * High-precision lexical, morphological & fuzzy candidate scanner for the expanded taxonomy.
 * Matches multiword expressions, morphological variants (adverbs, comparatives, nouns),
 * spelling/OCR variants (including typo tolerance such as 'anfrily' -> 'angrily'),
 * while avoiding substring and dictionary false-positives (e.g. 'manage', 'storage', 'benefit', 'streaming').
 */

import { EXPANDED_TAXONOMY, type ExpandedTaxonomyItem } from "./expanded-taxonomy";
import {
  VARIANT_TYPES,
  type CandidateMatch,
  type ContextBiasCategory,
  type SeverityLevel,
  type TaxonomyEntry,
} from "./types";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface CompiledVariant {
  form: string;
  type: string;
  regex: RegExp;
  wordCount: number;
  entry: ExpandedTaxonomyItem;
}

/**
 * Standard English & technical vocabulary safe-list.
 * Prevents fuzzy typo-matching against standard words (e.g. 'manage' -> 'mature', 'streaming' -> 'screaming').
 */
const SAFE_WORDS = new Set<string>([
  "manage",
  "manager",
  "managers",
  "managing",
  "management",
  "storage",
  "package",
  "packages",
  "packaged",
  "packaging",
  "profit",
  "profits",
  "profitable",
  "benefit",
  "benefits",
  "benefited",
  "damage",
  "damages",
  "engineer",
  "engineers",
  "engineering",
  "software",
  "system",
  "systems",
  "project",
  "projects",
  "client",
  "clients",
  "service",
  "services",
  "experience",
  "experiences",
  "accessible",
  "accessibility",
  "qualification",
  "qualifications",
  "deliverable",
  "deliverables",
  "support",
  "supported",
  "supporting",
  "feature",
  "features",
  "application",
  "applications",
  "develop",
  "developed",
  "developer",
  "developers",
  "developing",
  "development",
  "design",
  "designed",
  "designer",
  "designing",
  "implement",
  "implemented",
  "implementing",
  "implementation",
  "architecture",
  "architected",
  "framework",
  "frameworks",
  "database",
  "databases",
  "network",
  "networks",
  "networking",
  "cloud",
  "platform",
  "platforms",
  "product",
  "products",
  "production",
  "program",
  "programs",
  "programming",
  "technology",
  "technologies",
  "testing",
  "tested",
  "tests",
  "analysis",
  "analyst",
  "business",
  "market",
  "marketing",
  "sales",
  "revenue",
  "strategy",
  "strategies",
  "customer",
  "customers",
  "process",
  "processes",
  "processing",
  "infrastructure",
  "performance",
  "optimization",
  "optimize",
  "optimized",
  "optimizing",
  "pipeline",
  "pipelines",
  "solution",
  "solutions",
  "security",
  "integration",
  "integrated",
  "interface",
  "interfaces",
  "experience",
  "experienced",
  "education",
  "university",
  "college",
  "school",
  "bachelor",
  "master",
  "degree",
  "skills",
  "summary",
  "contact",
  "email",
  "phone",
  "address",
  "company",
  "worked",
  "working",
  "responsible",
  "created",
  "built",
  "building",
  "maintained",
  "collaborated",
  "collaborating",
  "achieved",
  "improved",
  "increased",
  "reduced",
  "delivered",
  "directed",
  "organized",
  "coordinated",
  // Technical systems, data & networking safe words
  "stream",
  "streams",
  "streaming",
  "streamed",
  "string",
  "strings",
  "spring",
  "schema",
  "schemas",
  "script",
  "scripts",
  "scripting",
  "screen",
  "screens",
  "screening",
  "scale",
  "scaled",
  "scaling",
  "scope",
  "scoped",
  "scoping",
  "stack",
  "stacks",
  "status",
  "state",
  "states",
  "stage",
  "stages",
  "standard",
  "standards",
  "session",
  "sessions",
  "server",
  "servers",
  "setting",
  "settings",
  "setup",
  "search",
  "searched",
  "searching",
  "share",
  "shared",
  "sharing",
  "source",
  "sources",
  "spark",
  "syntax",
  "training",
  "trained",
  "tracking",
  "tracked",
  "tuning",
  "tuned",
  "thread",
  "threads",
  "threading",
  "throughput",
  "traffic",
  "trigger",
  "triggers",
  "triggered",
  "transaction",
  "transactions",
  "template",
  "templates",
  "terminal",
  "timing",
  "timers",
  "token",
  "tokens",
  "tooling",
  "tools",
  "topology",
  "transform",
  "transformed",
  "transforming",
  "transforms",
  "route",
  "routes",
  "routing",
  "router",
  "runtime",
  "release",
  "releases",
  "released",
  "request",
  "requests",
  "response",
  "responses",
  "resource",
  "resources",
  "registry",
  "rendering",
  "rendered",
  "report",
  "reports",
  "reporting",
  "repository",
  "repositories",
  "restful",
  "recovery",
  "recording",
  "recorded",
  "review",
  "reviews",
  "reviewed",
  "reviewing",
  "redis",
  "react",
  "redux",
  "refactor",
  "refactored",
  "refactoring",
  "module",
  "modules",
  "model",
  "models",
  "modeling",
  "method",
  "methods",
  "memory",
  "metric",
  "metrics",
  "message",
  "messages",
  "messaging",
  "middleware",
  "migration",
  "migrations",
  "monitoring",
  "native",
  "node",
  "nodes",
  "object",
  "objects",
  "operation",
  "operations",
  "operational",
  "output",
  "outputs",
  "packet",
  "packets",
  "parsing",
  "parser",
  "parsers",
  "patch",
  "patches",
  "patching",
  "pattern",
  "patterns",
  "plugin",
  "plugins",
  "policy",
  "policies",
  "polling",
  "portal",
  "protocol",
  "protocols",
  "provider",
  "providers",
  "proxy",
  "proxies",
  "publish",
  "publishing",
  "published",
  "python",
  "query",
  "queries",
  "querying",
  "queue",
  "queues",
  "queuing",
]);

/**
 * Computes Damerau-Levenshtein distance between two strings with early exit.
 */
function damerauLevenshtein(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 1) return 999;
  const la = a.length;
  const lb = b.length;
  const d: number[][] = [];

  for (let i = 0; i <= la; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= lb; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[la][lb];
}

/**
 * Compiles all taxonomy variants into sorted, word-boundary regex matchers.
 * Multiword expressions are sorted first (longest match priority).
 */
function compileVariants(): CompiledVariant[] {
  const list: CompiledVariant[] = [];

  for (const entry of EXPANDED_TAXONOMY) {
    for (const variant of entry.variants) {
      const cleanForm = variant.form.trim();
      const wordCount = cleanForm.split(/[\s-]+/).length;

      // Allow flexible spacing around hyphens: e.g. "tech-savvy" matches "tech-savvy" or "tech savvy"
      const escaped = escapeRegex(cleanForm).replace(/\\-/g, "[\\s-]");
      const pattern = new RegExp(`\\b${escaped}\\b`, "gi");

      list.push({
        form: cleanForm,
        type: variant.type,
        regex: pattern,
        wordCount,
        entry,
      });
    }
  }

  // Sort longest multiword expressions first to prevent sub-string fragmentation
  list.sort((a, b) => b.wordCount - a.wordCount || b.form.length - a.form.length);
  return list;
}

const COMPILED_VARIANTS: CompiledVariant[] = compileVariants();

/**
 * Index of single-word taxonomy targets for fast fuzzy typo matching (e.g. 'anfrily' -> 'angrily').
 */
interface FuzzyTarget {
  word: string;
  entry: ExpandedTaxonomyItem;
}

function compileFuzzyTargets(): FuzzyTarget[] {
  const map = new Map<string, FuzzyTarget>();
  for (const entry of EXPANDED_TAXONOMY) {
    for (const v of entry.variants) {
      const clean = v.form.trim().toLowerCase();
      // Only single words with length >= 5
      if (!clean.includes(" ") && !clean.includes("-") && clean.length >= 5) {
        if (!map.has(clean)) {
          map.set(clean, { word: clean, entry });
        }
      }
    }
  }
  return Array.from(map.values());
}

const FUZZY_TARGETS: FuzzyTarget[] = compileFuzzyTargets();

/**
 * Scans input text and identifies all candidate trigger spans using the expanded taxonomy.
 * Includes exact multiword, morphological, and fuzzy typo matching.
 *
 * @param rawText Full text or sentence
 * @returns Candidate spans with morphological variant metadata.
 */
export function scanExpandedCandidates(rawText: string): CandidateMatch[] {
  if (!rawText || typeof rawText !== "string") {
    return [];
  }

  const spans: CandidateMatch[] = [];

  // 1. Scan multiword expressions and exact morphological variants
  for (const item of COMPILED_VARIANTS) {
    const pattern = new RegExp(item.regex.source, item.regex.flags);
    let match = pattern.exec(rawText);

    while (match) {
      const start = match.index;
      const end = start + match[0].length;
      const matchedText = match[0];

      // Avoid overlapping with already-matched spans (longest-match priority)
      const overlaps = spans.some((s) => Math.max(s.start, start) < Math.min(s.end, end));

      if (!overlaps) {
        spans.push({
          form: item.form,
          type: item.type,
          matchedText,
          category: item.entry.category as ContextBiasCategory,
          subcategory: item.entry.subcategory,
          severity: item.entry.defaultSeverity as SeverityLevel,
          confidence: item.entry.confidence,
          explanation: item.entry.explanation,
          researchCitation: item.entry.researchCitation,
          replacement: item.entry.replacement,
          rationale: item.entry.rationale || item.entry.explanation,
          entry: item.entry as unknown as TaxonomyEntry,
          start,
          end,
        });
      }

      match = pattern.exec(rawText);
    }
  }

  // 2. Fuzzy Typo & OCR Scanner (Levenshtein distance <= 1 for single words >= 5 chars)
  // Catches typos such as 'anfrily' -> 'angrily', 'confrontatonal' -> 'confrontational'
  const tokenRegex = /\b[a-zA-Z]{5,}\b/g;
  let tokenMatch = tokenRegex.exec(rawText);

  while (tokenMatch) {
    const start = tokenMatch.index;
    const end = start + tokenMatch[0].length;
    const matchedToken = tokenMatch[0];
    const lowerToken = matchedToken.toLowerCase();

    // Check if span is already covered
    const overlaps = spans.some((s) => Math.max(s.start, start) < Math.min(s.end, end));

    if (!overlaps && !SAFE_WORDS.has(lowerToken)) {
      // Find candidate fuzzy match
      for (const target of FUZZY_TARGETS) {
        if (Math.abs(target.word.length - lowerToken.length) <= 1) {
          const dist = damerauLevenshtein(lowerToken, target.word);
          if (dist === 1) {
            // Found a valid typo match
            spans.push({
              form: target.word,
              type: VARIANT_TYPES.SPELLING_VARIANT,
              matchedText: matchedToken,
              category: target.entry.category as ContextBiasCategory,
              subcategory: target.entry.subcategory,
              severity: target.entry.defaultSeverity as SeverityLevel,
              confidence: Math.max(0.85, target.entry.confidence - 0.04),
              explanation: `Spelling or OCR variant '${matchedToken}' of '${target.word}': ${target.entry.explanation}`,
              researchCitation: target.entry.researchCitation,
              replacement: target.entry.replacement,
              rationale: target.entry.rationale || target.entry.explanation,
              entry: target.entry as unknown as TaxonomyEntry,
              start,
              end,
            });
            break;
          }
        }
      }
    }

    tokenMatch = tokenRegex.exec(rawText);
  }

  // 3. Legacy graduation dates older than 20-25 years (e.g. 1950 - 2004)
  // Operates as an overt age proxy under EEOC / ADEA guidelines.
  // NEVER flags standard date ranges (e.g. "2014 – May 2018", "2012 – 2018", "2019 – Present").
  const legacyGraduationRegex = /\b(?:19[5-9]\d|200[0-4])\b/g;
  let yearMatch = legacyGraduationRegex.exec(rawText);
  while (yearMatch) {
    const start = yearMatch.index;
    const end = start + yearMatch[0].length;
    const matchedText = yearMatch[0];

    // Check surrounding window (25 chars before and after) to verify it is NOT part of a date range
    const windowBefore = rawText.slice(Math.max(0, start - 25), start);
    const windowAfter = rawText.slice(end, Math.min(rawText.length, end + 25));

    // A date range has hyphens, dashes, or range words connecting dates
    const isPrecededByRange =
      /[-–—/]\s*$/i.test(windowBefore) || /\b(?:to|until|through)\s*$/i.test(windowBefore);
    const isFollowedByRange =
      /^\s*[-–—/]/.test(windowAfter) ||
      /^\s*\b(?:to|until|through|present|current)\b/i.test(windowAfter);
    const isMonthRange = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*$/i.test(
      windowBefore,
    );

    const isDateRange = isPrecededByRange || isFollowedByRange || isMonthRange;

    // Check if there is explicit graduation or education phrasing in the sentence
    const surroundingSentence = rawText.slice(
      Math.max(0, start - 80),
      Math.min(rawText.length, end + 80),
    );
    const hasGraduationContext =
      /\b(?:graduat(?:ed|ion|e)?|class of|degree|bachelor|master|ph\.?d|b\.?s|b\.?a|alumn(?:us|a|i))\b/i.test(
        surroundingSentence,
      );

    const overlaps = spans.some((s) => Math.max(s.start, start) < Math.min(s.end, end));

    if (!overlaps && !isDateRange && hasGraduationContext) {
      spans.push({
        form: matchedText,
        type: VARIANT_TYPES.BASE_FORM,
        matchedText,
        category: "age_indicative",
        subcategory: "graduation_year_proxy",
        severity: "medium",
        confidence: 0.95,
        explanation:
          "Listing graduation dates older than 20 years operates as an age proxy in automated candidate screening.",
        researchCitation: "EEOC ADEA Guidance & Neumark et al. (2019)",
        replacement: "Remove graduation year",
        rationale:
          "Omitting legacy graduation dates neutralizes age proxies while keeping degree credentials intact.",
        entry: {
          canonicalTerm: "graduation_year",
          category: "age_indicative",
          subcategory: "graduation_year_proxy",
          severity: "medium",
          confidence: 0.95,
          replacement: "Remove graduation year",
          explanation:
            "Listing graduation dates older than 20 years operates as an age proxy in automated candidate screening.",
          researchCitation: "EEOC ADEA Guidance & Neumark et al. (2019)",
          variants: [{ form: matchedText, type: VARIANT_TYPES.BASE_FORM }],
        } as unknown as TaxonomyEntry,
        start,
        end,
      });
    }

    yearMatch = legacyGraduationRegex.exec(rawText);
  }

  // Sort chronologically by start position
  spans.sort((a, b) => a.start - b.start);
  return spans;
}
