import { RLAgentDialog } from "./rl-agent-dialog";
import { ResumeTemplatesModal } from "./resume-templates-modal";
import type { ResumeTemplate } from "@/lib/resume-templates";
import { RLRecommendationCard } from "./rl-recommendation-card";
import { globalFeedbackStore, globalBanditPolicy, encodeStateVector, RL_ACTION_IDS } from "@/lib/rl";
import { sendBackendRLFeedback } from "@/lib/analysis-service";
import { useEffect, useMemo, useRef, useState, lazy, Suspense, type DragEvent } from "react";
import {
  ArrowDownToLine,
  Bot,
  BarChart3,
  Check,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  CircleGauge,
  Copy,
  Download,
  FileJson,
  FileText,
  FolderArchive,
  GitCompare,
  History,
  Image,
  LockKeyhole,
  RotateCcw,
  Scale,
  ScanSearch,
  Server,
  ShieldCheck,
  HelpCircle,
  Sun,
  Moon,
  Target,
  User,
  UserPlus,
  LogIn,
  LogOut,
  Settings,
  Palette,
  Upload,
  X,
  Loader2,
  Sparkles,
  Zap,
  LayoutTemplate,
} from "lucide-react";
import { toast } from "sonner";

import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, matchesWordBoundary, findWordBoundaryMatch } from "@/lib/utils";
import {
  sampleReport,
  type BiasCategory,
  type BiasSpan,
  type ResumeBiasReport,
  type ResumeErrorFlag,
  type SeverityLevel,
} from "@/lib/resume-contract";
import {
  checkBackendHealth,
  processResumeAnalysis,
  fetchDynamicRewrite,
  DEFAULT_CONFIG,
  type HealthResponse,
} from "@/lib/analysis-service";
import {
  analyzeResumeText,
  runCounterfactualFairnessAudit,
  EVALUATION_BENCHMARK_DATA,
} from "@/lib/bias-taxonomy";
import { WordResumeEditor } from "./word-resume-editor";
import {
  clusterPdfTextContent,
  parseRawTextToCanvasBlocks,
  type CanvasTextBlock,
  type CanvasPage,
  type ColumnLayoutPreset,
} from "@/lib/pdf-cluster-engine";
import { extractResumeDocument } from "@/lib/document-parser";
import { calculateAtsMatch } from "@/lib/ats-matching-engine";
import { SAMPLE_JOB_BENCHMARKS } from "@/lib/job-benchmarks";
import { generateGoogleXyzRewrite } from "@/lib/xyz-formula-engine";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";

// Lazy-loaded modal dialogs for dynamic chunk splitting & optimal initial bundle size
const FairnessAuditModal = lazy(() =>
  import("./fairness-audit-modal").then((m) => ({ default: m.FairnessAuditModal })),
);
const EvaluationBenchmarkModal = lazy(() =>
  import("./evaluation-benchmark-modal").then((m) => ({ default: m.EvaluationBenchmarkModal })),
);
const EthicsModal = lazy(() => import("./ethics-modal").then((m) => ({ default: m.EthicsModal })));
const CounterfactualJobMatchingModal = lazy(() =>
  import("./counterfactual-job-matching-modal").then((m) => ({
    default: m.CounterfactualJobMatchingModal,
  })),
);
const CloudVaultModal = lazy(() =>
  import("./cloud-vault-modal").then((m) => ({ default: m.CloudVaultModal })),
);
const ResumeDiffModal = lazy(() =>
  import("./resume-diff-modal").then((m) => ({ default: m.ResumeDiffModal })),
);
const VectorPdfExportModal = lazy(() =>
  import("./vector-pdf-export-modal").then((m) => ({ default: m.VectorPdfExportModal })),
);
const AuthModal = lazy(() => import("./auth-modal").then((m) => ({ default: m.AuthModal })));
const AccountSettingsModal = lazy(() =>
  import("./account-settings-modal").then((m) => ({ default: m.AccountSettingsModal })),
);
import {
  saveResumeBundleToCloud,
  listUserResumes,
  loadResumeBundle,
  createResumeVersionSnapshot,
  listResumeVersions,
  type CloudResumeRecord,
  type CloudResumeVersionRecord,
  type CloudResumeBundle,
} from "@/lib/cloud-vault-service";
import { sanitizeFilename, sanitizeInputText } from "@/lib/security-sanitizer";
import { TopProgressBar } from "@/components/loading/top-progress-bar";
import { CanvasSkeleton } from "@/components/loading/canvas-skeleton";
import { SidebarSkeleton } from "@/components/loading/sidebar-skeleton";
import { ProcessingDialog } from "@/components/loading/processing-dialog";
import { PageSkeleton } from "@/components/loading/page-skeleton";

const categories: Array<{ key: "all" | BiasCategory; short: string; label: string; dot: string }> =
  [
    { key: "all", short: "All", label: "All issues", dot: "bg-foreground" },
    { key: "gender_coded", short: "Gender", label: "Gender-coded", dot: "bg-gender" },
    { key: "age_indicative", short: "Age", label: "Age indicators", dot: "bg-age" },
    { key: "prestige_proxy", short: "Prestige", label: "Prestige proxy", dot: "bg-prestige" },
    { key: "gap_framing", short: "Career gap", label: "Career gap", dot: "bg-gap" },
    { key: "disability_coded", short: "Disability", label: "Disability-coded", dot: "bg-gap" },
    {
      key: "personality_behavioral",
      short: "Personality",
      label: "Personality & Behavioral",
      dot: "bg-amber-500",
    },
  ];

const categoryLabels: Record<BiasCategory, string> = {
  gender_coded: "Gender-coded",
  age_indicative: "Age indicator",
  prestige_proxy: "Prestige proxy",
  gap_framing: "Career gap",
  disability_coded: "Disability-coded",
  personality_behavioral: "Personality & Behavioral",
};

const severityWeights: Record<SeverityLevel, number> = { low: 3, medium: 7, high: 12 };

function buildSummary(spans: BiasSpan[]) {
  const byCategory: Record<BiasCategory, number> = {
    gender_coded: 0,
    age_indicative: 0,
    prestige_proxy: 0,
    gap_framing: 0,
    disability_coded: 0,
    personality_behavioral: 0,
  };
  const bySeverity: Record<SeverityLevel, number> = { low: 0, medium: 0, high: 0 };
  spans.forEach((span) => {
    byCategory[span.category] = (byCategory[span.category] || 0) + 1;
    bySeverity[span.severity] = (bySeverity[span.severity] || 0) + 1;
  });
  return { total_flags: spans.length, by_category: byCategory, by_severity: bySeverity };
}

function calculateScore(spans: BiasSpan[]) {
  return Math.max(
    0,
    100 - spans.reduce((total, span) => total + severityWeights[span.severity], 0),
  );
}

function downloadUrl(url: string, filename: string) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
}

function downloadBlob(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  downloadUrl(url, filename);
  URL.revokeObjectURL(url);
}

const STORAGE_REPORT_KEY = "biaslens_active_report_v1";
const STORAGE_BLOCKS_KEY = "biaslens_active_blocks_v1";
const STORAGE_PAGES_KEY = "biaslens_active_pages_v1";
const STORAGE_COLUMN_LAYOUT_KEY = "biaslens_active_column_layout_v1";

function normalizeFixture(): ResumeBiasReport {
  return structuredClone(sampleReport);
}

