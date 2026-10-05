import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  ArrowDownToLine,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  Copy,
  Download,
  FileJson,
  FileText,
  Image,
  LockKeyhole,
  RotateCcw,
  Scale,
  ScanSearch,
  Server,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { jsPDF } from "jspdf";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  sampleReport,
  type BiasCategory,
  type BiasSpan,
  type ResumeBiasReport,
  type SeverityLevel,
} from "@/lib/resume-contract";
import {
  analyzeResumeText,
  runCounterfactualFairnessAudit,
  EVALUATION_BENCHMARK_DATA,
} from "@/lib/bias-taxonomy";
import { FigmaResumeEditor } from "./figma-resume-editor";
import {
  clusterPdfTextContent,
  parseRawTextToCanvasBlocks,
  type CanvasTextBlock,
  type CanvasPage,
} from "@/lib/pdf-cluster-engine";
import { FairnessAuditModal } from "./fairness-audit-modal";
import { EvaluationBenchmarkModal } from "./evaluation-benchmark-modal";
import { EthicsModal } from "./ethics-modal";

const categories: Array<{ key: "all" | BiasCategory; short: string; label: string; dot: string }> =
  [
    { key: "all", short: "All", label: "All issues", dot: "bg-foreground" },
    { key: "gender_coded", short: "Gender", label: "Gender-coded", dot: "bg-gender" },
    { key: "age_indicative", short: "Age", label: "Age indicators", dot: "bg-age" },
    { key: "prestige_proxy", short: "Prestige", label: "Prestige proxy", dot: "bg-prestige" },
    { key: "gap_framing", short: "Career gap", label: "Career gap", dot: "bg-gap" },
    { key: "disability_coded", short: "Disability", label: "Disability-coded", dot: "bg-gap" },
  ];

const categoryLabels: Record<BiasCategory, string> = {
  gender_coded: "Gender-coded",
  age_indicative: "Age indicator",
  prestige_proxy: "Prestige proxy",
  gap_framing: "Career gap",
  disability_coded: "Disability-coded",
};

const severityWeights: Record<SeverityLevel, number> = { low: 3, medium: 7, high: 12 };

