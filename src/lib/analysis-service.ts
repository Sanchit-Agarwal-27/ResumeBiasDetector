import {
  analyzeResumeText,
  runCounterfactualFairnessAudit,
  EVALUATION_BENCHMARK_DATA,
} from "./bias-taxonomy";
import type {
  AtsMatchResult,
  BiasCategory,
  BiasSpan,
  FairnessAudit,
  ResumeBiasReport,
  ResumeErrorFlag,
  QualityMetrics,
  RewriteSuggestion,
  SeverityLevel,
} from "./resume-contract";
import { calculateAtsMatch } from "./ats-matching-engine";
import { checkRateLimit, recordRateLimitFailure, recordRateLimitSuccess } from "./rate-limiter";

export type AnalysisMode = "local" | "fastapi";

export interface AnalysisServiceConfig {
  mode: AnalysisMode;
  fastApiUrl: string;
}

export interface HealthResponse {
  status: string;
  model_version: string;
  engine: string;
  uptime_seconds: number;
  features_active: string[];
}

export const DEFAULT_CONFIG: AnalysisServiceConfig = {
  mode: "local",
  fastApiUrl: (import.meta as any).env?.VITE_FASTAPI_URL || "http://localhost:8000",
};

/**
 * Checks whether the Python FastAPI backend is live and operational
 */
export async function checkBackendHealth(
  fastApiUrl: string = DEFAULT_CONFIG.fastApiUrl,
): Promise<HealthResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(`${fastApiUrl}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as HealthResponse;
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetches dynamic Google XYZ impact rewrite for a specific sentence from FastAPI backend
 */
export async function fetchDynamicRewrite(
  spanId: string,
  sentence: string,
  matchedText: string,
  category: BiasCategory,
  fastApiUrl: string = DEFAULT_CONFIG.fastApiUrl,
): Promise<RewriteSuggestion | null> {
  try {
    const res = await fetch(`${fastApiUrl}/api/rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        span_id: spanId,
        sentence,
        matched_text: matchedText,
        category,
      }),
    });
    if (res.ok) {
      return (await res.json()) as RewriteSuggestion;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Executes server-side ATS job matching and counterfactual simulation
 */
export async function fetchServerAtsMatch(
  resumeText: string,
  jobDescription: string,
  targetTitle = "Target Role",
  fastApiUrl: string = DEFAULT_CONFIG.fastApiUrl,
): Promise<AtsMatchResult | null> {
  try {
    const res = await fetch(`${fastApiUrl}/api/job-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resume_text: resumeText,
        job_description: jobDescription,
        target_title: targetTitle,
      }),
    });
    if (res.ok) {
      return (await res.json()) as AtsMatchResult;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Executes server-side 10-perturbation counterfactual fairness audit
 */
export async function fetchServerFairnessAudit(
  rawText: string,
  fastApiUrl: string = DEFAULT_CONFIG.fastApiUrl,
): Promise<FairnessAudit | null> {
  try {
    const res = await fetch(`${fastApiUrl}/api/audit/counterfactual`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_text: rawText }),
    });
    if (res.ok) {
      return (await res.json()) as FairnessAudit;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Queries server-side gold benchmark metrics
 */
export async function fetchServerBenchmarks(
  fastApiUrl: string = DEFAULT_CONFIG.fastApiUrl,
): Promise<any | null> {
  try {
    const res = await fetch(`${fastApiUrl}/api/benchmarks`);
    if (res.ok) {
      return await res.json();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Main Analysis Orchestrator:
 * Executes full AI analysis via FastAPI microservice with automatic local fallback.
 */
export async function processResumeAnalysis(
  rawText: string,
  fileName: string,
  config: AnalysisServiceConfig = DEFAULT_CONFIG,
  jobDescription?: string,
  targetTitle?: string,
): Promise<ResumeBiasReport> {
  // If user configured FastAPI backend, attempt remote call with rate limiting
  if (config.mode === "fastapi") {
    const rateCheck = checkRateLimit("api:analyze", config.fastApiUrl);
    if (!rateCheck.allowed) {
      console.warn("[AnalysisService] Rate limit hit for FastAPI endpoint. Falling back to local NLP.");
    } else {
      try {
        const payload: Record<string, any> = {
          raw_text: rawText,
          file_name: fileName,
        };
        if (jobDescription && jobDescription.trim()) {
          payload.job_description = jobDescription;
          payload.target_title = targetTitle || "Target Role";
        }

        const response = await fetch(`${config.fastApiUrl}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          recordRateLimitSuccess("api:analyze", config.fastApiUrl);
          const data = (await response.json()) as ResumeBiasReport;
          return data;
        } else {
          recordRateLimitFailure("api:analyze", config.fastApiUrl);
        }
      } catch (error) {
        recordRateLimitFailure("api:analyze", config.fastApiUrl);
        console.warn("FastAPI backend unreachable; falling back to local NLP engine", error);
      }
    }
  }

  // Local In-Browser Fallback Engine
  const analysis = analyzeResumeText(rawText);

  const byCategory: Record<BiasCategory, number> = {
    gender_coded: 0,
    age_indicative: 0,
    prestige_proxy: 0,
    gap_framing: 0,
    disability_coded: 0,
    personality_behavioral: 0,
  };
  const bySeverity: Record<SeverityLevel, number> = { low: 0, medium: 0, high: 0 };

  analysis.spans.forEach((span) => {
    byCategory[span.category] = (byCategory[span.category] || 0) + 1;
    bySeverity[span.severity] = (bySeverity[span.severity] || 0) + 1;
  });

  const fairnessAudit = runCounterfactualFairnessAudit(rawText, analysis.spans);

  // Compute baseline local quality metrics
  const lines = rawText.split("\n").filter((l) => l.trim().length > 0);
  const bulletCount = lines.filter((l) => /^[\s•\-*0-9.]+/.test(l) || l.length > 25).length;
  const quantifiedBullets = lines.filter((l) => /\b\d+(?:\.\d+)?%?|\$\d+|\b\d+\s*(?:ms|sec|hours|days|x|k|m|users)\b/i.test(l)).length;

  const defaultQuality: QualityMetrics = {
    action_verb_score: Math.min(100, Math.max(70, 100 - analysis.spans.length * 5)),
    quantification_score: bulletCount > 0 ? Math.round((quantifiedBullets / bulletCount) * 100) : 75,
    passive_voice_count: 0,
    weak_verb_count: 0,
    unquantified_bullet_count: Math.max(0, bulletCount - quantifiedBullets),
    total_bullet_count: bulletCount,
    ats_readability_score: Math.min(100, Math.max(75, 100 - analysis.spans.length * 4)),
  };

  const defaultErrors: ResumeErrorFlag[] = [];

  return {
    document_id: `doc-${Date.now()}`,
    file_name: fileName,
    raw_text: rawText,
    neutrality_score: analysis.neutrality_score,
    summary: {
      total_flags: analysis.spans.length,
      by_category: byCategory,
      by_severity: bySeverity,
    },
    spans: analysis.spans,
    suggestions: analysis.suggestions,
    fairness_audit: fairnessAudit,
    evaluation_benchmarks: EVALUATION_BENCHMARK_DATA,
    classified_sentences: analysis.classified_sentences,
    context_summary: analysis.context_summary,
    error_flags: defaultErrors,
    quality_metrics: defaultQuality,
    ats_match:
      jobDescription && jobDescription.trim()
        ? calculateAtsMatch(rawText, {
            id: "local_job_01",
            title: targetTitle || "Target Role",
            raw_text: jobDescription,
          })
        : undefined,
  };
}
