import {
  analyzeResumeText,
  runCounterfactualFairnessAudit,
  EVALUATION_BENCHMARK_DATA,
} from "./bias-taxonomy";
import type { BiasCategory, BiasSpan, ResumeBiasReport, SeverityLevel } from "./resume-contract";

import { checkRateLimit, recordRateLimitFailure, recordRateLimitSuccess } from "./rate-limiter";

export type AnalysisMode = "local" | "fastapi";

export interface AnalysisServiceConfig {
  mode: AnalysisMode;
  fastApiUrl: string;
}

export const DEFAULT_CONFIG: AnalysisServiceConfig = {
  mode: "local",
  fastApiUrl: "http://localhost:8000",
};

export async function processResumeAnalysis(
  rawText: string,
  fileName: string,
  config: AnalysisServiceConfig = DEFAULT_CONFIG,
): Promise<ResumeBiasReport> {
  // If user configured FastAPI backend from Person A / B, attempt remote call with rate limiting
  if (config.mode === "fastapi") {
    const rateCheck = checkRateLimit("api:analyze", config.fastApiUrl);
    if (!rateCheck.allowed) {
      console.warn(
        "[AnalysisService] Rate limit hit for FastAPI endpoint. Falling back to local NLP.",
      );
    } else {
      try {
        const response = await fetch(`${config.fastApiUrl}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_text: rawText, file_name: fileName }),
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

  // Local Engine (Person C integration engine with Gaucher taxonomy and ADEA rules)
  const analysis = analyzeResumeText(rawText);

  const byCategory: Record<BiasCategory, number> = {
    gender_coded: 0,
    age_indicative: 0,
    prestige_proxy: 0,
    gap_framing: 0,
    disability_coded: 0,
  };
  const bySeverity: Record<SeverityLevel, number> = { low: 0, medium: 0, high: 0 };

  analysis.spans.forEach((span) => {
    byCategory[span.category] = (byCategory[span.category] || 0) + 1;
    bySeverity[span.severity] = (bySeverity[span.severity] || 0) + 1;
  });

  const fairnessAudit = runCounterfactualFairnessAudit(rawText, analysis.spans);

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
  };
}
