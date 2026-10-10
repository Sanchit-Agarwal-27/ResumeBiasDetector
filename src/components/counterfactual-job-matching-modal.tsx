import { useState, useMemo } from "react";
import {
  Target,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Copy,
  Plus,
  FileText,
  BrainCircuit,
  ArrowUpRight,
  ShieldCheck,
  Check,
  Building,
  Briefcase,
  Layers,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  AtsMatchResult,
  JobDescriptionProfile,
  KeywordMatchEntry,
} from "@/lib/resume-contract";
import { calculateAtsMatch } from "@/lib/ats-matching-engine";
import { SAMPLE_JOB_BENCHMARKS } from "@/lib/job-benchmarks";

interface CounterfactualJobMatchingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resumeText: string;
  neutralityScore: number;
  currentMatchResult: AtsMatchResult | null;
  onApplyJobMatch: (result: AtsMatchResult) => void;
  onInsertKeywordIntoCanvas?: (keyword: string) => void;
}

export function CounterfactualJobMatchingModal({
  open,
  onOpenChange,
  resumeText,
  neutralityScore,
  currentMatchResult,
  onApplyJobMatch,
  onInsertKeywordIntoCanvas,
}: CounterfactualJobMatchingModalProps) {
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string>(
    SAMPLE_JOB_BENCHMARKS[0]?.id || "custom",
  );
  const [jobTitle, setJobTitle] = useState<string>(
    currentMatchResult?.job_profile.title || SAMPLE_JOB_BENCHMARKS[0]?.title || "",
  );
  const [companyName, setCompanyName] = useState<string>(
    currentMatchResult?.job_profile.company || SAMPLE_JOB_BENCHMARKS[0]?.company || "",
  );
  const [jobText, setJobText] = useState<string>(
    currentMatchResult?.job_profile.raw_text || SAMPLE_JOB_BENCHMARKS[0]?.raw_text || "",
  );

  const [activeTab, setActiveTab] = useState<string>("simulator");
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  // Local calculation if not yet applied or after updating text
  const [matchData, setMatchData] = useState<AtsMatchResult | null>(currentMatchResult);

  function handleSelectPreset(id: string) {
    setSelectedBenchmarkId(id);
    if (id === "custom") {
      setJobTitle("");
      setCompanyName("");
      setJobText("");
      return;
    }
    const found = SAMPLE_JOB_BENCHMARKS.find((b) => b.id === id);
    if (found) {
      setJobTitle(found.title);
      setCompanyName(found.company || "");
      setJobText(found.raw_text);
    }
  }

  function handleRunSimulation() {
    if (!jobText.trim() || jobText.trim().length < 40) {
      toast.error("Please provide a Job Description", {
        description: "Paste at least a few sentences of requirements or select a preset.",
      });
      return;
    }

    setIsSimulating(true);

    setTimeout(() => {
      const profile: JobDescriptionProfile = {
        id: selectedBenchmarkId === "custom" ? `job-${Date.now()}` : selectedBenchmarkId,
        title: jobTitle.trim() || "Target Job Position",
        company: companyName.trim() || "Enterprise Recruiter",
        raw_text: jobText,
      };

      const result = calculateAtsMatch(resumeText, profile);
      setMatchData(result);
      onApplyJobMatch(result);
      setIsSimulating(false);
      toast.success("Simulation Complete!", {
        description: `ATS Match computed: ${result.overall_match_score}% alongside Neutrality Index: ${neutralityScore}%.`,
      });
    }, 300);
  }

  function handleCopySuggestion(keyword: KeywordMatchEntry) {
    const textToCopy = `${keyword.keyword} experience`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedKeyword(keyword.keyword);
    toast.success(`Copied "${keyword.keyword}" to clipboard`, {
      description: "Paste it directly into your relevant experience bullet.",
    });
    setTimeout(() => setCopiedKeyword(null), 2000);
  }

  function handleInsertKeyword(keyword: KeywordMatchEntry) {
    if (onInsertKeywordIntoCanvas) {
      onInsertKeywordIntoCanvas(keyword.keyword);
      toast.success(`Added "${keyword.keyword}" to resume canvas`, {
        description: "New editable text block placed on your canvas.",
      });
    } else {
      handleCopySuggestion(keyword);
    }
  }

  // Active result either from prop or local run
  const activeResult = matchData || currentMatchResult;

  const scoreColor = useMemo(() => {
    if (!activeResult) return "text-primary";
    const s = activeResult.overall_match_score;
    if (s >= 80) return "text-emerald-500";
    if (s >= 65) return "text-primary";
    if (s >= 50) return "text-amber-500";
    return "text-destructive";
  }, [activeResult]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Counterfactual Job-Matching Simulator
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Simulate how ATS scanners rank your resume against enterprise job descriptions while
                preserving neutrality.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Dual Compass Live Telemetry Header */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-3 p-4 rounded-xl border bg-card/60 shadow-sm backdrop-blur-sm">
          {/* Compass 1: Neutrality Score */}
          <div className="flex items-center gap-3.5 p-3 rounded-lg border bg-background/80">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 font-mono font-bold text-lg">
              {neutralityScore}%
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Neutrality Index
                </span>
              </div>
              <p className="text-xs text-foreground/80 font-medium truncate mt-0.5">
                {neutralityScore >= 80 ? "EEOC Compliant & De-Biased" : "Audit in Progress"}
              </p>
            </div>
          </div>

          {/* Compass 2: ATS Match Score */}
          <div className="flex items-center gap-3.5 p-3 rounded-lg border bg-background/80">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-mono font-bold text-lg",
                activeResult ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {activeResult ? `${activeResult.overall_match_score}%` : "—"}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  ATS Match Score
                </span>
              </div>
              <p className="text-xs text-foreground/80 font-medium truncate mt-0.5">
                {activeResult
                  ? `${activeResult.counterfactual_simulation.ats_verdict} (${activeResult.job_profile.title})`
                  : "Paste Job Description below to simulate"}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full mb-4">
            <TabsTrigger value="simulator" className="text-xs font-medium">
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              Target Job & Input
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-xs font-medium" disabled={!activeResult}>
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Keywords & Gap Matrix
            </TabsTrigger>
            <TabsTrigger
              value="counterfactual"
              className="text-xs font-medium"
              disabled={!activeResult}
            >
              <BrainCircuit className="h-3.5 w-3.5 mr-1.5" />
              Counterfactual Projection
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Simulator & JD Input */}
          <TabsContent value="simulator" className="space-y-4">
            <div className="space-y-3 p-4 rounded-xl border bg-muted/20">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Building className="h-3.5 w-3.5 text-muted-foreground" />
                  Select Target Benchmark or Custom Role:
                </label>
                <Select value={selectedBenchmarkId} onValueChange={handleSelectPreset}>
                  <SelectTrigger className="w-full sm:w-[280px] h-8 text-xs">
                    <SelectValue placeholder="Choose a benchmark preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SAMPLE_JOB_BENCHMARKS.map((benchmark) => (
                      <SelectItem key={benchmark.id} value={benchmark.id} className="text-xs">
                        {benchmark.title} ({benchmark.target_seniority})
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="text-xs font-medium text-primary">
                      ✏️ Paste Custom Job Description
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    Job Title
                  </label>
                  <Input
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Software Engineer"
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                    Company / Industry
                  </label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Enterprise Cloud Inc."
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Job Description & Qualifications Text
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    {jobText.length} characters
                  </span>
                </div>
                <Textarea
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  placeholder="Paste the full job posting, responsibilities, and qualifications here..."
                  className="min-h-[160px] text-xs font-mono resize-y leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-[11px] text-muted-foreground">
                  Our offline NLP tokenizer will extract hard skills, competencies, and section
                  patterns.
                </p>
                <Button
                  onClick={handleRunSimulation}
                  disabled={isSimulating}
                  className="h-8 text-xs font-medium gap-1.5 shadow-sm"
                >
                  {isSimulating ? (
                    <>
                      <Sparkles className="h-3.5 w-3.5 animate-spin" />
                      Simulating ATS Ranking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Run Match Simulation
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* If result is already computed, show mini summary */}
            {activeResult && (
              <div className="p-4 rounded-xl border bg-card/60 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Latest Match: {activeResult.job_profile.title}
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Found {activeResult.matched_keywords.length} matched keywords,{" "}
                    {activeResult.missing_keywords.length} missing skill gaps.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("analysis")}
                  className="h-7 text-xs gap-1"
                >
                  View Gap Analysis
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Tab 2: Keyword & Gap Matrix */}
          {activeResult && (
            <TabsContent value="analysis" className="space-y-4">
              {/* Score Breakdown Bars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Hard Skills Match
                  </span>
                  <div className="flex items-baseline justify-between mt-1 mb-1.5">
                    <span className="text-lg font-bold font-mono">
                      {activeResult.hard_skills_score}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {
                        activeResult.matched_keywords.filter((k) => k.category === "hard_skill")
                          .length
                      }{" "}
                      matched
                    </span>
                  </div>
                  <Progress value={activeResult.hard_skills_score} className="h-1.5" />
                </div>

                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Semantic Relevance
                  </span>
                  <div className="flex items-baseline justify-between mt-1 mb-1.5">
                    <span className="text-lg font-bold font-mono">
                      {activeResult.semantic_relevance_score}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">Cosine Sim</span>
                  </div>
                  <Progress value={activeResult.semantic_relevance_score} className="h-1.5" />
                </div>

                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Soft Competencies
                  </span>
                  <div className="flex items-baseline justify-between mt-1 mb-1.5">
                    <span className="text-lg font-bold font-mono">
                      {activeResult.soft_skills_score}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">Leadership/Collab</span>
                  </div>
                  <Progress value={activeResult.soft_skills_score} className="h-1.5" />
                </div>

                <div className="p-3 rounded-lg border bg-muted/20">
                  <span className="text-[11px] text-muted-foreground block font-medium">
                    Section Structure
                  </span>
                  <div className="flex items-baseline justify-between mt-1 mb-1.5">
                    <span className="text-lg font-bold font-mono">
                      {activeResult.section_coverage.overall_structure_score}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">ATS Format</span>
                  </div>
                  <Progress
                    value={activeResult.section_coverage.overall_structure_score}
                    className="h-1.5"
                  />
                </div>
              </div>

              {/* Critical Missing Keywords */}
              <div className="p-4 rounded-xl border bg-destructive/5 border-destructive/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <h4 className="text-xs font-bold text-destructive uppercase tracking-wider">
                      Critical Missing Keywords ({activeResult.missing_keywords.length})
                    </h4>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Click a skill to insert or copy into your resume
                  </span>
                </div>

                {activeResult.missing_keywords.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    🎉 Incredible! All primary required competencies in this Job Description are
                    present in your resume.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {activeResult.missing_keywords.map((kw) => (
                      <div
                        key={kw.keyword}
                        className="group flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-destructive/30 hover:border-destructive text-xs transition-colors"
                      >
                        <span className="font-medium text-foreground">{kw.keyword}</span>
                        {kw.importance === "required" && (
                          <Badge variant="destructive" className="h-4 px-1 text-[9px] uppercase">
                            Req
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {kw.frequencyInJob}x in JD
                        </span>
                        <div className="flex items-center gap-0.5 ml-1 opacity-80 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => handleCopySuggestion(kw)}
                            title="Copy to clipboard"
                            className="p-0.5 hover:text-primary transition-colors"
                          >
                            {copiedKeyword === kw.keyword ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          {onInsertKeywordIntoCanvas && (
                            <button
                              type="button"
                              onClick={() => handleInsertKeyword(kw)}
                              title="Add as block on canvas"
                              className="p-0.5 hover:text-primary transition-colors"
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Matched Keywords */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Matched Skills & Keywords ({activeResult.matched_keywords.length})
                  </h4>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {activeResult.matched_keywords.map((kw) => (
                    <div
                      key={kw.keyword}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground"
                    >
                      <span className="font-medium">{kw.keyword}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                        {kw.frequencyInResume}x in resume
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          )}

          {/* Tab 3: Counterfactual Projection */}
          {activeResult && (
            <TabsContent value="counterfactual" className="space-y-4">
              <div className="p-4 rounded-xl border bg-card/60 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <TrendingUp className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Algorithmic Counterfactual Projection
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      What happens to candidate ranking when applying de-biasing rewrites?
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-lg border bg-background text-center">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      Current Raw Baseline
                    </span>
                    <p className="text-xl font-bold font-mono mt-1">
                      {activeResult.counterfactual_simulation.baseline_ats_score}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-primary/5 border-primary/20 text-center">
                    <span className="text-[10px] text-primary uppercase font-semibold">
                      De-Biased Potential
                    </span>
                    <p className="text-xl font-bold font-mono text-primary mt-1">
                      {activeResult.counterfactual_simulation.debiased_ats_score}%
                    </p>
                  </div>
                  <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 text-center">
                    <span className="text-[10px] text-emerald-600 uppercase font-semibold">
                      Net Gain
                    </span>
                    <p className="text-xl font-bold font-mono text-emerald-600 mt-1">
                      +{activeResult.counterfactual_simulation.score_delta}%
                    </p>
                  </div>
                </div>

                <div className="p-3 rounded-lg border bg-muted/30 text-xs leading-relaxed space-y-1.5">
                  <p className="font-medium text-foreground">
                    {activeResult.counterfactual_simulation.net_verdict_explanation}
                  </p>
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider block">
                    Strategic ATS Optimization Steps:
                  </span>
                  <ul className="space-y-1.5">
                    {activeResult.counterfactual_simulation.recommendations.map((rec, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                        <ArrowUpRight className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