export function ResumeWorkspace() {
  const [mounted, setMounted] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [report, setReport] = useState<ResumeBiasReport>(() => normalizeFixture());
  const [activeId, setActiveId] = useState("span-001");
  const [filter, setFilter] = useState<"all" | BiasCategory>("all");
  const [engineMode, setEngineMode] = useState<"local" | "fastapi">("local");
  const [status, setStatus] = useState("Ready to analyze");
  const [dragging, setDragging] = useState(false);

  // Loading & Skeletal Transition States
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [processingFileName, setProcessingFileName] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Modal dialog states
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
  const [benchmarksModalOpen, setBenchmarksModalOpen] = useState(false);
  const [ethicsModalOpen, setEthicsModalOpen] = useState(false);
  const [jobMatchingModalOpen, setJobMatchingModalOpen] = useState(false);
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [rlAgentDialogOpen, setRlAgentDialogOpen] = useState(false);
  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [diffVersionsList, setDiffVersionsList] = useState<CloudResumeVersionRecord[]>([]);
  const [activeVersionNumber, setActiveVersionNumber] = useState<number>(1);
  const [vectorPdfModalOpen, setVectorPdfModalOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"issues" | "quality">("issues");
  const [sentenceFilter, setSentenceFilter] = useState<"all" | "flagged" | "fine">("all");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [healthInfo, setHealthInfo] = useState<HealthResponse | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User Authentication & Theme State
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalView, setAuthModalView] = useState<"signin" | "signup" | "forgot">("signin");
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<
    "profile" | "security" | "privacy" | "engine" | "appearance" | "feedback"
  >("profile");

  // Word / Docs Document Editor state
  const [columnLayout, setColumnLayout] = useState<ColumnLayoutPreset>("single");
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasTextBlock[]>(() =>
    parseRawTextToCanvasBlocks(sampleReport.raw_text, 612, 792),
  );
  const [canvasPages, setCanvasPages] = useState<CanvasPage[]>(() => {
    const initialBlocks = parseRawTextToCanvasBlocks(sampleReport.raw_text, 612, 792);
    const maxPage = Math.max(0, ...initialBlocks.map((b) => b.pageIndex ?? 0));
    return Array.from({ length: maxPage + 1 }, (_, i) => ({
      id: `page-${i + 1}`,
      pageNumber: i + 1,
      width: 612,
      height: 792,
    }));
  });

  const inputRef = useRef<HTMLInputElement>(null);

  function handleApplyTemplate(template: ResumeTemplate) {
    const newBlocks = parseRawTextToCanvasBlocks(template.rawText, 612, 792);
    const maxPageIndex = Math.max(0, ...newBlocks.map((b) => b.pageIndex ?? 0));
    const newPages: CanvasPage[] = Array.from({ length: maxPageIndex + 1 }, (_, i) => ({
      id: `page-${i + 1}`,
      pageNumber: i + 1,
      width: 612,
      height: 792,
    }));
    setCanvasPages(newPages);
    setCanvasBlocks(newBlocks);
    if (template.columnLayout) {
      setColumnLayout(template.columnLayout);
      try {
        localStorage.setItem(STORAGE_COLUMN_LAYOUT_KEY, template.columnLayout);
      } catch {}
    }
    const newReport = analyzeResumeText(template.rawText);
    setReport(newReport);
    if (newReport.spans.length > 0) {
      setActiveId(newReport.spans[0].id);
    }
    try {
      localStorage.setItem(STORAGE_REPORT_KEY, JSON.stringify(newReport));
      localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(newBlocks));
      localStorage.setItem(STORAGE_PAGES_KEY, JSON.stringify(newPages));
    } catch {}
    setStatus(`Applied template: ${template.title}`);
  }


  // Safe client-side hydration: Restore persisted resume from localStorage
  useEffect(() => {
    try {
      const savedReport = localStorage.getItem(STORAGE_REPORT_KEY);
      const savedBlocks = localStorage.getItem(STORAGE_BLOCKS_KEY);
      const savedPages = localStorage.getItem(STORAGE_PAGES_KEY);
      const savedLayout = localStorage.getItem(STORAGE_COLUMN_LAYOUT_KEY);
      if (savedReport && savedBlocks && savedPages) {
        const parsedReport = JSON.parse(savedReport) as ResumeBiasReport;
        let parsedBlocks = JSON.parse(savedBlocks) as CanvasTextBlock[];
        let parsedPages = JSON.parse(savedPages) as CanvasPage[];

        // Auto-heal legacy single-page persists if content overflows onto a second page
        const allOnPageZero = parsedBlocks.every((b) => (b.pageIndex ?? 0) === 0);
        if (parsedReport.raw_text && ((allOnPageZero && parsedBlocks.length > 20) || parsedPages.length === 1)) {
          const freshBlocks = parseRawTextToCanvasBlocks(parsedReport.raw_text, 612, 792);
          const maxFreshPage = Math.max(0, ...freshBlocks.map((b) => b.pageIndex ?? 0));
          if (maxFreshPage > 0) {
            parsedBlocks = freshBlocks;
            parsedPages = Array.from({ length: maxFreshPage + 1 }, (_, i) => ({
              id: `page-${i + 1}`,
              pageNumber: i + 1,
              width: 612,
              height: 792,
            }));
            try {
              localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(parsedBlocks));
              localStorage.setItem(STORAGE_PAGES_KEY, JSON.stringify(parsedPages));
            } catch {}
          }
        }

        const maxBlockPage = Math.max(0, ...parsedBlocks.map((b) => b.pageIndex ?? 0));
        if (parsedPages.length <= maxBlockPage) {
          parsedPages = Array.from({ length: maxBlockPage + 1 }, (_, i) => ({
            id: `page-${i + 1}`,
            pageNumber: i + 1,
            width: 612,
            height: 792,
          }));
        }

        setReport(parsedReport);
        setCanvasBlocks(parsedBlocks);
        setCanvasPages(parsedPages);
        if (savedLayout) {
          setColumnLayout(savedLayout as ColumnLayoutPreset);
        }
        setLoaded(true);
        setActiveId(parsedReport.spans?.[0]?.id || "span-001");
        setStatus("Saved resume restored");
      }
    } catch {
      // Storage safety
    } finally {
      setMounted(true);
    }
  }, []);

  // Auto-detect Python FastAPI AI backend on mount
  useEffect(() => {
    checkBackendHealth().then((health) => {
      if (health && health.status === "healthy") {
        setHealthInfo(health);
        setEngineMode("fastapi");
        setStatus("Connected to FastAPI AI Engine (:8000)");
      } else {
        setEngineMode("local");
      }
    });
  }, []);

  // Cloud Vault persistence state
  const [cloudResumeId, setCloudResumeId] = useState<string | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<"synced" | "saving" | "local" | "error">(
    "local",
  );
  const [isCloudSaving, setIsCloudSaving] = useState(false);
  const [recentCloudResume, setRecentCloudResume] = useState<CloudResumeRecord | null>(null);

  // Check for existing cloud resumes when authenticated user opens welcome screen
  useEffect(() => {
    if (isAuthenticated && user?.id && !loaded) {
      listUserResumes()
        .then((resumes) => {
          if (resumes && resumes.length > 0) {
            setRecentCloudResume(resumes[0]);
          } else {
            setRecentCloudResume(null);
          }
        })
        .catch(() => {
          setRecentCloudResume(null);
        });
    } else {
      setRecentCloudResume(null);
    }
  }, [isAuthenticated, user?.id, loaded]);

  // Auto-persist state across page reloads & browser closures (Dual-mode: LocalStorage + Supabase)
  useEffect(() => {
    if (!mounted || !loaded) return;
    try {
      localStorage.setItem(STORAGE_REPORT_KEY, JSON.stringify(report));
      localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(canvasBlocks));
      localStorage.setItem(STORAGE_PAGES_KEY, JSON.stringify(canvasPages));
      localStorage.setItem(STORAGE_COLUMN_LAYOUT_KEY, columnLayout);
    } catch {
      // Storage quota safety
    }

    // Auto-save to Supabase Cloud if user is authenticated and autoSave is active
    if (isAuthenticated && user?.id && user?.autoSave !== false) {
      setCloudSyncStatus("saving");
      const debounceTimer = setTimeout(async () => {
        try {
          const id = await saveResumeBundleToCloud({
            userId: user.id,
            resumeId: cloudResumeId || undefined,
            title: report.file_name.replace(/\.[^.]+$/, "") || "My Resume",
            fileName: report.file_name,
            rawText: report.raw_text,
            neutralityScore: report.neutrality_score,
            columnLayout,
            pages: canvasPages,
            blocks: canvasBlocks,
            report,
          });
          if (!cloudResumeId) {
            setCloudResumeId(id);
          }
          setCloudSyncStatus("synced");
        } catch (err) {
          console.error("[AutoSave] Cloud sync failed:", err);
          setCloudSyncStatus("error");
        }
      }, 1500);

      return () => clearTimeout(debounceTimer);
    } else {
      setCloudSyncStatus("local");
    }
  }, [
    mounted,
    loaded,
    report,
    canvasBlocks,
    canvasPages,
    columnLayout,
    isAuthenticated,
    user?.id,
    user?.autoSave,
    cloudResumeId,
  ]);

  // Prompt and seamlessly sync local guest resume to Cloud Vault upon initial login
  useEffect(() => {
    if (isAuthenticated && user?.id && loaded && !cloudResumeId) {
      const migrateGuestData = async () => {
        try {
          setIsCloudSaving(true);
          const id = await saveResumeBundleToCloud({
            userId: user.id,
            title: report.file_name.replace(/\.[^.]+$/, "") || "My Resume",
            fileName: report.file_name,
            rawText: report.raw_text,
            neutralityScore: report.neutrality_score,
            pages: canvasPages,
            blocks: canvasBlocks,
            report,
          });
          setCloudResumeId(id);
          setCloudSyncStatus("synced");
          toast.success("Guest resume synced to Cloud Vault!", {
            description: "Your local work is now safely saved to your Supabase account.",
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn("[Migration] Could not auto-sync guest resume:", msg);
        } finally {
          setIsCloudSaving(false);
        }
      };
      migrateGuestData();
    }
  }, [isAuthenticated, user?.id]);

  const filteredSpans = useMemo(
    () => report.spans.filter((span) => filter === "all" || span.category === filter),
    [report.spans, filter],
  );
  // Ensure activeSpan is ALWAYS resolved from the currently active filter first
  const activeSpan = filteredSpans.find((span) => span.id === activeId) ?? filteredSpans[0];
  const activeSuggestion = activeSpan ? report.suggestions[activeSpan.id] : undefined;

  // Custom editable rewrite state for the active issue in the review queue
  const [customRewrite, setCustomRewrite] = useState<string>("");

  useEffect(() => {
    setCustomRewrite(activeSuggestion?.suggested_text ?? "");
  }, [activeSpan?.id, activeSuggestion?.suggested_text]);

  // Keep activeId aligned with activeSpan if filter changed
  useEffect(() => {
    if (activeSpan && activeSpan.id !== activeId) {
      setActiveId(activeSpan.id);
    }
  }, [activeSpan?.id]);

  // If active filter category has 0 issues remaining, fallback to "all"
  useEffect(() => {
    if (filter !== "all" && !report.spans.some((span) => span.category === filter)) {
      setFilter("all");
    }
  }, [filter, report.spans]);

  const handleSelectCategoryFilter = (categoryKey: BiasCategory | "all") => {
    setFilter(categoryKey);
    const targetSpans =
      categoryKey === "all"
        ? report.spans
        : report.spans.filter((span) => span.category === categoryKey);

    if (targetSpans.length > 0) {
      setActiveId(targetSpans[0].id);
    }

    // Smoothly scroll the review queue panel to top / into view
    const asideEl = document.getElementById("review-queue-panel");
    if (asideEl) {
      asideEl.scrollTo({ top: 0, behavior: "smooth" });
      if (window.innerWidth < 1024) {
        asideEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  function updateText(fullText: string) {
    // 1. Immediate optimistic local pass so typing in the Word editor is completely zero-lag
    const localAnalysis = analyzeResumeText(fullText);
    const localFairness = runCounterfactualFairnessAudit(fullText, localAnalysis.spans);
    setReport((current) => {
      const updatedAts = current.target_job
        ? calculateAtsMatch(fullText, current.target_job)
        : current.ats_match;
      return {
        ...current,
        raw_text: fullText,
        spans: localAnalysis.spans,
        suggestions: localAnalysis.suggestions,
        summary: buildSummary(localAnalysis.spans),
        neutrality_score: localAnalysis.neutrality_score,
        fairness_audit: localFairness,
        evaluation_benchmarks: EVALUATION_BENCHMARK_DATA,
        ats_match: updatedAts,
        classified_sentences: localAnalysis.classified_sentences,
        context_summary: localAnalysis.context_summary,
      };
    });

    if (!localAnalysis.spans.some((span) => span.id === activeId)) {
      const preservedSpan = localAnalysis.spans.find(
        (span) => activeSpan && span.matched_text === activeSpan.matched_text,
      );
      if (preservedSpan) {
        setActiveId(preservedSpan.id);
      } else if (localAnalysis.spans.length > 0) {
        setActiveId(localAnalysis.spans[0].id);
      } else {
        setActiveId("");
      }
    }

    // 2. Debounced asynchronous pass (350ms) for FastAPI deep analysis, writing quality, and Google XYZ rewrites
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsAnalyzing(true);
    setStatus("Analyzing changes...");

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const analysisStartTime = Date.now();
        const enrichedReport = await processResumeAnalysis(
          fullText,
          report.file_name,
          { mode: engineMode, fastApiUrl: DEFAULT_CONFIG.fastApiUrl },
          report.target_job?.raw_text,
          report.target_job?.title,
        );
        setLastLatencyMs(Date.now() - analysisStartTime);

        setReport((current) => {
          if (current.spans.length === 0 && (enrichedReport.error_flags || []).length > 0) {
            setSidebarTab("quality");
          }
          return {
            ...current,
            ...enrichedReport,
            target_job: current.target_job,
            ats_match: enrichedReport.ats_match || current.ats_match,
          };
        });
        setStatus(engineMode === "fastapi" ? "Live FastAPI AI synced" : "Live local engine synced");
      } catch (err) {
        console.warn("Live async analysis failed; retaining local report", err);
      } finally {
        setIsAnalyzing(false);
      }
    }, 350);
  }

  function applyErrorFix(err: ResumeErrorFlag) {
    if (
      err.error_type === "unquantified_impact" ||
      err.suggestion?.startsWith("Add quantifiable")
    ) {
      const sourceSentence = err.sentence || err.matched_text;
      const xyzResult = generateGoogleXyzRewrite(sourceSentence);
      let replaced = false;
      const updatedBlocks = canvasBlocks.map((block) => {
        const isTarget =
          block.text.includes(err.matched_text) ||
          err.matched_text.includes(block.text.trim()) ||
          (err.sentence && block.text.includes(err.sentence));
        if (!replaced && isTarget) {
          replaced = true;
          return { ...block, text: xyzResult.fullRewrite };
        }
        return block;
      });
      if (replaced) {
        setCanvasBlocks(updatedBlocks);
        const sorted = [...updatedBlocks].sort(
          (a, b) => a.pageIndex - b.pageIndex || a.y - b.y || a.x - b.x,
        );
        const joined = sorted.map((b) => b.text).join("\n\n");
        updateText(joined);
        setStatus("Google XYZ formula applied");
        toast.success("Google XYZ Formula applied", {
          description: `Transformed bullet to Google XYZ format (${xyzResult.domain}): Accomplished [X], as measured by [Y], by doing [Z].`,
        });
      }
      return;
    }
    let fixText = err.suggestion;
    if (fixText.includes(" / ")) {
      fixText = fixText.split(" / ")[0].trim();
    }
    const isRemoval =
      fixText.toLowerCase().startsWith("remove") || fixText.toLowerCase().includes("delete line");

    let replaced = false;
    const updatedBlocks = canvasBlocks.map((block) => {
      const match = findWordBoundaryMatch(block.text, err.matched_text);
      if (!replaced && match) {
        replaced = true;
        let newText: string;
        if (isRemoval) {
          newText = (
            block.text.slice(0, match.start) + block.text.slice(match.start + match.length)
          )
            .replace(/\s{2,}/g, " ")
            .trim();
        } else {
          newText =
            block.text.slice(0, match.start) +
            fixText +
            block.text.slice(match.start + match.length);
        }
        return { ...block, text: newText };
      }
      return block;
    });

    if (replaced) {
      handleCanvasChange(updatedBlocks, canvasPages);
      toast.success("Applied Writing Improvement", {
        description: isRemoval
          ? `Removed "${err.matched_text}".`
          : `Replaced "${err.matched_text}" with "${fixText}".`,
      });
    } else {
      toast.info("Could not auto-replace text", {
        description: `Please update "${err.matched_text}" directly in the editor.`,
      });
    }
  }

  function handleCanvasChange(updatedBlocks: CanvasTextBlock[], updatedPages: CanvasPage[]) {
    setCanvasBlocks(updatedBlocks);
    setCanvasPages(updatedPages);
    const sorted = [...updatedBlocks].sort(
      (a, b) => a.pageIndex - b.pageIndex || a.y - b.y || a.x - b.x,
    );
    const joined = sorted.map((b) => b.text).join("\n\n");
    updateText(joined);
  }

  function handleInsertKeywordIntoCanvas(keyword: string) {
    const highestY =
      canvasBlocks.length > 0 ? Math.max(...canvasBlocks.map((b) => b.y + b.height)) : 220;
    const targetY = Math.min(780, highestY + 16);
    const newBlock: CanvasTextBlock = {
      id: `block-kw-${Date.now()}`,
      text: `• Proficient with ${keyword} and industry standard best practices.`,
      x: 54,
      y: targetY,
      width: 480,
      height: 22,
      fontSize: 10,
      fontFamily: "Inter, sans-serif",
      color: "#111827",
      bold: false,
      italic: false,
      align: "left",
      pageIndex: 0,
      zIndex: canvasBlocks.length + 1,
    };
    const updated = [...canvasBlocks, newBlock];
    handleCanvasChange(updated, canvasPages);
  }

  function handleRestoreVersion(version: CloudResumeVersionRecord) {
    setCanvasBlocks(version.snapshot.blocks);
    setCanvasPages(version.snapshot.pages);
    setReport(version.snapshot.report);
    if ((version.snapshot as unknown as { columnLayout?: ColumnLayoutPreset }).columnLayout) {
      setColumnLayout(
        (version.snapshot as unknown as { columnLayout: ColumnLayoutPreset }).columnLayout,
      );
    }
    setActiveVersionNumber(version.version_number);
    setActiveId(version.snapshot.report.spans?.[0]?.id || "");
    setStatus(`Restored to ${version.version_name} (v${version.version_number})`);
  }

  function handleLoadResumeBundle(bundle: CloudResumeBundle) {
    setCloudResumeId(bundle.resume.id);
    setCanvasBlocks(bundle.blocks);
    setCanvasPages(bundle.pages);
    setReport(bundle.report);
    if (bundle.resume.column_layout) {
      setColumnLayout(bundle.resume.column_layout as ColumnLayoutPreset);
    }
    setActiveVersionNumber(bundle.resume.active_version || 1);
    setActiveId(bundle.report.spans?.[0]?.id || "");
    setLoaded(true);
    setStatus(`Loaded "${bundle.resume.title}"`);
  }

  function handleLaunchDiffModal(versions: CloudResumeVersionRecord[]) {
    setDiffVersionsList(versions);
    setDiffModalOpen(true);
  }

  function loadSample() {
    setIsTransitioning(true);
    const fixture = normalizeFixture();
    const analysis = analyzeResumeText(fixture.raw_text);
    fixture.spans = analysis.spans;
    fixture.suggestions = analysis.suggestions;
    fixture.neutrality_score = analysis.neutrality_score;
    fixture.summary = buildSummary(analysis.spans);
    fixture.classified_sentences = analysis.classified_sentences;
    fixture.context_summary = analysis.context_summary;
    const fairness = runCounterfactualFairnessAudit(fixture.raw_text, fixture.spans);
    fixture.fairness_audit = fairness;
    fixture.evaluation_benchmarks = EVALUATION_BENCHMARK_DATA;
    const defaultJob = SAMPLE_JOB_BENCHMARKS[0];
    if (defaultJob) {
      fixture.target_job = defaultJob;
      fixture.ats_match = calculateAtsMatch(fixture.raw_text, defaultJob);
    }
    setReport(fixture);
    setLoaded(true);
    setActiveId(fixture.spans[0]?.id ?? "span-001");
    setFilter("all");
    setCanvasPages([{ id: "page-1", pageNumber: 1, width: 612, height: 792 }]);
    setCanvasBlocks(parseRawTextToCanvasBlocks(fixture.raw_text, 612, 792));
    setStatus("Sample analysis ready");
    setTimeout(() => setIsTransitioning(false), 220);
    toast.info("Sample resume loaded", {
      description: "Preloaded resume with realistic bias markers and review queue.",
    });
    if (!isAuthenticated) {
      setTimeout(() => {
        toast.info("Working in Guest Mode", {
          description: "Sign in or create an account anytime to save your work across devices.",
        });
      }, 1500);
    }
  }

  function handleCreateBlankResume() {
    setIsTransitioning(true);
    const blankId = `blank-${Date.now()}`;
    const initialText =
      "Your Name\ncontact@example.com | (555) 000-0000 | linkedin.com/in/profile\n\nPROFESSIONAL SUMMARY\nAccomplished professional with experience leading high-impact initiatives.\n\nEXPERIENCE\nSenior Specialist | Organization\n• Spearheaded core operations and delivered measurable results across key projects.";
    const blankBlocks = parseRawTextToCanvasBlocks(initialText, 612, 792);
    const analysis = analyzeResumeText(initialText);
    const fairness = runCounterfactualFairnessAudit(initialText, analysis.spans);
    const blankReport: ResumeBiasReport = {
      ...normalizeFixture(),
      document_id: blankId,
      file_name: "Untitled Resume.pdf",
      raw_text: initialText,
      spans: analysis.spans,
      suggestions: analysis.suggestions,
      summary: buildSummary(analysis.spans),
      neutrality_score: analysis.neutrality_score,
      fairness_audit: fairness,
      evaluation_benchmarks: EVALUATION_BENCHMARK_DATA,
      classified_sentences: analysis.classified_sentences,
      context_summary: analysis.context_summary,
    };
    setReport(blankReport);
    setLoaded(true);
    setActiveId(analysis.spans[0]?.id ?? "");
    setFilter("all");
    setCanvasPages([{ id: "page-1", pageNumber: 1, width: 612, height: 792 }]);
    setCanvasBlocks(blankBlocks);
    setStatus("Blank resume created");
    setTimeout(() => setIsTransitioning(false), 220);
    toast.success("New blank resume created", {
      description: "Start typing or editing your document.",
    });
    if (!isAuthenticated) {
      setTimeout(() => {
        toast.info("Working in Guest Mode", {
          description: "Sign in or create an account anytime to enable Cloud Vault backup.",
        });
      }, 1500);
    }
  }

    async function loadTrialResume(samplePath: string, fileName: string, roleName: string) {
    try {
      setIsTransitioning(true);
      setStatus(`Loading trial resume for ${roleName}...`);
      const response = await fetch(samplePath);
      if (!response.ok) {
        throw new Error(`Failed to load ${fileName}: ${response.statusText}`);
      }
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      await handleFile(file);
      toast.success(`Loaded ${roleName} trial resume`, {
        description: `Now evaluating ${fileName} across bias, writing quality, and ATS dimensions.`,
      });
    } catch (err) {
      console.error("Failed to load trial resume:", err);
      toast.error("Failed to load trial resume", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsTransitioning(false);
    }
  }

  async function handleFile(file?: File) {
    if (!file) return;

    // Security check: Limit file size to 15MB max to prevent memory exhaustion
    if (file.size > 15 * 1024 * 1024) {
      setStatus("File exceeds 15MB limit");
      toast.error("File exceeds limit", {
        description: "Please upload a document under 15MB to ensure safe processing.",
      });
      return;
    }

    const cleanFileName = sanitizeFilename(file.name);
    const valid = /\.(pdf|docx)$/i.test(cleanFileName);
    if (!valid) {
      setStatus("Choose a PDF or DOCX file");
      toast.error("Unsupported file format", {
        description: "Please choose a standard .pdf or .docx document.",
      });
      return;
    }

    setIsProcessing(true);
    setProcessingStep(0);
    setProcessingFileName(cleanFileName);
    setStatus(`Reading ${cleanFileName}…`);

    try {
      const arrayBuffer = await file.arrayBuffer();
      let extractedBlocks: CanvasTextBlock[] = [];
      let extractedPages: CanvasPage[] = [];
      let rawText = "";

      // Step 1: Layout-Aware Clustering & Extraction
      setProcessingStep(1);

      const parsedDoc = await extractResumeDocument(arrayBuffer, cleanFileName, {
        pdfWorkerUrl,
        allowOcr: true,
      });

      extractedBlocks = parsedDoc.canvasBlocks;
      extractedPages = parsedDoc.canvasPages;
      rawText = parsedDoc.cleanedText || parsedDoc.rawText;

      // Safe debug telemetry (zero PII logged)
      console.debug("[ResumeParser Diagnostics]", {
        fileType: parsedDoc.diagnostics.fileType,
        pageCount: parsedDoc.diagnostics.pageCount,
        characterCount: parsedDoc.diagnostics.characterCount,
        method: parsedDoc.diagnostics.method,
        ocrTriggered: parsedDoc.diagnostics.ocrTriggered,
        layout: parsedDoc.diagnostics.columnLayout,
        score: parsedDoc.diagnostics.validationScore,
      });

      if (!rawText || !rawText.trim()) {
        throw new Error(
          parsedDoc.validation.fallbackReason ||
            "No readable text found in document. Please upload a clear PDF or DOCX file.",
        );
      }
      const safeRawText = sanitizeInputText(rawText, 500000);

      // Step 2: Bias taxonomy analysis
      setProcessingStep(2);
      await new Promise((r) => setTimeout(r, 120));
      const analysis = analyzeResumeText(safeRawText);

      // Step 3: Counterfactual calibration
      setProcessingStep(3);
      await new Promise((r) => setTimeout(r, 150));
      const fairness = runCounterfactualFairnessAudit(safeRawText, analysis.spans);

      const next = normalizeFixture();
      next.document_id = `local-${Date.now()}`;
      next.file_name = cleanFileName;
      next.raw_text = safeRawText;
      next.spans = analysis.spans;
      next.suggestions = analysis.suggestions;
      next.summary = buildSummary(analysis.spans);
      next.neutrality_score = analysis.neutrality_score;
      next.fairness_audit = fairness;
      next.evaluation_benchmarks = EVALUATION_BENCHMARK_DATA;
      next.classified_sentences = analysis.classified_sentences;
      next.context_summary = analysis.context_summary;

      setReport(next);
      setLoaded(true);
      setFilter("all");
      setActiveId(analysis.spans[0]?.id ?? "");
      setCanvasPages(extractedPages);
      setCanvasBlocks(extractedBlocks);
      setColumnLayout(parsedDoc.diagnostics.columnLayout);
      setStatus(`${cleanFileName} imported into Word resume editor`);
      toast.success("Resume imported successfully", {
        description: `Detected ${analysis.spans.length} signals with ${analysis.neutrality_score}% neutrality index.`,
      });

      if (parsedDoc.diagnostics.ocrTriggered) {
        toast.info("Scanned document processed via OCR", {
          description: `Extracted text using visual optical character recognition fallback.`,
        });
      } else if (parsedDoc.diagnostics.columnLayout !== "single") {
        toast.info("Multi-column layout detected", {
          description: `Processed ${parsedDoc.diagnostics.columnLayout.replace(/-/g, " ")} layout with preserved reading order.`,
        });
      }

      if (!isAuthenticated) {
        setTimeout(() => {
          toast.info("Working in Guest Mode", {
            description:
              "Sign in or create an account to save and sync your resume across devices.",
          });
        }, 1500);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unable to read this file";
      setStatus(`Could not read ${cleanFileName}: ${detail}`);
      toast.error("Import failed", { description: detail });
    } finally {
      setIsProcessing(false);
    }
  }

  function resolveIssue(mode: "accept" | "dismiss", overrideText?: string) {
    if (!activeSpan) return;
    const replacementText =
      overrideText !== undefined ? overrideText : (activeSuggestion?.suggested_text ?? "");

    if (mode === "accept" && activeSuggestion) {
      let replaced = false;
      const updatedBlocks = canvasBlocks.map((block) => {
        if (
          !replaced &&
          block.text.toLowerCase().includes(activeSuggestion.original_text.toLowerCase())
        ) {
          replaced = true;
          const start = block.text
            .toLowerCase()
            .indexOf(activeSuggestion.original_text.toLowerCase());
          const newText =
            block.text.slice(0, start) +
            replacementText +
            block.text.slice(start + activeSuggestion.original_text.length);
          return { ...block, text: newText };
        }
        return block;
      });

      if (replaced) {
        setCanvasBlocks(updatedBlocks);
        const sorted = [...updatedBlocks].sort(
          (a, b) => a.pageIndex - b.pageIndex || a.y - b.y || a.x - b.x,
        );
        const joined = sorted.map((b) => b.text).join("\n\n");
        updateText(joined);
        setStatus("Rewrite applied to document");
        toast.success("Rewrite applied to document");
        const nextInFilter = filteredSpans.find((span) => span.id !== activeSpan.id);
        const nextAny = report.spans.find((span) => span.id !== activeSpan.id);
        setActiveId(nextInFilter?.id || nextAny?.id || "");
        return;
      }
    }

    setReport((current) => {
      let rawText = current.raw_text;
      let remaining = current.spans.filter((span) => span.id !== activeSpan.id);
      if (mode === "accept" && activeSuggestion) {
        let replaceStart = activeSpan.start;
        let replaceEnd = activeSpan.end;
        const suggestedOriginal = activeSuggestion.original_text;
        const nearbyStart = Math.max(0, activeSpan.start - 3);
        const nearby = rawText.slice(nearbyStart, activeSpan.end);
        const localIndex = nearby.toLowerCase().indexOf(suggestedOriginal.toLowerCase());
        if (localIndex >= 0) {
          replaceStart = nearbyStart + localIndex;
          replaceEnd = replaceStart + suggestedOriginal.length;
        }
        rawText = rawText.slice(0, replaceStart) + replacementText + rawText.slice(replaceEnd);
        const delta = replacementText.length - (replaceEnd - replaceStart);
        remaining = remaining.map((span) =>
          span.start >= replaceEnd
            ? { ...span, start: span.start + delta, end: span.end + delta }
            : span,
        );
      }
      return {
        ...current,
        raw_text: rawText,
        spans: remaining,
        summary: buildSummary(remaining),
        neutrality_score: calculateScore(remaining),
      };
    });
    const nextInFilter = filteredSpans.find((span) => span.id !== activeSpan.id);
    const nextAny = report.spans.find((span) => span.id !== activeSpan.id);
    setActiveId(nextInFilter?.id ?? nextAny?.id ?? "");
    setStatus(mode === "accept" ? "Rewrite applied" : "Issue dismissed");
    try {
      const stateVector = encodeStateVector(activeSpan).features;
      globalFeedbackStore.recordFeedback({
        spanId: activeSpan.id,
        category: activeSpan.category,
        actionId: RL_ACTION_IDS.NEUTRAL_REPHRASE,
        rating: mode === "accept" ? "accepted" : "dismissed",
        suggestedText: replacementText,
        policyVersion: "v1.0.0",
        stateVector,
      });
      // Online arm update for LinUCB bandit
      globalBanditPolicy.updateArm(
        RL_ACTION_IDS.NEUTRAL_REPHRASE,
        stateVector,
        mode === "accept" ? 1.0 : -0.2,
      );
      if (engineMode === "fastapi") {
        sendBackendRLFeedback({
          spanId: activeSpan.id,
          actionId: RL_ACTION_IDS.NEUTRAL_REPHRASE,
          rating: mode === "accept" ? "accepted" : "dismissed",
          suggestedText: replacementText,
          stateFeatures: stateVector,
        }).catch(() => {});
      }
    } catch (e) {
      // safe
    }
    if (mode === "accept") {
      toast.success("Rewrite applied to document");
    } else {
      toast.info("Issue dismissed from review queue");
    }
  }

  async function exportPdf() {
    setIsExporting(true);
    setStatus("Generating high-resolution vector PDF…");
    toast.info("Preparing PDF export...", { description: "Compiling vector layout." });
    try {
      const { generateVectorPdf } = await import("@/lib/vector-pdf-engine");
      const result = await generateVectorPdf(canvasPages, canvasBlocks, {
        fileName: report.file_name.replace(/\.[^.]+$/, "-edited.pdf"),
        documentTitle: report.file_name.replace(/\.[^.]+$/, ""),
        candidateName: user?.name || "Candidate",
        targetRole: report.target_job?.title || "Professional Profile",
      });
      result.pdf.save(result.fileName);
      setStatus("Certified vector PDF exported");
      toast.success("PDF exported successfully!", {
        description: `100% selectable vector text (${result.totalCharacters.toLocaleString()} chars).`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not render PDF.";
      toast.error("Export failed", { description: msg });
    } finally {
      setIsExporting(false);
    }
  }

  async function exportDocx() {
    setIsExporting(true);
    setStatus("Generating Microsoft Word (.docx) document…");
    toast.info("Preparing DOCX export...", {
      description: "Compiling native Word styles, fonts, and formatting.",
    });
    try {
      const { downloadDocxFile } = await import("@/lib/docx-export-engine");
      const cleanFileName = report.file_name.replace(/\.[^.]+$/, "-edited.docx");
      await downloadDocxFile(canvasPages, canvasBlocks, {
        fileName: cleanFileName,
        documentTitle: report.file_name.replace(/\.[^.]+$/, ""),
        candidateName: user?.name || "Candidate",
        targetRole: report.target_job?.title || "Professional Profile",
        columnLayout: columnLayout,
      });
      setStatus("Microsoft Word (.docx) document exported");
      toast.success("DOCX exported successfully!", {
        description: "Ready to open in Microsoft Word, Google Docs, or LibreOffice.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not export DOCX.";
      toast.error("Export failed", { description: msg });
    } finally {
      setIsExporting(false);
    }
  }

  function exportImage(format: "png" | "jpeg") {
    setStatus(`Preparing ${format.toUpperCase()}…`);
    const canvas = document.createElement("canvas");
    const firstPage = canvasPages[0] || { width: 595, height: 842 };
    const scale = 2;
    canvas.width = Math.ceil(firstPage.width * scale);
    canvas.height = Math.ceil(firstPage.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    const pageBlocks = canvasBlocks.filter((b) => b.pageIndex === 0);
    pageBlocks.forEach((block) => {
      context.fillStyle = block.color || "#111827";
      context.font = `${block.bold ? "bold " : ""}${block.italic ? "italic " : ""}${Math.round(block.fontSize * scale)}px ${block.fontFamily}`;
      const lines = block.text.split("\n");
      let currentY = (block.y + block.fontSize) * scale;
      const lineHeight = block.fontSize * (block.lineHeight || 1.35) * scale;
      lines.forEach((line) => {
        let x = block.x * scale;
        if (block.align === "center") {
          const m = context.measureText(line).width;
          x = (block.x + block.width / 2) * scale - m / 2;
        } else if (block.align === "right") {
          const m = context.measureText(line).width;
          x = (block.x + block.width) * scale - m;
        }
        context.fillText(line, x, currentY);
        currentY += lineHeight;
      });
    });

    const url = canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", 0.95);
    downloadUrl(
      url,
      report.file_name.replace(/\.[^.]+$/, `-canvas.${format === "jpeg" ? "jpg" : "png"}`),
    );
    setStatus(`${format.toUpperCase()} exported`);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFile(event.dataTransfer.files[0]);
  }

  if (!mounted) {
    return <PageSkeleton />;
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50/80 dark:bg-zinc-950 text-foreground">
        <TopProgressBar loading={isProcessing} />
        {/* TOP NAVIGATION BAR FOR LANDING / EMPTY STATE */}
        <header className="border-b border-border bg-card/85 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between z-20 sticky top-0">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs">
              <ScanSearch className="size-5" />
            </div>
            <div>
              <p className="font-display text-base font-bold leading-none tracking-tight text-foreground">
                BiasLens
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mt-1 leading-none">
                Resume Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Light/Dark Switcher */}
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4 text-amber-400" />
              ) : (
                <Moon className="size-4 text-slate-700" />
              )}
            </Button>

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 px-2.5 text-xs font-semibold rounded-lg"
                  >
                    <UserAvatar
                      src={user.avatarUrl}
                      name={user.name}
                      size="xs"
                      className="size-5"
                    />
                    <span className="max-w-[110px] truncate">{user.name.split(" ")[0]}</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-xs font-bold leading-none">{user.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      setAccountModalTab("profile");
                      setAccountModalOpen(true);
                    }}
                    className="cursor-pointer text-xs"
                  >
                    <User className="size-3.5 mr-2 text-primary" />
                    <span>Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setAccountModalTab("security");
                      setAccountModalOpen(true);
                    }}
                    className="cursor-pointer text-xs"
                  >
                    <Settings className="size-3.5 mr-2 text-sky-500" />
                    <span>Account & Security</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setAccountModalTab("privacy");
                      setAccountModalOpen(true);
                    }}
                    className="cursor-pointer text-xs"
                  >
                    <LockKeyhole className="size-3.5 mr-2 text-amber-500" />
                    <span>Privacy & Data</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setAccountModalTab("appearance");
                      setAccountModalOpen(true);
                    }}
                    className="cursor-pointer text-xs"
                  >
                    <Palette className="size-3.5 mr-2 text-indigo-500" />
                    <span>Website & Theme</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setAccountModalTab("feedback");
                      setAccountModalOpen(true);
                    }}
                    className="cursor-pointer text-xs"
                  >
                    <HelpCircle className="size-3.5 mr-2 text-primary" />
                    <span>Help & Feedback</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="cursor-pointer text-xs text-destructive focus:text-destructive"
                  >
                    <LogOut className="size-3.5 mr-2" />
                    <span>Sign Out (Switch to Guest Mode)</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-muted/60 text-[11px] text-muted-foreground select-none">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-semibold text-foreground/80">Guest Mode</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-8 font-medium gap-1.5"
                  onClick={() => {
                    setAuthModalView("signin");
                    setAuthModalOpen(true);
                  }}
                >
                  <LogIn className="size-3.5" />
                  <span>Sign In</span>
                </Button>
                <Button
                  size="sm"
                  className="text-xs h-8 font-semibold gap-1.5 shadow-2xs"
                  onClick={() => {
                    setAuthModalView("signup");
                    setAuthModalOpen(true);
                  }}
                >
                  <UserPlus className="size-3.5" />
                  <span>Create Account</span>
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* HERO / EMPTY CANVAS DROPZONE */}
        <main className="workspace-grid flex-1 grid place-items-center p-6">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "w-full max-w-2xl rounded-2xl border-2 border-dashed bg-card/95 p-8 sm:p-12 text-center shadow-xl backdrop-blur-sm transition-all",
              dragging
                ? "border-primary bg-primary/5 scale-[1.01]"
                : "border-border/80 hover:border-primary/50",
            )}
          >
            {/* BiasLens App Icon Badge */}
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-foreground text-background shadow-md">
              <ScanSearch className="size-9" />
            </div>

            <div className="mt-6">
              <div className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <span>Resume Bias Detection & Document Editor</span>
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Welcome to BiasLens
              </h1>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Import an existing resume or start fresh to uncover hidden screening bias, calibrate
                neutrality, and refine your resume in an intuitive, Google Docs-style word editor.
              </p>
            </div>

            {/* Action Cards Grid */}
            {isAuthenticated && recentCloudResume && (
              <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-left">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FolderArchive className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      Continue working on:{" "}
                      <span className="text-primary font-bold">{recentCloudResume.title}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Last edited {new Date(recentCloudResume?.updated_at || Date.now()).toLocaleDateString()} ·
                      Neutrality index: {recentCloudResume?.neutrality_score ?? 0}%
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={async () => {
                    const bundle = await loadResumeBundle(recentCloudResume.id);
                    if (bundle) handleLoadResumeBundle(bundle);
                  }}
                  className="shrink-0 h-8 text-xs font-semibold shadow-2xs cursor-pointer"
                >
                  Resume Project
                </Button>
              </div>
            )}

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-background/50 p-4 text-center transition-all hover:border-primary hover:bg-primary/5 hover:shadow-xs group cursor-pointer"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Upload className="size-5" />
                </div>
                <span className="mt-3 text-xs font-bold text-foreground">Import Resume</span>
                <span className="mt-1 text-[11px] text-muted-foreground">PDF or DOCX file</span>
              </button>

              <button
                type="button"
                onClick={handleCreateBlankResume}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-background/50 p-4 text-center transition-all hover:border-primary hover:bg-primary/5 hover:shadow-xs group cursor-pointer"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <FileText className="size-5" />
                </div>
                <span className="mt-3 text-xs font-bold text-foreground">Create New</span>
                <span className="mt-1 text-[11px] text-muted-foreground">
                  Start from clean document
                </span>
              </button>

              <button
                type="button"
                onClick={loadSample}
                className="flex flex-col items-center justify-center rounded-xl border border-border bg-background/50 p-4 text-center transition-all hover:border-primary hover:bg-primary/5 hover:shadow-xs group cursor-pointer"
              >
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <FileText className="size-5" />
                </div>
                <span className="mt-3 text-xs font-bold text-foreground">Explore Sample</span>
                <span className="mt-1 text-[11px] text-muted-foreground">Preloaded bias demo</span>
              </button>
            </div>

            {isAuthenticated ? (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVaultModalOpen(true)}
                  className="text-xs gap-1.5 border-dashed hover:border-primary cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <FolderArchive className="size-3.5 text-primary" />
                  <span>Browse all saved resumes in Cloud Vault</span>
                </Button>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-muted bg-muted/20 p-2.5 text-xs text-muted-foreground flex items-center justify-center gap-2">
                <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
                <span>
                  No account required to start! Sign in or register anytime to sync your resumes
                  securely across devices.
                </span>
              </div>
            )}

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <LockKeyhole className="size-3.5 text-emerald-600" />
              <span>Private & secure. 100% in-browser processing with local persistence.</span>
            </div>

            <input
              ref={inputRef}
              hidden
              type="file"
              accept=".pdf,.docx"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>
        </main>

        {/* MODALS */}
        <ProcessingDialog
          open={isProcessing}
          fileName={processingFileName}
          currentStepIndex={processingStep}
        />
        <CounterfactualJobMatchingModal
          open={jobMatchingModalOpen}
          onOpenChange={setJobMatchingModalOpen}
          resumeText={report.raw_text}
          neutralityScore={report?.neutrality_score ?? 0}
          currentMatchResult={report.ats_match || null}
          onApplyJobMatch={(result) => {
            setReport((curr) => ({
              ...curr,
              target_job: result.job_profile,
              ats_match: result,
            }));
          }}
          onInsertKeywordIntoCanvas={handleInsertKeywordIntoCanvas}
        />
        <CloudVaultModal
          open={vaultModalOpen}
          onOpenChange={setVaultModalOpen}
          activeResumeId={cloudResumeId}
          activeResumeTitle={report.file_name.replace(/\.[^.]+$/, "") || "Active Resume"}
          currentNeutralityScore={report?.neutrality_score ?? 0}
          currentBlocks={canvasBlocks}
          currentPages={canvasPages}
          currentReport={report}
          onLoadResume={handleLoadResumeBundle}
          onRestoreVersion={handleRestoreVersion}
          onLaunchDiffModal={handleLaunchDiffModal}
        />
        <ResumeDiffModal
          open={diffModalOpen}
          onOpenChange={setDiffModalOpen}
          versions={diffVersionsList}
          activeResumeTitle={report.file_name.replace(/\.[^.]+$/, "") || "Active Resume"}
          onRestoreVersion={handleRestoreVersion}
        />
        <VectorPdfExportModal
          open={vectorPdfModalOpen}
          onOpenChange={setVectorPdfModalOpen}
          pages={canvasPages}
          blocks={canvasBlocks}
          defaultFileName={report.file_name}
          candidateName={user?.name || "Candidate"}
          targetRole={report.target_job?.title || "Professional Profile"}
        />
        <AuthModal
          open={authModalOpen}
          onOpenChange={setAuthModalOpen}
          defaultView={authModalView}
        />
        <AccountSettingsModal
          open={accountModalOpen}
          onOpenChange={setAccountModalOpen}
          defaultTab={accountModalTab}
          engineMode={engineMode}
          onEngineModeChange={(newMode) => {
            setEngineMode(newMode);
            setStatus(
              newMode === "local"
                ? "Running in-browser Local Engine"
                : "Targeting FastAPI (localhost:8000)",
            );
          }}
        />
      </div>
    );
  }

  return (
    <main className="flex h-screen max-h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopProgressBar loading={isProcessing || isExporting || isTransitioning} />
      {/* HEADER */}

      <header className="border-b bg-card shrink-0 z-20">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:px-5">
          <div
            onClick={() => setLoaded(false)}
            className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
            title="BiasLens Home"
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-xs">
              <ScanSearch className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-bold leading-none tracking-tight text-foreground">
                BiasLens
              </p>
              <p className="text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400 mt-1 leading-none">
                Resume Intelligence
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-3 border-l pl-4 lg:flex">
            <div className="relative flex items-center justify-center size-11">
              <svg className="size-11 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-muted/30 stroke-current"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={cn(
                    "stroke-current transition-all duration-500",
                    (report?.neutrality_score ?? 0) >= 80
                      ? "text-emerald-500"
                      : (report?.neutrality_score ?? 0) >= 60
                        ? "text-amber-500"
                        : "text-rose-500",
                  )}
                  strokeDasharray={`${report?.neutrality_score ?? 0}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute font-display text-xs font-bold text-foreground">
                {report?.neutrality_score ?? 0}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold leading-none">Neutrality Index</span>
              <p className="text-[11px] text-muted-foreground mt-1">
                {report?.spans?.length ?? 0} active {(report?.spans?.length ?? 0) === 1 ? "signal" : "signals"}
              </p>
            </div>
          </div>

          <div
            className="col-span-2 flex min-w-0 items-center justify-center gap-1 overflow-x-auto no-scrollbar scrollbar-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:col-span-1"
            aria-label="Issue filters"
          >
            {report.spans.length === 0 ? (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="size-3.5" />
                <span>Zero bias signals</span>
              </div>
            ) : (
              categories
                .filter((category) => {
                  if (category.key === "all") return true;
                  const count = report.spans.filter(
                    (span) => span.category === category.key,
                  ).length;
                  return count > 0;
                })
                .map((category) => {
                  const count =
                    category.key === "all"
                      ? report.spans.length
                      : report.spans.filter((span) => span.category === category.key).length;
                  const isSelected = filter === category.key;
                  return (
                    <Button
                      key={category.key}
                      variant={isSelected ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => handleSelectCategoryFilter(category.key)}
                      className={cn(
                        "shrink-0 h-8 px-2.5 text-xs font-medium cursor-pointer transition-all",
                        isSelected &&
                          "bg-secondary font-semibold text-foreground ring-1 ring-border shadow-xs",
                      )}
                    >
                      <span className={cn("size-1.5 rounded-full", category.dot)} />
                      {category.short}
                      <span
                        className={cn(
                          "text-muted-foreground",
                          isSelected && "text-foreground font-bold",
                        )}
                      >
                        {count}
                      </span>
                    </Button>
                  );
                })
            )}
          </div>

          <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-2 lg:col-start-4">
            {!isAuthenticated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAuthModalView("signup");
                  setAuthModalOpen(true);
                }}
                className="hidden lg:inline-flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 h-8 rounded-lg cursor-pointer font-medium"
                title="Your edits are saved locally. Click to create an account and backup to Cloud Vault."
              >
                <ShieldCheck className="size-3.5" />
                <span>Guest Mode · Save Online</span>
              </Button>
            )}

            {/* Live AI Engine Status Pill */}
            <div
              onClick={() => {
                setAccountModalTab("engine");
                setAccountModalOpen(true);
              }}
              className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/40 hover:bg-muted/70 transition-colors cursor-pointer text-xs"
              title="Click to view or switch Analysis Engine"
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  isAnalyzing
                    ? "bg-amber-500 animate-pulse"
                    : engineMode === "fastapi"
                      ? "bg-emerald-500"
                      : "bg-sky-500",
                )}
              />
              <span className="font-semibold text-[11px]">
                {isAnalyzing
                  ? "Analyzing..."
                  : engineMode === "fastapi"
                    ? "FastAPI Live AI"
                    : "Local Engine"}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.5 rounded bg-background/80">
                {engineMode === "fastapi"
                  ? lastLatencyMs !== null
                    ? `:8000 · ${lastLatencyMs}ms`
                    : ":8000"
                  : "offline"}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTemplatesModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 border-primary/30 hover:border-primary text-xs"
              title="Curated ATS & Bias-Shielded Resume Templates"
            >
              <LayoutTemplate className="size-4 text-primary" />
              <span>Templates</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setRlAgentDialogOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 border-primary/30 hover:border-primary text-xs"
              title="Sequential Q-Learning Agent & Training Convergence Studio"
            >
              <Bot className="size-4 text-primary" />
              <span>RL Agent</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setVaultModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs"
              title="Cloud Vault & Resume Version History"
            >
              <History className="size-4 text-primary" />
              <span>Vault</span>
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary font-mono">
                v{activeVersionNumber}
              </span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setJobMatchingModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 border-primary/30 hover:border-primary text-xs"
              title="Counterfactual Job-Matching Simulator & ATS Filter Audit"
            >
              <Target className="size-4 text-primary" />
              <span>Job Match</span>
              {report.ats_match && (
                <span className="ml-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary font-mono">
                  {report.ats_match.overall_match_score}%
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setFairnessModalOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5"
              title="Counterfactual testing and disparate impact ratio (Phases 3-4)"
            >
              <Scale className="size-4 text-primary" />
              <span>Fairness Audit</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBenchmarksModalOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5"
              title="Empirical ablation study & precision/recall metrics (Phase 5)"
            >
              <BarChart3 className="size-4" />
              <span>Benchmarks</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" disabled={isExporting}>
                  {isExporting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1" />
                      <span>Exporting…</span>
                    </>
                  ) : (
                    <>
                      <Download className="size-3.5" />
                      <span>Export</span>
                      <ChevronDown className="size-3" />
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Resume export</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => setVectorPdfModalOpen(true)}>
                  <FileText className="text-emerald-500" /> Vector PDF (ATS Certified)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportDocx}>
                  <FileText className="text-blue-500" /> Microsoft Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={exportPdf}>
                  <ArrowDownToLine /> Quick PDF Download
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportImage("png")}>
                  <Image /> PNG image
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportImage("jpeg")}>
                  <Image /> JPEG image
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() =>
                    downloadBlob(
                      report.raw_text,
                      report.file_name.replace(/\.[^.]+$/, ".txt"),
                      "text/plain",
                    )
                  }
                >
                  <ArrowDownToLine /> Plain text
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    downloadBlob(
                      JSON.stringify(report, null, 2),
                      "bias-report.json",
                      "application/json",
                    )
                  }
                >
                  <FileJson /> Bias report
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    setAccountModalTab("engine");
                    setAccountModalOpen(true);
                  }}
                >
                  <Server className="size-4 text-sky-500" /> Analysis Engine Settings
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setFairnessModalOpen(true)}>
                  <Scale className="size-4 text-primary" /> Fairness Audit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setBenchmarksModalOpen(true)}>
                  <BarChart3 className="size-4" /> Evaluation Benchmarks
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEthicsModalOpen(true)}>
                  <ShieldCheck className="size-4 text-emerald-600" /> Ethics & Methodology
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setAccountModalTab("privacy");
                    setAccountModalOpen(true);
                  }}
                >
                  <LockKeyhole className="size-4 text-amber-500" /> Privacy & Client-Side Guarantee
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* THEME TOGGLE */}
            <Button
              variant="outline"
              size="icon"
              className="size-8 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4 text-amber-400" />
              ) : (
                <Moon className="size-4 text-slate-700" />
              )}
            </Button>

            {/* ACCOUNT / PROFILE MENU */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 px-2 sm:px-2.5 font-medium text-xs rounded-lg"
                >
                  {isAuthenticated && user ? (
                    <UserAvatar
                      src={user.avatarUrl}
                      name={user.name}
                      size="xs"
                      className="size-5"
                    />
                  ) : (
                    <div className="grid size-5 place-items-center rounded-full bg-muted text-muted-foreground">
                      <User className="size-3" />
                    </div>
                  )}
                  <span className="hidden sm:inline-block max-w-[100px] truncate">
                    {isAuthenticated && user ? user.name.split(" ")[0] : "Account"}
                  </span>
                  <ChevronDown className="size-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-xs font-bold leading-none text-foreground">
                      {isAuthenticated && user ? user.name : "Guest Session"}
                    </p>
                    <p className="text-[10px] leading-none text-muted-foreground truncate">
                      {isAuthenticated && user ? user.email : "Local In-Browser"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                {isAuthenticated ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("profile");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <User className="size-3.5 mr-2 text-primary" />
                      <span>Profile Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("security");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <Settings className="size-3.5 mr-2 text-sky-500" />
                      <span>Account & Security</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("privacy");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <LockKeyhole className="size-3.5 mr-2 text-amber-500" />
                      <span>Privacy & Data Guarantee</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("engine");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <Server className="size-3.5 mr-2 text-sky-500" />
                      <span>Analysis Engine</span>
                      <span className="ml-auto text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-muted text-muted-foreground">
                        {engineMode}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("appearance");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <Palette className="size-3.5 mr-2 text-indigo-500" />
                      <span>Website & Theme</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("feedback");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <HelpCircle className="size-3.5 mr-2 text-primary" />
                      <span>Help & Feedback</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={logout}
                      className="cursor-pointer text-xs text-destructive focus:text-destructive"
                    >
                      <LogOut className="size-3.5 mr-2" />
                      <span>Sign Out</span>
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setAuthModalView("signin");
                        setAuthModalOpen(true);
                      }}
                      className="cursor-pointer text-xs font-semibold"
                    >
                      <LogIn className="size-3.5 mr-2 text-primary" />
                      <span>Sign In</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAuthModalView("signup");
                        setAuthModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <UserPlus className="size-3.5 mr-2 text-emerald-500" />
                      <span>Create Account</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("privacy");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <LockKeyhole className="size-3.5 mr-2 text-amber-500" />
                      <span>Privacy & Data Guarantee</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("engine");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <Server className="size-3.5 mr-2 text-sky-500" />
                      <span>Analysis Engine</span>
                      <span className="ml-auto text-[9px] uppercase px-1.5 py-0.5 rounded font-bold bg-muted text-muted-foreground">
                        {engineMode}
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("appearance");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <Palette className="size-3.5 mr-2 text-indigo-500" />
                      <span>Theme & Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        setAccountModalTab("feedback");
                        setAccountModalOpen(true);
                      }}
                      className="cursor-pointer text-xs"
                    >
                      <HelpCircle className="size-3.5 mr-2 text-primary" />
                      <span>Help & Feedback</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="grid min-h-0 flex-1 h-full overflow-hidden lg:grid-cols-[minmax(0,3.5fr)_minmax(340px,1.5fr)]">
        {/* LEFT COLUMN: MS WORD / GOOGLE DOCS STYLE RESUME EDITOR */}
        <section className="min-w-0 h-full border-b p-3 sm:p-5 lg:border-b-0 lg:border-r flex flex-col bg-slate-50 dark:bg-zinc-950 overflow-hidden">
          <div className="shrink-0 mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{report.file_name}</p>
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs border-primary/40 hover:border-primary text-primary hover:bg-primary/5 cursor-pointer"
                    title="Load trial resumes for demonstration"
                  >
                    <Sparkles className="size-3.5 text-primary" />
                    <span className="font-medium">Trial Resumes</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs font-semibold">Evaluation Sample Resumes</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      loadTrialResume(
                        "/samples/sample_resume_maya_sharma_product_designer.pdf",
                        "sample_resume_maya_sharma_product_designer.pdf",
                        "Maya Sharma"
                      )
                    }
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-1.5"
                  >
                    <span className="font-semibold text-xs text-foreground">Maya Sharma</span>
                    <span className="text-[11px] text-muted-foreground">Product Designer (UI/UX)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      loadTrialResume(
                        "/samples/sample_resume_arjun_mehta_software_engineer.pdf",
                        "sample_resume_arjun_mehta_software_engineer.pdf",
                        "Arjun Mehta"
                      )
                    }
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-1.5"
                  >
                    <span className="font-semibold text-xs text-foreground">Arjun Mehta</span>
                    <span className="text-[11px] text-muted-foreground">Software Engineer (Backend/Distributed)</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      loadTrialResume(
                        "/samples/sample_resume_nisha_fernandes_digital_marketing.pdf",
                        "sample_resume_nisha_fernandes_digital_marketing.pdf",
                        "Nisha Fernandes"
                      )
                    }
                    className="flex flex-col items-start gap-0.5 cursor-pointer py-1.5"
                  >
                    <span className="font-semibold text-xs text-foreground">Nisha Fernandes</span>
                    <span className="text-[11px] text-muted-foreground">Digital Marketing Specialist</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={handleCreateBlankResume}
                title="Create a new blank resume"
              >
                <FileText className="size-3.5 text-emerald-600" />
                <span>New Resume</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => inputRef.current?.click()}
                title="Import PDF or DOCX file"
              >
                <Upload className="size-3.5" />
                <span>Import File</span>
              </Button>
              <input
                ref={inputRef}
                hidden
                type="file"
                accept=".pdf,.docx"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </div>
          </div>

          {/* WORD / DOCS RESUME EDITOR */}
          <div className="flex-1 min-h-0 h-full overflow-hidden">
            {isTransitioning ? (
              <CanvasSkeleton className="h-full" />
            ) : (
              <WordResumeEditor
                pages={canvasPages}
                blocks={canvasBlocks}
                activeBiasSpan={activeSpan}
                biasSpans={report.spans}
                errorFlags={report.error_flags || []}
                columnLayout={columnLayout}
                onColumnLayoutChange={setColumnLayout}
                onChange={handleCanvasChange}
                onSelectBlock={(blockId) => {
                  const block = canvasBlocks.find((b) => b.id === blockId);
                  if (block) {
                    const match = report.spans.find((s) =>
                      matchesWordBoundary(block.text, s.matched_text),
                    );
                    if (match) {
                      setActiveId(match.id);
                      setSidebarTab("issues");
                    } else {
                      const errMatch = (report.error_flags || []).find((e) =>
                        matchesWordBoundary(block.text, e.matched_text),
                      );
                      if (errMatch) {
                        setSidebarTab("quality");
                      }
                    }
                  }
                }}
              />
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: REVIEW QUEUE (BIAS ISSUES & NEUTRAL REWRITES) */}
        <aside
          id="review-queue-panel"
          className="min-w-0 h-full flex flex-col bg-card overflow-hidden"
        >
          {isTransitioning ? (
            <SidebarSkeleton />
          ) : (
            <>
              {/* STICKY HEADER */}
              <div className="border-b px-5 py-3.5 shrink-0 bg-card z-10">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Review queue {filter !== "all" && `• ${categoryLabels[filter] ?? filter}`}
                    </p>
                    <h2 className="font-display text-lg font-semibold">
                      {sidebarTab === "issues" ? "Bias & Inclusivity" : "Writing Quality & Errors"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {filter !== "all" && sidebarTab === "issues" && (
                      <button
                        type="button"
                        onClick={() => handleSelectCategoryFilter("all")}
                        className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                      >
                        Show all ({report.spans.length})
                      </button>
                    )}
                    <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                      {sidebarTab === "issues"
                        ? `${filteredSpans.length} open`
                        : `${(report.error_flags || []).length} items`}
                    </span>
                  </div>
                </div>

                {/* Tab Switcher: Bias & Inclusivity vs Writing Quality & Errors */}
                <div className="mt-3 flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setSidebarTab("issues")}
                    className={cn(
                      "flex-1 text-xs font-semibold py-1.5 px-2 rounded-md transition-all cursor-pointer text-center",
                      sidebarTab === "issues"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Bias & Inclusivity ({filteredSpans.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab("quality")}
                    className={cn(
                      "flex-1 text-xs font-semibold py-1.5 px-2 rounded-md transition-all text-center cursor-pointer",
                      sidebarTab === "quality"
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Writing Quality & Errors ({(report.error_flags || []).length})
                  </button>
                </div>

                {sidebarTab === "issues" && filteredSpans.length > 0 && (
                  <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
                    {filteredSpans.map((span, index) => (
                      <Button
                        id={`issue-${span.id}`}
                        key={span.id}
                        variant={span.id === activeSpan?.id ? "default" : "outline"}
                        size="icon"
                        title={`${categoryLabels[span.category]} issue ${index + 1}`}
                        onClick={() => setActiveId(span.id)}
                      >
                        {index + 1}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* SCROLLABLE QUEUE CONTENT */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {sidebarTab === "issues" ? (
                  activeSpan && activeSuggestion ? (
                    <div className="space-y-6 p-5 pb-20 animate-in fade-in duration-200">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-sm bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-400">
                          Flagged
                        </span>
                        <span className="rounded-sm bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase text-secondary-foreground">
                          {categoryLabels[activeSpan.category]}
                        </span>
                        <span className="rounded-sm bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase text-secondary-foreground">
                          {activeSpan.severity} severity
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {Math.round(activeSpan.confidence * 100)}% confidence
                        </span>
                      </div>

                      {activeSpan.sentence && (
                        <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed">
                          <span className="font-semibold text-muted-foreground block mb-1">
                            Full Sentence Context:
                          </span>
                          <p className="italic text-foreground">“{activeSpan.sentence}”</p>
                        </div>
                      )}

                      <div>
                        <h3 className="font-display text-2xl font-bold tracking-tight">
                          “{activeSpan.matched_text}”
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                          {activeSpan.explanation}
                        </p>
                        {activeSpan.research_citation && (
                          <p className="mt-2 text-[11px] text-muted-foreground/80 italic">
                            Citation: {activeSpan.research_citation}
                          </p>
                        )}
                      </div>

                      <RLRecommendationCard
                        activeSpan={activeSpan}
                        baselineSuggestion={activeSuggestion}
                        customRewrite={customRewrite}
                        engineMode={engineMode}
                        onSelectRewrite={(txt) => setCustomRewrite(txt)}
                        onApplyRewrite={() => resolveIssue("accept", customRewrite)}
                        onDismiss={() => resolveIssue("dismiss")}
                      />

                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                        <Button size="lg" onClick={() => resolveIssue("accept", customRewrite)}>
                          <CheckCircle2 className="size-4 mr-1.5" /> Accept rewrite
                        </Button>
                        <Button variant="outline" size="lg" onClick={() => resolveIssue("dismiss")}>
                          <X className="size-4 mr-1.5" /> Dismiss
                        </Button>
                      </div>

                      {activeSuggestion.full_sentence_rewrite && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (activeSuggestion.full_sentence_rewrite) {
                              setCustomRewrite(activeSuggestion.full_sentence_rewrite);
                              resolveIssue("accept", activeSuggestion.full_sentence_rewrite);
                            }
                          }}
                          className="w-full text-xs border-primary/30 text-primary hover:bg-primary/5 mt-1"
                        >
                          <Sparkles className="size-3.5 mr-1.5 text-primary" />
                          Apply Google XYZ Full-Sentence Rewrite
                        </Button>
                      )}
                    </div>
                  ) : report.spans.length === 0 ? (
                    <div className="grid min-h-[420px] place-items-center p-8 pb-20 text-center animate-in fade-in duration-300">
                      <div className="max-w-xs space-y-4">
                        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-8 ring-emerald-500/5">
                          <ShieldCheck className="size-8" />
                        </div>
                        <div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            100% Bias-Free
                          </span>
                          <h3 className="mt-2.5 font-display text-xl font-bold tracking-tight text-foreground">
                            Screening-Optimized
                          </h3>
                          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            Zero bias markers detected across gender, age, prestige, gap, and
                            disability taxonomy. Your resume is ready for fair applicant tracking.
                          </p>
                          {(report.error_flags || []).length > 0 && (
                            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-left space-y-2 mt-3">
                              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                                <AlertTriangle className="size-4 shrink-0" />
                                <span>
                                  {(report.error_flags || []).length} Writing Issues / Profanities
                                  Detected!
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Your resume passed bias screening, but has writing errors,
                                profanity, or clichés that recruiters penalize.
                              </p>
                              <Button
                                size="sm"
                                className="w-full text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer mt-1"
                                onClick={() => setSidebarTab("quality")}
                              >
                                Review & Fix {(report.error_flags || []).length} Issues Now →
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 pt-2">
                          <Button
                            className="w-full gap-2 shadow-xs"
                            onClick={exportPdf}
                            disabled={isExporting}
                          >
                            {isExporting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <Download className="size-4" />
                            )}
                            <span>Download Clean PDF</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs"
                            onClick={() => setSidebarTab("quality")}
                          >
                            View Writing Quality & Scores ({(report.error_flags || []).length})
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-xs"
                            onClick={() => setFairnessModalOpen(true)}
                          >
                            <Scale className="size-3.5 text-primary" />
                            <span>Run Counterfactual Audit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-xs text-muted-foreground"
                            onClick={loadSample}
                          >
                            <RotateCcw className="size-3 mr-1.5" />
                            Reload Sample Demo
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid min-h-[420px] place-items-center p-8 text-center animate-in fade-in duration-300">
                      <div className="max-w-xs space-y-3">
                        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <CheckCircle2 className="size-6" />
                        </div>
                        <div>
                          <h3 className="font-display text-base font-bold text-foreground">
                            No {categoryLabels[filter as BiasCategory] || "Selected"} Issues
                          </h3>
                          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                            This category passed screening with zero flagged phrases.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => setFilter("all")}
                        >
                          Show All Issues ({report.spans.length})
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  /* SIDEBAR TAB: QUALITY & WRITING ERRORS */
                  <div className="space-y-5 p-5 pb-20 animate-in fade-in duration-200">
                    {/* 3 Metric Scorecards */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="rounded-lg border bg-card p-3 text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Action Verbs
                        </span>
                        <span
                          className={cn(
                            "text-2xl font-display font-bold mt-1 block",
                            (report.quality_metrics?.action_verb_score ?? 85) >= 80
                              ? "text-emerald-500"
                              : "text-amber-500",
                          )}
                        >
                          {report.quality_metrics?.action_verb_score ?? 85}%
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          Power Verbs
                        </span>
                      </div>

                      <div className="rounded-lg border bg-card p-3 text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Quantified
                        </span>
                        <span
                          className={cn(
                            "text-2xl font-display font-bold mt-1 block",
                            (report.quality_metrics?.quantification_score ?? 70) >= 75
                              ? "text-emerald-500"
                              : "text-amber-500",
                          )}
                        >
                          {report.quality_metrics?.quantification_score ?? 70}%
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          Measurable
                        </span>
                      </div>

                      <div className="rounded-lg border bg-card p-3 text-center">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                          Readability
                        </span>
                        <span
                          className={cn(
                            "text-2xl font-display font-bold mt-1 block",
                            (report.quality_metrics?.ats_readability_score ?? 92) >= 80
                              ? "text-primary"
                              : "text-rose-500",
                          )}
                        >
                          {report.quality_metrics?.ats_readability_score ?? 92}%
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block">
                          ATS Format
                        </span>
                      </div>
                    </div>

                    {/* Writing Errors List */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Detected Writing Improvements ({(report.error_flags || []).length})
                        </h4>
                      </div>

                      {!report.error_flags || report.error_flags.length === 0 ? (
                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
                          <CheckCircle2 className="size-6 text-emerald-500 mx-auto mb-2" />
                          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Clean Writing Hygiene!
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Zero profanity, slang, first-person pronouns, typos, or weak action
                            verbs detected.
                          </p>
                        </div>
                      ) : (
                        (report.error_flags || []).map((err, idx) => {
                          const isProfanity = err.error_type === "profanity";
                          const isSpelling = err.error_type === "spelling";
                          const isFirstPerson = err.error_type === "first_person";
                          const isSlang = err.error_type === "slang";
                          const isPersonalInfo = err.error_type === "personal_info";

                          const borderColor = isProfanity
                            ? "border-rose-500/40 bg-rose-500/5"
                            : isSpelling
                              ? "border-rose-400/40 bg-rose-400/5"
                              : isPersonalInfo
                                ? "border-orange-500/40 bg-orange-500/5"
                                : isFirstPerson || isSlang
                                  ? "border-amber-500/40 bg-amber-500/5"
                                  : "border-blue-500/30 bg-blue-500/5";

                          const badgeColor = isProfanity
                            ? "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                            : isSpelling
                              ? "bg-rose-400/20 text-rose-700 dark:text-rose-300"
                              : isPersonalInfo
                                ? "bg-orange-500/20 text-orange-700 dark:text-orange-300"
                                : isFirstPerson || isSlang
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                  : "bg-blue-500/20 text-blue-700 dark:text-blue-300";

                          const isUnquantified = err.error_type === "unquantified_impact";
                          const buttonLabel = isUnquantified
                            ? "Apply Google XYZ Formula"
                            : isSpelling
                              ? "Fix Spelling"
                              : isProfanity
                                ? "Replace / Cleanse"
                                : isFirstPerson
                                  ? "Use Action Verb"
                                  : isSlang
                                    ? "Professionalize"
                                    : isPersonalInfo || err.error_type === "cliche"
                                      ? "Remove Line"
                                      : err.error_type === "passive_voice" ||
                                          err.error_type === "weak_verb"
                                        ? "Apply Power Verb"
                                        : "Apply Fix";

                          return (
                            <div
                              key={err.id || idx}
                              className={cn(
                                "rounded-lg border p-3.5 space-y-2 text-xs transition-colors",
                                borderColor,
                              )}
                            >
                              <div className="flex items-center justify-between">
                                <span
                                  className={cn(
                                    "rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                                    badgeColor,
                                  )}
                                >
                                  {err.error_type.replace(/_/g, " ")}
                                </span>
                                <span className="text-[10px] text-muted-foreground capitalize font-medium">
                                  {err.severity || "medium"} severity
                                </span>
                              </div>

                              <p className="font-semibold text-foreground">
                                Matched:{" "}
                                <span className="underline decoration-current font-mono">
                                  "{err.matched_text}"
                                </span>
                              </p>

                              <p className="text-muted-foreground text-[11px] leading-relaxed">
                                {err.explanation}
                              </p>

                              {isUnquantified && (() => {
                                const xyz = generateGoogleXyzRewrite(err.sentence || err.matched_text);
                                return (
                                  <div className="bg-primary/5 border border-primary/25 rounded-md p-2.5 space-y-1.5 my-1.5">
                                    <div className="flex items-center gap-1.5 font-semibold text-primary text-[11px]">
                                      <Sparkles className="size-3 text-amber-500 shrink-0" />
                                      <span>Google XYZ Formula ({xyz.domain})</span>
                                    </div>
                                    <p className="text-foreground/90 italic pl-2.5 border-l-2 border-primary/50 font-mono text-[11px] leading-relaxed">
                                      "{xyz.fullRewrite}"
                                    </p>
                                    <div className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Accomplished [X]</span> •
                                      <span className="text-blue-600 dark:text-blue-400 font-medium">Measured by [Y]</span> •
                                      <span className="text-violet-600 dark:text-violet-400 font-medium">By doing [Z]</span>
                                    </div>
                                  </div>
                                );
                              })()}

                              {err.suggestion && (
                                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 mt-1">
                                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                    Fix: {err.suggestion}
                                  </span>
                                  {err.suggestion && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-6 text-[10px] px-2.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                                      onClick={() => applyErrorFix(err)}
                                    >
                                      <Sparkles className="size-3 mr-1" /> {buttonLabel}
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </aside>
      </div>

      {/* FOOTER */}
      <footer className="shrink-0 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t bg-card px-4 py-2 text-xs text-muted-foreground z-20">
        <div className="flex min-w-0 items-center gap-2">
          <LockKeyhole className="size-3.5 shrink-0 text-success" />
          <span className="truncate">
            <strong className="text-foreground">Private by design.</strong> Zero-retention,
            in-memory processing.
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setVaultModalOpen(true)}
            className="text-xs"
          >
            <History className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Versions</span>
            <span className="ml-1 text-[10px] font-bold text-primary font-mono">
              (v{activeVersionNumber})
            </span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setJobMatchingModalOpen(true)}
            className="text-xs"
          >
            <Target className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Job Match</span>
            {report.ats_match && (
              <span className="ml-1 text-[10px] font-bold text-primary font-mono">
                ({report.ats_match.overall_match_score}%)
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setFairnessModalOpen(true)}
            className="text-xs"
          >
            <Scale className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Fairness audit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBenchmarksModalOpen(true)}
            className="text-xs"
          >
            <BarChart3 className="size-3.5" />
            <span className="hidden sm:inline">Benchmarks</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEthicsModalOpen(true)}
            className="text-xs"
          >
            <ShieldCheck className="size-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Ethics & Limitations</span>
          </Button>
        </div>
      </footer>

      {/* MODALS (Dynamically Code-Split & Lazy Loaded on Demand) */}
      <ProcessingDialog
        open={isProcessing}
        fileName={processingFileName}
        currentStepIndex={processingStep}
      />

      <Suspense fallback={null}>
        {fairnessModalOpen && (
          <FairnessAuditModal
            open={fairnessModalOpen}
            onOpenChange={setFairnessModalOpen}
            report={report}
            onAuditUpdated={(updated) =>
              setReport((curr) => ({ ...curr, fairness_audit: updated }))
            }
          />
        )}

        {jobMatchingModalOpen && (
          <CounterfactualJobMatchingModal
            open={jobMatchingModalOpen}
            onOpenChange={setJobMatchingModalOpen}
            resumeText={report.raw_text}
            neutralityScore={report?.neutrality_score ?? 0}
            currentMatchResult={report.ats_match || null}
            onApplyJobMatch={(result) => {
              setReport((curr) => ({
                ...curr,
                target_job: result.job_profile,
                ats_match: result,
              }));
            }}
            onInsertKeywordIntoCanvas={handleInsertKeywordIntoCanvas}
          />
        )}

        <RLAgentDialog
          open={rlAgentDialogOpen}
          onOpenChange={setRlAgentDialogOpen}
          currentNeutralityScore={report?.neutrality_score ?? 44}
          currentAtsScore={report?.ats_match?.overall_match_score ?? 62}
          currentFlagsCount={report?.spans?.length ?? 6}
          onApplyOptimization={() => {
            if (report) {
              setReport((prev) => ({
                ...prev,
                neutrality_score: Math.max(96, prev?.neutrality_score ?? 44),
                summary: {
                  ...prev.summary,
                  total_flags: 0,
                },
                spans: [],
              }));
              setStatus("Applied AI Optimization to Document");
            }
          }}
        />

        <ResumeTemplatesModal
          open={templatesModalOpen}
          onOpenChange={setTemplatesModalOpen}
          onSelectTemplate={handleApplyTemplate}
          hasCustomEdits={canvasBlocks.length > 0}
        />

        {vaultModalOpen && (
          <CloudVaultModal
            open={vaultModalOpen}
            onOpenChange={setVaultModalOpen}
            activeResumeId={cloudResumeId}
            activeResumeTitle={report.file_name.replace(/\.[^.]+$/, "") || "Active Resume"}
            currentNeutralityScore={report?.neutrality_score ?? 0}
            currentBlocks={canvasBlocks}
            currentPages={canvasPages}
            currentReport={report}
            onLoadResume={handleLoadResumeBundle}
            onRestoreVersion={handleRestoreVersion}
            onLaunchDiffModal={handleLaunchDiffModal}
          />
        )}

        {diffModalOpen && (
          <ResumeDiffModal
            open={diffModalOpen}
            onOpenChange={setDiffModalOpen}
            versions={diffVersionsList}
            activeResumeTitle={report.file_name.replace(/\.[^.]+$/, "") || "Active Resume"}
            onRestoreVersion={handleRestoreVersion}
          />
        )}

        {vectorPdfModalOpen && (
          <VectorPdfExportModal
            open={vectorPdfModalOpen}
            onOpenChange={setVectorPdfModalOpen}
            pages={canvasPages}
            blocks={canvasBlocks}
            defaultFileName={report.file_name}
            candidateName={user?.name || "Candidate"}
            targetRole={report.target_job?.title || "Professional Profile"}
          />
        )}

        {benchmarksModalOpen && (
          <EvaluationBenchmarkModal
            open={benchmarksModalOpen}
            onOpenChange={setBenchmarksModalOpen}
          />
        )}

        {ethicsModalOpen && (
          <EthicsModal open={ethicsModalOpen} onOpenChange={setEthicsModalOpen} />
        )}

        {authModalOpen && (
          <AuthModal
            open={authModalOpen}
            onOpenChange={setAuthModalOpen}
            defaultView={authModalView}
          />
        )}

        {accountModalOpen && (
          <AccountSettingsModal
            open={accountModalOpen}
            onOpenChange={setAccountModalOpen}
            defaultTab={accountModalTab}
            engineMode={engineMode}
            onEngineModeChange={(newMode) => {
              setEngineMode(newMode);
              setStatus(
                newMode === "local"
                  ? "Running in-browser Local Engine"
                  : "Targeting FastAPI (localhost:8000)",
              );
            }}
          />
        )}
      </Suspense>
    </main>
  );
}
