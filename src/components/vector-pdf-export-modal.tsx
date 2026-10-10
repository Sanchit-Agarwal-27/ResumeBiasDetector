import { useState, useMemo } from "react";
import {
  Download,
  FileText,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Bot,
  Copy,
  Check,
  Layers,
  Settings2,
  FileCheck2,
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CanvasTextBlock, CanvasPage } from "@/lib/pdf-cluster-engine";
import { generateVectorPdf, PAPER_SIZES, type PaperFormat } from "@/lib/vector-pdf-engine";
import { verifyAtsTextStream } from "@/lib/ats-text-verifier";

interface VectorPdfExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pages: CanvasPage[];
  blocks: CanvasTextBlock[];
  defaultFileName?: string;
  candidateName?: string;
  targetRole?: string;
}

export function VectorPdfExportModal({
  open,
  onOpenChange,
  pages,
  blocks,
  defaultFileName = "Resume.pdf",
  candidateName = "Candidate",
  targetRole = "Software Engineer",
}: VectorPdfExportModalProps) {
  const [paperFormat, setPaperFormat] = useState<PaperFormat>("a4");
  const [customFileName, setCustomFileName] = useState<string>(() => {
    return defaultFileName.replace(/\.[^.]+$/, "") + "_ATS_Certified.pdf";
  });
  const [nameInput, setNameInput] = useState<string>(candidateName);
  const [roleInput, setRoleInput] = useState<string>(targetRole);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("ats-stream");

  // Run real-time ATS text verification on the canvas blocks
  const verificationReport = useMemo(() => {
    return verifyAtsTextStream(blocks);
  }, [blocks]);

  async function handleDownload() {
    setIsExporting(true);
    try {
      const result = await generateVectorPdf(pages, blocks, {
        fileName: customFileName.trim() || "Resume_ATS_Certified.pdf",
        documentTitle: `${nameInput} — ${roleInput}`,
        candidateName: nameInput,
        targetRole: roleInput,
        paperFormat,
      });

      // Trigger standard browser download
      const link = document.createElement("a");
      link.href = result.blobUrl;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Vector PDF Exported!", {
        description: `100% selectable text generated (${result.totalCharacters.toLocaleString()} characters across ${result.pageCount} page(s)).`,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "PDF rendering failed";
      toast.error("Export Failed", { description: msg });
    } finally {
      setIsExporting(false);
    }
  }

  function handleCopyTextStream() {
    navigator.clipboard.writeText(verificationReport.parsedTextStream);
    setCopiedText(true);
    toast.success("ATS Text Stream Copied", {
      description: "Copied the exact plain text that recruiters and screening algorithms see.",
    });
    setTimeout(() => setCopiedText(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Export Certified Vector PDF
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                High-fidelity vector PDF with embedded selectable font streams for Workday,
                Greenhouse, and Lever.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ATS Certified Scannability Banner */}
        <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 my-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 font-mono font-bold text-base">
              {verificationReport.scannabilityScore}%
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  100% Selectable Vector Text
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {verificationReport.totalWordsExtracted.toLocaleString()} words &{" "}
                {verificationReport.totalCharactersExtracted.toLocaleString()} characters verified.
                Zero rasterization.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className="text-[10px] h-5 bg-background text-emerald-600 border-emerald-500/30"
            >
              Workday Ready
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] h-5 bg-background text-emerald-600 border-emerald-500/30"
            >
              Greenhouse
            </Badge>
            <Badge
              variant="outline"
              className="text-[10px] h-5 bg-background text-emerald-600 border-emerald-500/30"
            >
              Lever
            </Badge>
          </div>
        </div>

        {/* Export Configuration Grid */}
        <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
            Document & Format Settings
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                File Name
              </label>
              <Input
                value={customFileName}
                onChange={(e) => setCustomFileName(e.target.value)}
                placeholder="Resume_ATS_Certified.pdf"
                className="h-8 text-xs bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Paper Size / Region
              </label>
              <Select
                value={paperFormat}
                onValueChange={(val) => setPaperFormat(val as PaperFormat)}
              >
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4" className="text-xs">
                    {PAPER_SIZES.a4.label}
                  </SelectItem>
                  <SelectItem value="letter" className="text-xs">
                    {PAPER_SIZES.letter.label}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Candidate Name (PDF Metadata)
              </label>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Candidate Full Name"
                className="h-8 text-xs bg-background"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                Target Role / Title
              </label>
              <Input
                value={roleInput}
                onChange={(e) => setRoleInput(e.target.value)}
                placeholder="e.g. Senior Software Engineer"
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>
        </div>

        {/* Verification Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-1">
          <TabsList className="grid grid-cols-2 w-full mb-3">
            <TabsTrigger value="ats-stream" className="text-xs font-medium">
              <Bot className="h-3.5 w-3.5 mr-1.5" />
              ATS Parser Bot Preview
            </TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Scannability Audit Checklist
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: ATS PARSER PREVIEW */}
          <TabsContent value="ats-stream" className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-muted-foreground">
                This is the raw, unformatted text stream that automated applicant tracking systems
                will extract.
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyTextStream}
                className="h-6 text-[10px] gap-1 px-2"
              >
                {copiedText ? (
                  <Check className="h-3 w-3 text-emerald-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                Copy Stream
              </Button>
            </div>

            <div className="p-3.5 rounded-xl border bg-muted/30 max-h-[180px] overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-text">
              {verificationReport.parsedTextStream || "No text blocks detected."}
            </div>
          </TabsContent>

          {/* TAB 2: CHECKLIST */}
          <TabsContent value="checklist" className="space-y-2">
            <div className="grid grid-cols-1 gap-2">
              {verificationReport.scannerChecklist.map((item, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border bg-card/60 flex items-start gap-2.5 text-xs"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="font-semibold text-foreground">{item.rule}</h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.explanation}</p>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t mt-2">
          <p className="text-[11px] text-muted-foreground">
            Processed 100% in-browser with vector font embedding.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={isExporting}
              className="h-8 text-xs font-medium gap-1.5 shadow-sm"
            >
              {isExporting ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-spin" />
                  Compiling Vector PDF...
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  Download Certified PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