function buildSummary(spans: BiasSpan[]) {
  const byCategory: Record<BiasCategory, number> = {
    gender_coded: 0,
    age_indicative: 0,
    prestige_proxy: 0,
    gap_framing: 0,
    disability_coded: 0,
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

function normalizeFixture(): ResumeBiasReport {
  return structuredClone(sampleReport);
}

export function ResumeWorkspace() {
  // Check if a persisted resume was stored previously
  const [persistedData] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const savedReport = localStorage.getItem(STORAGE_REPORT_KEY);
      const savedBlocks = localStorage.getItem(STORAGE_BLOCKS_KEY);
      const savedPages = localStorage.getItem(STORAGE_PAGES_KEY);
      if (savedReport && savedBlocks && savedPages) {
        return {
          report: JSON.parse(savedReport) as ResumeBiasReport,
          blocks: JSON.parse(savedBlocks) as CanvasTextBlock[],
          pages: JSON.parse(savedPages) as CanvasPage[],
        };
      }
    } catch {
      // Ignore corrupted storage
    }
    return null;
  });

  // When opening for the first time without saved data, default to inviting empty state
  const [loaded, setLoaded] = useState(() => Boolean(persistedData));
  const [report, setReport] = useState<ResumeBiasReport>(() => persistedData?.report || normalizeFixture());
  const [activeId, setActiveId] = useState(() => persistedData?.report?.spans?.[0]?.id || "span-001");
  const [filter, setFilter] = useState<"all" | BiasCategory>("all");
  const [engineMode, setEngineMode] = useState<"local" | "fastapi">("local");
  const [status, setStatus] = useState(() => persistedData ? "Saved resume restored" : "Ready to analyze");
  const [dragging, setDragging] = useState(false);

  // Modal dialog states
  const [fairnessModalOpen, setFairnessModalOpen] = useState(false);
  const [benchmarksModalOpen, setBenchmarksModalOpen] = useState(false);
  const [ethicsModalOpen, setEthicsModalOpen] = useState(false);

  // Figma / Canva Design Editor state
  const [canvasPages, setCanvasPages] = useState<CanvasPage[]>(() =>
    persistedData?.pages || [{ id: "page-1", pageNumber: 1, width: 595, height: 842 }],
  );
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasTextBlock[]>(() =>
    persistedData?.blocks || parseRawTextToCanvasBlocks(sampleReport.raw_text, 595, 842),
  );

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-persist state across page reloads & browser closures
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_REPORT_KEY, JSON.stringify(report));
      localStorage.setItem(STORAGE_BLOCKS_KEY, JSON.stringify(canvasBlocks));
      localStorage.setItem(STORAGE_PAGES_KEY, JSON.stringify(canvasPages));
    } catch {
      // Storage quota safety
    }
  }, [loaded, report, canvasBlocks, canvasPages]);

  const filteredSpans = useMemo(
    () => report.spans.filter((span) => filter === "all" || span.category === filter),
    [report.spans, filter],
  );
  const activeSpan = report.spans.find((span) => span.id === activeId) ?? filteredSpans[0];
  const activeSuggestion = activeSpan ? report.suggestions[activeSpan.id] : undefined;

  function updateText(fullText: string) {
    const analysis = analyzeResumeText(fullText);
    const fairness = runCounterfactualFairnessAudit(fullText, analysis.spans);
    setReport((current) => ({
      ...current,
      raw_text: fullText,
      spans: analysis.spans,
      suggestions: analysis.suggestions,
      summary: buildSummary(analysis.spans),
      neutrality_score: analysis.neutrality_score,
      fairness_audit: fairness,
      evaluation_benchmarks: EVALUATION_BENCHMARK_DATA,
    }));
    if (!analysis.spans.some((span) => span.id === activeId)) {
      setActiveId(analysis.spans[0]?.id ?? "");
    }
    setStatus("Live analysis updated");
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

  function loadSample() {
    const fixture = normalizeFixture();
    const fairness = runCounterfactualFairnessAudit(fixture.raw_text, fixture.spans);
    fixture.fairness_audit = fairness;
    fixture.evaluation_benchmarks = EVALUATION_BENCHMARK_DATA;
    setReport(fixture);
    setLoaded(true);
    setActiveId(fixture.spans[0]?.id ?? "span-001");
    setFilter("all");
    setCanvasPages([{ id: "page-1", pageNumber: 1, width: 595, height: 842 }]);
    setCanvasBlocks(parseRawTextToCanvasBlocks(fixture.raw_text, 595, 842));
    setStatus("Sample analysis ready");
  }

  function handleCreateBlankResume() {
    const blankId = `blank-${Date.now()}`;
    const initialText = "Your Name\ncontact@example.com | (555) 000-0000 | linkedin.com/in/profile\n\nPROFESSIONAL SUMMARY\nAccomplished professional with experience leading high-impact initiatives.\n\nEXPERIENCE\nSenior Specialist | Organization\n• Spearheaded core operations and delivered measurable results across key projects.";
    const blankBlocks = parseRawTextToCanvasBlocks(initialText, 595, 842);
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
    };
    setReport(blankReport);
    setLoaded(true);
    setActiveId(analysis.spans[0]?.id ?? "");
    setFilter("all");
    setCanvasPages([{ id: "page-1", pageNumber: 1, width: 595, height: 842 }]);
    setCanvasBlocks(blankBlocks);
    setStatus("Blank resume created");
  }

  async function handleFile(file?: File) {
    if (!file) return;
    const valid = /\.(pdf|docx)$/i.test(file.name);
    if (!valid) {
      setStatus("Choose a PDF or DOCX file");
      return;
    }
    setStatus(`Reading ${file.name}…`);
    try {
      const arrayBuffer = await file.arrayBuffer();
      let extractedBlocks: CanvasTextBlock[] = [];
      let extractedPages: CanvasPage[] = [];
      let rawText = "";

      if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const result = await mammoth.extractRawText({ arrayBuffer });
        rawText = result.value.trim();
        extractedBlocks = parseRawTextToCanvasBlocks(rawText, 595, 842);
        const maxPageIdx = Math.max(0, ...extractedBlocks.map((b) => b.pageIndex));
        extractedPages = Array.from({ length: maxPageIdx + 1 }, (_, i) => ({
          id: `page-${i + 1}`,
          pageNumber: i + 1,
          width: 595,
          height: 842,
        }));
      } else {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        for (let index = 0; index < pdf.numPages; index++) {
          const page = await pdf.getPage(index + 1);
          const viewport = page.getViewport({ scale: 1 });
          const opList = await page.getOperatorList();
          const content = await page.getTextContent();
          const pageBlocks = clusterPdfTextContent(
            content.items,
            content.styles,
            viewport.width,
            viewport.height,
            index,
            (page as any).commonObjs,
            opList,
          );
          extractedPages.push({
            id: `page-${index + 1}`,
            pageNumber: index + 1,
            width: Math.round(viewport.width),
            height: Math.round(viewport.height),
          });
          extractedBlocks.push(...pageBlocks);
        }
        rawText = extractedBlocks.map((b) => b.text).join("\n\n").trim();
      }

      if (!rawText) throw new Error("No selectable text found");
      const analysis = analyzeResumeText(rawText);
      const fairness = runCounterfactualFairnessAudit(rawText, analysis.spans);
      const next = normalizeFixture();
      next.document_id = `local-${Date.now()}`;
      next.file_name = file.name;
      next.raw_text = rawText;
      next.spans = analysis.spans;
      next.suggestions = analysis.suggestions;
      next.summary = buildSummary(analysis.spans);
      next.neutrality_score = analysis.neutrality_score;
      next.fairness_audit = fairness;
      next.evaluation_benchmarks = EVALUATION_BENCHMARK_DATA;

      setReport(next);
      setLoaded(true);
      setFilter("all");
      setActiveId(analysis.spans[0]?.id ?? "");
      setCanvasPages(extractedPages);
      setCanvasBlocks(extractedBlocks);
      setStatus(`${file.name} imported into Canva/Figma editor`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unable to read this file";
      setStatus(`Could not read ${file.name}: ${detail}`);
    }
  }

  function resolveIssue(mode: "accept" | "dismiss") {
    if (!activeSpan) return;
    if (mode === "accept" && activeSuggestion) {
      let replaced = false;
      const updatedBlocks = canvasBlocks.map((block) => {
        if (!replaced && block.text.toLowerCase().includes(activeSuggestion.original_text.toLowerCase())) {
          replaced = true;
          const start = block.text.toLowerCase().indexOf(activeSuggestion.original_text.toLowerCase());
          const newText =
            block.text.slice(0, start) +
            activeSuggestion.suggested_text +
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
        setStatus("Rewrite applied to canvas frame");
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
        rawText =
          rawText.slice(0, replaceStart) +
          activeSuggestion.suggested_text +
          rawText.slice(replaceEnd);
        const delta = activeSuggestion.suggested_text.length - (replaceEnd - replaceStart);
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
    const next = report.spans.find((span) => span.id !== activeSpan.id);
    setActiveId(next?.id ?? "");
    setStatus(mode === "accept" ? "Rewrite applied" : "Issue dismissed");
  }

  function exportPdf() {
    setStatus("Preparing PDF…");
    const firstPage = canvasPages[0] || { width: 595, height: 842 };
    const pdf = new jsPDF({
      unit: "pt",
      format: [firstPage.width, firstPage.height],
      orientation: firstPage.width > firstPage.height ? "landscape" : "portrait",
    });

    canvasPages.forEach((page, pageIndex) => {
      if (pageIndex > 0) {
        pdf.addPage([page.width, page.height], page.width > page.height ? "landscape" : "portrait");
      }
      const pageBlocks = canvasBlocks.filter((b) => b.pageIndex === pageIndex);
      pageBlocks.forEach((block) => {
        const family = /georgia|times|serif/i.test(block.fontFamily)
          ? "times"
          : /mono|courier/i.test(block.fontFamily)
            ? "courier"
            : "helvetica";
        pdf.setFont(family, `${block.bold ? "bold" : ""}${block.italic ? "italic" : ""}` || "normal");
        pdf.setFontSize(block.fontSize);
        const hex = block.color || "#111827";
        if (hex.startsWith("#") && hex.length === 7) {
          pdf.setTextColor(
            Number.parseInt(hex.slice(1, 3), 16),
            Number.parseInt(hex.slice(3, 5), 16),
            Number.parseInt(hex.slice(5, 7), 16),
          );
        } else {
          pdf.setTextColor(17, 24, 39);
        }

        const lines = pdf.splitTextToSize(block.text, block.width);
        pdf.text(lines, block.x, block.y + block.fontSize, {
          align: block.align === "justify" ? "left" : block.align || "left",
        });
      });
    });

    pdf.save(report.file_name.replace(/\.[^.]+$/, "-edited.pdf"));
    setStatus("Layout-preserving PDF exported");
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

  if (!loaded) {
    return (
      <main className="workspace-grid grid min-h-screen place-items-center p-6 bg-slate-50/80 dark:bg-zinc-950">
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
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>AI-Powered Resume Bias Detection & Design Editor</span>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Welcome to BiasLens
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Import an existing resume or start fresh to uncover hidden screening bias, calibrate neutrality, and refine your design in an interactive Canva/Figma canvas.
            </p>
          </div>

          {/* Action Cards Grid */}
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
              <span className="mt-1 text-[11px] text-muted-foreground">Start from blank canvas</span>
            </button>

            <button
              type="button"
              onClick={loadSample}
              className="flex flex-col items-center justify-center rounded-xl border border-border bg-background/50 p-4 text-center transition-all hover:border-primary hover:bg-primary/5 hover:shadow-xs group cursor-pointer"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Sparkles className="size-5" />
              </div>
              <span className="mt-3 text-xs font-bold text-foreground">Explore Sample</span>
              <span className="mt-1 text-[11px] text-muted-foreground">Preloaded bias demo</span>
            </button>
          </div>

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
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {/* HEADER */}
      <header className="border-b bg-card">
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
                    report.neutrality_score >= 80
                      ? "text-emerald-500"
                      : report.neutrality_score >= 60
                        ? "text-amber-500"
                        : "text-rose-500",
                  )}
                  strokeDasharray={`${report.neutrality_score}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute font-display text-xs font-bold text-foreground">
                {report.neutrality_score}
              </span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold leading-none">Neutrality Index</span>
                <span
                  className={cn(
                    "text-[10px] font-medium px-1.5 py-0.5 rounded-full leading-none",
                    report.neutrality_score >= 80
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : report.neutrality_score >= 60
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                  )}
                >
                  {report.neutrality_score >= 80
                    ? "Fair"
                    : report.neutrality_score >= 60
                      ? "Moderate"
                      : "Flagged"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {report.spans.length} active {report.spans.length === 1 ? "signal" : "signals"}
              </p>
            </div>
          </div>

          <div
            className="col-span-2 flex min-w-0 items-center gap-1 overflow-x-auto pb-1 lg:col-span-1 lg:justify-center lg:pb-0"
            aria-label="Issue filters"
          >
            {categories.map((category) => {
              const count =
                category.key === "all"
                  ? report.spans.length
                  : report.spans.filter((span) => span.category === category.key).length;
              return (
                <Button
                  key={category.key}
                  variant={filter === category.key ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setFilter(category.key)}
                  className="shrink-0"
                >
                  <span className={cn("size-1.5 rounded-full", category.dot)} />
                  {category.short}
                  <span className="text-muted-foreground">{count}</span>
                </Button>
              );
            })}
          </div>

          <div className="col-start-2 row-start-1 flex shrink-0 items-center gap-2 lg:col-start-4">
            {/* Engine Mode Toggle (Local in-browser vs Person A/B FastAPI backend) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex items-center gap-1.5 text-xs"
                  title="Switch between Local in-browser NLP and Person A/B FastAPI server"
                >
                  <Server className="size-3.5 text-sky-600 dark:text-sky-400" />
                  <span className="hidden md:inline">Engine:</span>
                  <span className="font-semibold capitalize">{engineMode}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Analysis Engine
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => {
                    setEngineMode("local");
                    setStatus("Running in-browser Local Engine");
                  }}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">Local (In-Browser)</span>
                    <span className="text-[10px] text-muted-foreground">Private, client-side NLP</span>
                  </div>
                  {engineMode === "local" && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEngineMode("fastapi");
                    setStatus("Targeting FastAPI (localhost:8000)");
                  }}
                  className="flex items-center justify-between text-xs cursor-pointer"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold">FastAPI Backend</span>
                    <span className="text-[10px] text-muted-foreground">http://localhost:8000/api</span>
                  </div>
                  {engineMode === "fastapi" && <Check className="size-3.5 text-primary" />}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
                <Button size="sm">
                  <Download /> Export <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Resume export</DropdownMenuLabel>
                <DropdownMenuItem onSelect={exportPdf}>
                  <FileText /> PDF document
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
                <DropdownMenuItem onSelect={() => setFairnessModalOpen(true)}>
                  <Scale className="size-4 text-primary" /> Fairness Audit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setBenchmarksModalOpen(true)}>
                  <BarChart3 className="size-4" /> Evaluation Benchmarks
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEthicsModalOpen(true)}>
                  <ShieldCheck className="size-4 text-emerald-600" /> Ethics & Methodology
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* MAIN TWO-COLUMN WORKSPACE */}
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,3.5fr)_minmax(330px,1.5fr)]">
        {/* LEFT COLUMN: FIGMA / CANVA RESUME DESIGN CANVAS */}
        <section className="min-w-0 border-b p-3 sm:p-5 lg:border-b-0 lg:border-r flex flex-col bg-slate-50 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{report.file_name}</p>
              <p className="text-xs text-muted-foreground">{status}</p>
            </div>
            <div className="flex items-center gap-2">
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

          {/* FIGMA / CANVA RESUME EDITOR CANVAS */}
          <div className="flex-1 min-h-[640px] h-[calc(100vh-170px)]">
            <FigmaResumeEditor
              pages={canvasPages}
              blocks={canvasBlocks}
              activeBiasSpan={activeSpan}
              biasSpans={report.spans}
              onChange={handleCanvasChange}
              onSelectBlock={(blockId) => {
                const block = canvasBlocks.find((b) => b.id === blockId);
                if (block) {
                  const match = report.spans.find((s) =>
                    block.text.toLowerCase().includes(s.matched_text.toLowerCase()),
                  );
                  if (match) {
                    setActiveId(match.id);
                  }
                }
              }}
            />
          </div>
        </section>

        {/* RIGHT COLUMN: REVIEW QUEUE (BIAS ISSUES & NEUTRAL REWRITES) */}
        <aside className="min-w-0 bg-card lg:max-h-[calc(100vh-66px)] lg:overflow-y-auto">
          <div className="border-b px-5 py-4">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Review queue
                </p>
                <h2 className="font-display text-lg font-semibold">Issue & rewrite</h2>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">
                {filteredSpans.length} open
              </span>
            </div>
            <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
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
          </div>

          {activeSpan && activeSuggestion ? (
            <div className="space-y-6 p-5">
              <div className="flex flex-wrap items-center gap-2">
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

              <div className="rounded-md border p-4 bg-muted/20">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Suggested revision
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                    <span className="text-[10px] font-bold uppercase text-destructive">Before</span>
                    <p className="mt-2 text-sm font-semibold text-destructive">
                      {activeSuggestion.original_text}
                    </p>
                  </div>
                  <div className="rounded-md border border-success/30 bg-success/5 p-3">
                    <span className="text-[10px] font-bold uppercase text-success">After</span>
                    <p className="mt-2 text-sm font-semibold text-success">
                      {activeSuggestion.suggested_text || "Remove phrase"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {activeSuggestion.rationale}
                </p>
              </div>

              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                <Button size="lg" onClick={() => resolveIssue("accept")}>
                  <CheckCircle2 /> Accept rewrite
                </Button>
                <Button variant="outline" size="lg" onClick={() => resolveIssue("dismiss")}>
                  <X /> Dismiss
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[420px] place-items-center p-8 text-center">
              <div>
                <CheckCircle2 className="mx-auto size-10 text-success" />
                <h3 className="mt-4 font-display text-xl font-semibold">Review complete</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  No active signals in this view.
                </p>
                <Button variant="outline" className="mt-5" onClick={loadSample}>
                  <RotateCcw /> Reset sample
                </Button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* FOOTER */}
      <footer className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t bg-card px-4 py-2.5 text-xs text-muted-foreground">
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

      {/* MODALS */}
      <FairnessAuditModal
        open={fairnessModalOpen}
        onOpenChange={setFairnessModalOpen}
        report={report}
        onAuditUpdated={(updated) =>
          setReport((curr) => ({ ...curr, fairness_audit: updated }))
        }
      />
      <EvaluationBenchmarkModal
        open={benchmarksModalOpen}
        onOpenChange={setBenchmarksModalOpen}
      />
      <EthicsModal open={ethicsModalOpen} onOpenChange={setEthicsModalOpen} />
    </main>
  );
}
