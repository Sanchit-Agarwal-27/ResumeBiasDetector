import { useState, useMemo } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  BookOpen,
  FileText,
  Copy,
  Plus,
  Check,
  Award,
  Briefcase,
  Code2,
  Search,
  Filter,
  Layers,
  Scale,
  Sparkles,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AtsMatchResult, KeywordMatchEntry } from "@/lib/resume-contract";
import {
  generateJobMatchExplanation,
  type JobMatchExplanationReport,
  type EvidenceType,
  type PositiveMatchExplanation,
  type MissingRequirementExplanation,
} from "@/lib/job-match-explainability";

interface JobMatchExplainabilityViewProps {
  matchResult: AtsMatchResult;
  resumeText: string;
  jobText: string;
  onInsertKeyword?: (keyword: string) => void;
}

export function JobMatchExplainabilityView({
  matchResult,
  resumeText,
  jobText,
  onInsertKeyword,
}: JobMatchExplainabilityViewProps) {
  const [evidenceFilter, setEvidenceFilter] = useState<EvidenceType | "all">("all");
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [selectedInspectorKey, setSelectedInspectorKey] = useState<string>("");

  // Memoize report generation: uses matchResult.explanation if present, or computes faithfully
  const report: JobMatchExplanationReport = useMemo(() => {
    if (matchResult.explanation) {
      return matchResult.explanation;
    }
    return generateJobMatchExplanation(matchResult, resumeText, jobText);
  }, [matchResult, resumeText, jobText]);

  // Set default inspector key
  const availableKeys = useMemo(() => {
    const matched = report.positiveMatches.map((p) => p.keyword);
    const missing = report.missingRequirements.map((m) => m.keyword);
    return [...matched, ...missing];
  }, [report]);

  const activeKey = selectedInspectorKey || availableKeys[0] || "";

  const activeInspectorItem = useMemo(() => {
    const matched = report.positiveMatches.find((p) => p.keyword === activeKey);
    if (matched) return { type: "matched" as const, data: matched };
    const missing = report.missingRequirements.find((m) => m.keyword === activeKey);
    if (missing) return { type: "missing" as const, data: missing };
    return null;
  }, [report, activeKey]);

  // Filter positive matches
  const filteredPositiveMatches = useMemo(() => {
    if (evidenceFilter === "all") return report.positiveMatches;
    return report.positiveMatches.filter((p) => p.evidenceType === evidenceFilter);
  }, [report.positiveMatches, evidenceFilter]);

  function handleCopySnippet(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedKeyword(label);
    toast.success(`Copied evidence for "${label}"`, {
      description: "Ready to paste or review.",
    });
    setTimeout(() => setCopiedKeyword(null), 2000);
  }

  function getEvidenceBadge(type: EvidenceType) {
    switch (type) {
      case "project_experience":
        return (
          <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30 text-[10px] gap-1 font-medium">
            <Briefcase className="h-2.5 w-2.5" />
            Project Experience
          </Badge>
        );
      case "explicit_skill":
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] gap-1 font-medium">
            <Code2 className="h-2.5 w-2.5" />
            Explicit Skill
          </Badge>
        );
      case "qualification":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] gap-1 font-medium">
            <Award className="h-2.5 w-2.5" />
            Qualification
          </Badge>
        );
      case "contextual_mention":
      default:
        return (
          <Badge className="bg-muted text-muted-foreground border-border text-[10px] gap-1 font-medium">
            <FileText className="h-2.5 w-2.5" />
            Contextual Mention
          </Badge>
        );
    }
  }

  return (
    <div className="space-y-6">
      {/* SECTION 1: UNDERSTANDING YOUR MATCH SCORE */}
      <section className="p-4 sm:p-5 rounded-xl border bg-card/70 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Understanding Your Match Score
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Natural-language, evidence-based breakdown of your calculated ATS ranking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Badge
              variant="outline"
              className={cn(
                "px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider",
                report.overallScore >= 80
                  ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5"
                  : report.overallScore >= 65
                    ? "border-primary/40 text-primary bg-primary/5"
                    : report.overallScore >= 50
                      ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/5"
                      : "border-destructive/40 text-destructive bg-destructive/5",
              )}
            >
              {report.scoreVerdict}
            </Badge>
            <span className="text-xl font-bold font-mono text-foreground">
              {report.overallScore}%
            </span>
          </div>
        </div>

        {/* Narrative Explanation */}
        <div className="p-3.5 rounded-lg bg-muted/30 border border-muted-foreground/10 text-xs text-foreground/90 leading-relaxed font-sans">
          <p>{report.scoreSummaryNarrative}</p>
        </div>

        {/* 4 Dimension Breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {report.dimensionBreakdown.map((dim, i) => (
            <div key={i} className="p-3 rounded-lg border bg-background/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">{dim.dimension}</span>
                <span className="text-xs font-bold font-mono text-primary">{dim.score}%</span>
              </div>
              <Progress value={dim.score} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground leading-normal">{dim.summary}</p>
              <div className="text-[10px] text-foreground/75 font-mono bg-muted/40 px-2 py-1 rounded border border-muted/50 truncate">
                {dim.evidenceSummary}
              </div>
            </div>
          ))}
        </div>

        {/* Strict Non-Fabrication Notice */}
        <div className="flex items-start gap-2 pt-1 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <span>{report.disclaimer}</span>
        </div>
      </section>

      {/* SECTION 2: WHY YOUR RESUME MATCHES THIS JOB */}
      <section className="p-4 sm:p-5 rounded-xl border bg-card/70 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Why Your Resume Matches This Job
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Supported job requirements paired with verified verbatim evidence from your resume
              </p>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground uppercase font-semibold mr-1 flex items-center gap-1">
              <Filter className="h-3 w-3" /> Filter:
            </span>
            {(
              [
                { id: "all", label: `All (${report.positiveMatches.length})` },
                {
                  id: "project_experience",
                  label: `Projects (${report.positiveMatches.filter((p) => p.evidenceType === "project_experience").length})`,
                },
                {
                  id: "explicit_skill",
                  label: `Skills (${report.positiveMatches.filter((p) => p.evidenceType === "explicit_skill").length})`,
                },
                {
                  id: "qualification",
                  label: `Education (${report.positiveMatches.filter((p) => p.evidenceType === "qualification").length})`,
                },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setEvidenceFilter(filter.id)}
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors border",
                  evidenceFilter === filter.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/50",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {/* Positive Matches List */}
        {filteredPositiveMatches.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground border rounded-lg bg-muted/10">
            No matches found for the selected filter category.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPositiveMatches.map((match) => (
              <div
                key={match.keyword}
                className="p-3.5 rounded-xl border bg-background/80 hover:border-emerald-500/40 transition-colors space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground capitalize">
                      {match.keyword}
                    </span>
                    {getEvidenceBadge(match.evidenceType)}
                    {match.resumeSection && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-muted/50">
                        Section: {match.resumeSection}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopySnippet(match.resumeEvidence, match.keyword)}
                    className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                  >
                    {copiedKeyword === match.keyword ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500 font-medium">Copied quote</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy evidence quote</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Job Requirement Excerpt */}
                <div className="text-[11px] text-muted-foreground bg-muted/20 px-2.5 py-1.5 rounded-md border border-muted/30">
                  <span className="font-semibold text-foreground/90">Target Job Requirement: </span>
                  <span className="italic">"{match.jobRequirement}"</span>
                </div>

                {/* Resume Evidence Quote */}
                <div className="text-xs text-foreground bg-emerald-500/5 border-l-2 border-emerald-500 px-3 py-2 rounded-r-md">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 block text-[10px] uppercase tracking-wider mb-0.5">
                    Supporting Resume Evidence:
                  </span>
                  <p className="italic font-mono text-[11px]">"{match.resumeEvidence}"</p>
                </div>

                {/* Relevance Explanation */}
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground/80">Relevance: </span>
                  {match.relevanceExplanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 3: MISSING OR UNVERIFIED REQUIREMENTS */}
      <section className="p-4 sm:p-5 rounded-xl border bg-card/70 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 border-b pb-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              Missing or Unverified Requirements ({report.missingRequirements.length})
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Job competencies not clearly demonstrated in the submitted resume text
            </p>
          </div>
        </div>

        {/* Ethical / Grounding Callout */}
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed">
            <strong>Important distinction:</strong> Missing evidence in your document does not mean
            you lack the capability; it indicates only that the uploaded resume text does not explicitly
            document it. Never fabricate experience; only add genuine achievements or transferable skills.
          </p>
        </div>

        {report.missingRequirements.length === 0 ? (
          <div className="p-6 text-center text-xs text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg bg-emerald-500/5">
            🎉 Excellent alignment! Every core requirement in this job description was matched in your resume text.
          </div>
        ) : (
          <div className="space-y-3">
            {report.missingRequirements.map((missing) => (
              <div
                key={missing.keyword}
                className="p-3.5 rounded-xl border bg-background/80 hover:border-destructive/40 transition-colors space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground capitalize">
                      {missing.keyword}
                    </span>
                    <Badge
                      variant={missing.importance === "required" ? "destructive" : "outline"}
                      className="text-[9px] uppercase px-1.5 h-4"
                    >
                      {missing.importance}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {missing.importanceJustification}
                    </span>
                  </div>

                  {onInsertKeyword && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onInsertKeyword(missing.keyword)}
                      className="h-6 text-[10px] px-2 gap-1 text-primary hover:bg-primary/10"
                    >
                      <Plus className="h-3 w-3" />
                      Add to canvas
                    </Button>
                  )}
                </div>

                {/* Job Requirement */}
                <div className="text-[11px] text-muted-foreground bg-muted/20 px-2.5 py-1.5 rounded-md border border-muted/30">
                  <span className="font-semibold text-foreground/90">Target Job Requirement: </span>
                  <span className="italic">"{missing.jobRequirement}"</span>
                </div>

                {/* Observation in resume */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    <strong className="text-foreground/90">Document Observation: </strong>
                    {missing.currentObservation}
                  </p>
                  <p>
                    <strong className="text-foreground/90">Unverified Aspect: </strong>
                    {missing.unverifiedAspects}
                  </p>
                </div>

                {/* Actionable recommendation */}
                <div className="text-[11px] bg-primary/5 border border-primary/20 rounded-md p-2.5 text-foreground/90 leading-relaxed">
                  <span className="font-semibold text-primary block text-[10px] uppercase tracking-wider mb-0.5">
                    Recommended Action:
                  </span>
                  {missing.actionableRecommendation}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 4: AREAS TO IMPROVE */}
      <section className="p-4 sm:p-5 rounded-xl border bg-card/70 space-y-4 shadow-sm">
        <div className="flex items-center gap-2.5 border-b pb-3.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold tracking-tight text-foreground">
              Areas to Improve
            </h3>
            <p className="text-[11px] text-muted-foreground">
              Actionable recommendations to strengthen your application without inflating or fabricating claims
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {report.areasToImprove.map((advice, idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border bg-background/80 flex items-start gap-2.5 text-xs text-foreground/90 leading-relaxed"
            >
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-[10px] mt-0.5">
                {idx + 1}
              </div>
              <p>{advice}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5: EVIDENCE & REASONING INSPECTOR */}
      <section className="p-4 sm:p-5 rounded-xl border bg-card/70 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600">
              <Search className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Evidence & Reasoning Inspector
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Inspect side-by-side textual alignment between job requirements and resume evidence
              </p>
            </div>
          </div>

          {/* Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
              Select Requirement:
            </span>
            <Select value={activeKey} onValueChange={setSelectedInspectorKey}>
              <SelectTrigger className="w-[180px] sm:w-[220px] h-8 text-xs">
                <SelectValue placeholder="Choose requirement..." />
              </SelectTrigger>
              <SelectContent>
                {report.positiveMatches.map((m) => (
                  <SelectItem key={m.keyword} value={m.keyword} className="text-xs">
                    ✓ {m.keyword} (Matched)
                  </SelectItem>
                ))}
                {report.missingRequirements.map((m) => (
                  <SelectItem key={m.keyword} value={m.keyword} className="text-xs text-destructive">
                    ✕ {m.keyword} (Missing)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Side-by-Side Comparison Inspector */}
        {activeInspectorItem && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Job Requirement */}
            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Target Job Description
                </span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {activeKey}
                </Badge>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-muted-foreground block font-medium">
                  Requirement Text in Posting:
                </span>
                <div className="p-3 rounded-lg border bg-background text-xs text-foreground italic leading-relaxed">
                  "{activeInspectorItem.data.jobRequirement}"
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground space-y-1">
                <p>
                  <strong>Role context: </strong>
                  {matchResult.job_profile?.title || "Target Role"}
                </p>
                <p>
                  <strong>Status: </strong>
                  {activeInspectorItem.type === "matched" ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Demonstrated in Resume
                    </span>
                  ) : (
                    <span className="text-destructive font-semibold">
                      Not clearly evidenced in uploaded text
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Right: Resume Evidence & Reasoning */}
            <div className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Resume Evidence & Evaluation
                </span>
                {activeInspectorItem.type === "matched" ? (
                  getEvidenceBadge(activeInspectorItem.data.evidenceType)
                ) : (
                  <Badge variant="destructive" className="text-[10px]">
                    Unverified
                  </Badge>
                )}
              </div>

              {activeInspectorItem.type === "matched" ? (
                <>
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      Exact Resume Passage ({activeInspectorItem.data.resumeSection}):
                    </span>
                    <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 text-xs text-foreground font-mono leading-relaxed">
                      "{activeInspectorItem.data.resumeEvidence}"
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
                    <span className="font-semibold text-foreground/90 block text-[10px] uppercase tracking-wider">
                      Evaluation Reasoning:
                    </span>
                    <p className="leading-relaxed">
                      {activeInspectorItem.data.relevanceExplanation}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground block font-medium">
                      Current Document State:
                    </span>
                    <div className="p-3 rounded-lg border bg-destructive/5 border-destructive/20 text-xs text-destructive leading-relaxed">
                      {activeInspectorItem.data.currentObservation}
                    </div>
                  </div>

                  <div className="text-[11px] text-muted-foreground space-y-1 pt-1">
                    <span className="font-semibold text-foreground/90 block text-[10px] uppercase tracking-wider">
                      Guidance for Improvement:
                    </span>
                    <p className="leading-relaxed">
                      {activeInspectorItem.data.actionableRecommendation}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
