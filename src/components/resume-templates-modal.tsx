import React, { useState } from "react";
import {
  LayoutTemplate,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  FileText,
  SlidersHorizontal,
  ChevronRight,
  Info,
  AlertTriangle,
  Flame,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  RESUME_TEMPLATES,
  GOOGLE_XYZ_TEMPLATES,
  type ResumeTemplate,
  type ImpactPhraseTemplate,
} from "@/lib/resume-templates";

interface ResumeTemplatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: ResumeTemplate) => void;
  hasCustomEdits?: boolean;
}

export function ResumeTemplatesModal({
  open,
  onOpenChange,
  onSelectTemplate,
  hasCustomEdits = true,
}: ResumeTemplatesModalProps) {
  const [activeTab, setActiveTab] = useState<"templates" | "xyz">("templates");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplate>(
    RESUME_TEMPLATES[0],
  );
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [templatePendingApply, setTemplatePendingApply] =
    useState<ResumeTemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredTemplates = RESUME_TEMPLATES.filter((tpl) => {
    if (categoryFilter === "all") return true;
    return tpl.category === categoryFilter;
  });

  function handleRequestApply(template: ResumeTemplate) {
    if (hasCustomEdits) {
      setTemplatePendingApply(template);
      setConfirmDialogOpen(true);
    } else {
      executeApply(template);
    }
  }

  function executeApply(template: ResumeTemplate) {
    onSelectTemplate(template);
    setConfirmDialogOpen(false);
    onOpenChange(false);
    toast.success(`Loaded "${template.title}" Template`, {
      description: `Font set to ${template.fontFamily}. Live bias analysis running.`,
    });
  }

  function copyTextToClipboard(text: string, id: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied ${label} to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
          {/* HEADER */}
          <DialogHeader className="p-6 pb-4 border-b shrink-0 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <LayoutTemplate className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    Resume Templates & Phrasing Studio
                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                      ATS 98%+ Verified
                    </Badge>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Pre-engineered, bias-shielded document blueprints and Google XYZ impact phrasing
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="pt-3">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as "templates" | "xyz")}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 max-w-xs h-8">
                  <TabsTrigger value="templates" className="text-xs">
                    Resume Blueprints ({RESUME_TEMPLATES.length})
                  </TabsTrigger>
                  <TabsTrigger value="xyz" className="text-xs">
                    Google XYZ Formulas ({GOOGLE_XYZ_TEMPLATES.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </DialogHeader>

          {/* MAIN BODY */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "templates" ? (
              <div className="h-full grid grid-cols-1 md:grid-cols-12 overflow-hidden">
                {/* LEFT LIST & FILTERS (7 cols) */}
                <div className="md:col-span-7 border-r flex flex-col h-full overflow-hidden bg-card/40">
                  {/* Category Pills */}
                  <div className="p-3 border-b flex items-center gap-1.5 overflow-x-auto shrink-0">
                    {[
                      { id: "all", label: "All Formats" },
                      { id: "tech", label: "Tech & Cloud" },
                      { id: "executive", label: "Executive" },
                      { id: "academic", label: "Ivy Standard" },
                      { id: "hybrid", label: "Career Transition" },
                      { id: "creative", label: "Product & UX" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCategoryFilter(tab.id)}
                        className={cn(
                          "px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors font-medium cursor-pointer",
                          categoryFilter === tab.id
                            ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                            : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Template Cards Scroll */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-3">
                      {filteredTemplates.map((tpl) => {
                        const isSelected = selectedTemplate.id === tpl.id;
                        return (
                          <div
                            key={tpl.id}
                            onClick={() => setSelectedTemplate(tpl)}
                            className={cn(
                              "p-4 rounded-xl border text-left transition-all cursor-pointer relative",
                              isSelected
                                ? "border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30"
                                : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-bold text-foreground">
                                    {tpl.title}
                                  </h4>
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  >
                                    {tpl.atsScore}% ATS
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                                  {tpl.subtitle}
                                </p>
                              </div>

                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                {tpl.fontFamily}
                              </span>
                            </div>

                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                              {tpl.description}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-1.5 items-center">
                              {tpl.badges.map((b) => (
                                <span
                                  key={b}
                                  className="text-[10px] px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium"
                                >
                                  {b}
                                </span>
                              ))}
                            </div>

                            <div className="mt-3 pt-3 border-t flex items-center justify-between">
                              <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                                Inspect details & sample text <ChevronRight className="size-3" />
                              </span>
                              <Button
                                size="sm"
                                variant={isSelected ? "default" : "outline"}
                                className="h-7 text-xs px-3"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRequestApply(tpl);
                                }}
                              >
                                Use Template
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* RIGHT PREVIEW & INSPECTOR (5 cols) */}
                <div className="md:col-span-5 flex flex-col h-full overflow-hidden bg-background">
                  <div className="p-4 border-b flex items-center justify-between shrink-0 bg-muted/10">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Template Blueprint
                      </h4>
                      <p className="text-sm font-bold text-foreground">
                        {selectedTemplate.title}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleRequestApply(selectedTemplate)}
                      className="gap-1.5"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Apply to Canvas
                    </Button>
                  </div>

                  <ScrollArea className="flex-1 p-5 space-y-4">
                    {/* BIAS SHIELD SPEC SHEET */}
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                        <ShieldCheck className="size-4" />
                        <span>Bias-Shield Architecture</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-muted-foreground">
                        {selectedTemplate.biasShieldHighlights.map((highlight, idx) => (
                          <li key={idx} className="flex items-start gap-1.5 leading-snug">
                            <span className="text-primary font-bold">•</span>
                            <span>{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* STRUCTURED SECTIONS PREVIEW */}
                    <div className="space-y-2 pt-2">
                      <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Document Sections & Content
                      </h5>
                      <div className="rounded-lg border bg-card p-3 font-mono text-[11px] space-y-2 text-foreground/90 max-h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                        {selectedTemplate.rawText}
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            ) : (
              /* GOOGLE XYZ FORMULAS TAB */
              <div className="h-full flex flex-col overflow-hidden bg-muted/10">
                <div className="p-4 border-b bg-background shrink-0 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      <Flame className="size-4 text-amber-500" />
                      Google XYZ Accomplishment Formulas
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Structured formula: <em>"Accomplished [X] as measured by [Y] by doing [Z]"</em>
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                    High ATS Action Score
                  </Badge>
                </div>

                <ScrollArea className="flex-1 p-6">
                  <div className="grid gap-4 max-w-4xl mx-auto">
                    {GOOGLE_XYZ_TEMPLATES.map((xyz, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border bg-card shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-primary uppercase tracking-wider">
                            {xyz.category}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Focus: {xyz.actionDone}
                          </span>
                        </div>

                        {/* Formula Box */}
                        <div className="p-2.5 rounded-md bg-muted/50 border font-mono text-xs text-foreground font-semibold flex items-center justify-between">
                          <span>{xyz.formula}</span>
                          <button
                            type="button"
                            onClick={() =>
                              copyTextToClipboard(xyz.formula, `f_${idx}`, "formula")
                            }
                            className="text-muted-foreground hover:text-foreground ml-2 cursor-pointer p-1 rounded hover:bg-muted"
                            title="Copy formula"
                          >
                            {copiedId === `f_${idx}` ? (
                              <Check className="size-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Concrete Example */}
                        <div className="p-3 rounded-md bg-primary/5 border border-primary/20 text-xs text-foreground/90 leading-relaxed">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase text-primary">
                              Battle-Tested Bullet Example
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                copyTextToClipboard(xyz.example, `e_${idx}`, "example")
                              }
                              className="text-primary hover:underline text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === `e_${idx}` ? (
                                <span className="text-emerald-500 flex items-center gap-0.5">
                                  <Check className="size-3" /> Copied!
                                </span>
                              ) : (
                                <span>Copy Example</span>
                              )}
                            </button>
                          </div>
                          <p className="font-sans font-medium text-xs">
                            "{xyz.example}"
                          </p>
                          <div className="mt-2 pt-2 border-t border-primary/10 text-[10px] text-muted-foreground">
                            Metric Target: <strong className="text-foreground">{xyz.measuredBy}</strong>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* CONFIRMATION ALERT DIALOG BEFORE REPLACING ACTIVE RESUME */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <AlertTriangle className="size-5 text-amber-500" />
              Apply "{templatePendingApply?.title}" Template?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
              Applying this template will replace the current resume draft with the structured sections and typography of <strong>{templatePendingApply?.title}</strong>.
              <br /><br />
              If you have unsaved custom changes on your canvas, make sure you take a checkpoint in <strong>Cloud Vault</strong> first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (templatePendingApply) executeApply(templatePendingApply);
              }}
            >
              Confirm & Load Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
