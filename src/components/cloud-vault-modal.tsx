import { useState, useEffect } from "react";
import {
  FolderArchive,
  History,
  FileText,
  Plus,
  GitBranch,
  RotateCcw,
  GitCompare,
  Trash2,
  Edit2,
  Check,
  ShieldCheck,
  Target,
  Sparkles,
  Calendar,
  Cloud,
  Layers,
  ArrowRight,
  Clock,
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
import { cn } from "@/lib/utils";
import type { CanvasTextBlock, CanvasPage } from "@/lib/pdf-cluster-engine";
import type { ResumeBiasReport } from "@/lib/resume-contract";
import {
  listUserResumes,
  loadResumeBundle,
  listResumeVersions,
  createResumeVersionSnapshot,
  duplicateResume,
  renameResume,
  archiveResume,
  type CloudResumeRecord,
  type CloudResumeBundle,
  type CloudResumeVersionRecord,
} from "@/lib/cloud-vault-service";

interface CloudVaultModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeResumeId: string | null;
  activeResumeTitle: string;
  currentNeutralityScore: number;
  currentBlocks: CanvasTextBlock[];
  currentPages: CanvasPage[];
  currentReport: ResumeBiasReport;
  onLoadResume: (bundle: CloudResumeBundle) => void;
  onRestoreVersion: (version: CloudResumeVersionRecord) => void;
  onLaunchDiffModal: (versions: CloudResumeVersionRecord[]) => void;
}

export function CloudVaultModal({
  open,
  onOpenChange,
  activeResumeId,
  activeResumeTitle,
  currentNeutralityScore,
  currentBlocks,
  currentPages,
  currentReport,
  onLoadResume,
  onRestoreVersion,
  onLaunchDiffModal,
}: CloudVaultModalProps) {
  const [activeTab, setActiveTab] = useState<"resumes" | "versions">("versions");
  const [resumesList, setResumesList] = useState<CloudResumeRecord[]>([]);
  const [versionsList, setVersionsList] = useState<CloudResumeVersionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // New snapshot creation state
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  // Renaming state
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState("");

  async function refreshData() {
    setIsLoading(true);
    try {
      const resumes = await listUserResumes();
      setResumesList(resumes);

      if (activeResumeId) {
        const versions = await listResumeVersions(activeResumeId);
        setVersionsList(versions);
      }
    } catch (err: unknown) {
      console.warn("[CloudVaultModal] Refresh error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (open) {
      refreshData();
    }
  }, [open, activeResumeId]);

  async function handleCreateSnapshot() {
    if (!activeResumeId) {
      toast.error("Please save your resume first before creating snapshots.");
      return;
    }

    setIsCreatingSnapshot(true);
    try {
      const snapshot = await createResumeVersionSnapshot({
        resumeId: activeResumeId,
        versionName: newSnapshotName.trim() || `Version Snapshot`,
        neutralityScore: currentNeutralityScore,
        blocks: currentBlocks,
        pages: currentPages,
        report: currentReport,
      });

      toast.success("Snapshot checkpoint saved!", {
        description: `Created ${snapshot.version_name} (v${snapshot.version_number}).`,
      });
      setNewSnapshotName("");
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not create snapshot.";
      toast.error("Snapshot creation failed", { description: msg });
    } finally {
      setIsCreatingSnapshot(false);
    }
  }

  async function handleLoadResume(resumeId: string) {
    try {
      const bundle = await loadResumeBundle(resumeId);
      if (bundle) {
        onLoadResume(bundle);
        onOpenChange(false);
        toast.success(`Loaded "${bundle.resume.title}"`, {
          description: `Active version: v${bundle.resume.active_version} with ${bundle.blocks.length} blocks.`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load document.";
      toast.error("Could not load resume", { description: msg });
    }
  }

  async function handleDuplicateResume(resumeId: string, title: string) {
    try {
      const newId = await duplicateResume(resumeId, `${title} (Branch)`);
      toast.success("Resume branched successfully!", {
        description: "Created an isolated copy in your Cloud Vault.",
      });
      refreshData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not duplicate resume.";
      toast.error("Branch failed", { description: msg });
    }
  }

  async function handleSaveRename(resumeId: string) {
    if (!editTitleInput.trim()) {
      setEditingResumeId(null);
      return;
    }
    try {
      await renameResume(resumeId, editTitleInput.trim());
      setEditingResumeId(null);
      refreshData();
      toast.success("Resume title updated.");
    } catch {
      toast.error("Could not rename resume.");
    }
  }

  async function handleArchiveResume(resumeId: string, title: string) {
    try {
      await archiveResume(resumeId);
      toast.success(`Archived "${title}"`);
      refreshData();
    } catch {
      toast.error("Could not archive resume.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 sm:p-7">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderArchive className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Cloud Vault & Version History
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Manage tailored resume variations, create immutable restore points, and inspect
                visual diffs.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "resumes" | "versions")}
          className="w-full mt-2"
        >
          <TabsList className="grid grid-cols-2 w-full mb-4">
            <TabsTrigger value="versions" className="text-xs font-medium">
              <History className="h-3.5 w-3.5 mr-1.5" />
              Version History & Restore Points ({versionsList.length})
            </TabsTrigger>
            <TabsTrigger value="resumes" className="text-xs font-medium">
              <Cloud className="h-3.5 w-3.5 mr-1.5" />
              My Resumes Vault ({resumesList.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: VERSION HISTORY & RESTORE POINTS */}
          <TabsContent value="versions" className="space-y-4">
            {/* Create Snapshot Card */}
            <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Save Snapshot Checkpoint
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Freeze current canvas blocks, suggestions, and ATS score into a permanent
                    restore point.
                  </p>
                </div>
                {versionsList.length >= 2 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onLaunchDiffModal(versionsList);
                      onOpenChange(false);
                    }}
                    className="h-8 text-xs gap-1.5 border-primary/30 hover:border-primary text-primary"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Side-by-Side Diff
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  value={newSnapshotName}
                  onChange={(e) => setNewSnapshotName(e.target.value)}
                  placeholder="e.g. De-biased Candidate v2 (Pre-interview)"
                  className="h-8 text-xs flex-1 bg-background"
                />
                <Button
                  size="sm"
                  onClick={handleCreateSnapshot}
                  disabled={isCreatingSnapshot}
                  className="h-8 text-xs font-medium shrink-0 gap-1.5 shadow-sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {isCreatingSnapshot ? "Saving..." : "Save Snapshot"}
                </Button>
              </div>
            </div>

            {/* Versions Timeline List */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider px-1">
                Timeline for "{activeResumeTitle}"
              </h4>

              {versionsList.length === 0 ? (
                <div className="p-8 text-center border rounded-xl bg-card/40">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                  <p className="text-xs text-muted-foreground font-medium">
                    No version snapshots found for this document yet.
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Click "Save Snapshot" above to create your baseline version.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {versionsList.map((ver) => (
                    <div
                      key={ver.id}
                      className="p-3.5 rounded-xl border bg-card hover:bg-card/80 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] h-5 px-1.5 bg-primary/5 text-primary border-primary/20"
                          >
                            v{ver.version_number}
                          </Badge>
                          <span className="text-xs font-bold text-foreground truncate">
                            {ver.version_name}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1 font-mono text-emerald-600 dark:text-emerald-400">
                            <ShieldCheck className="h-3 w-3" />
                            {ver.neutrality_score}% Neutrality
                          </span>
                          {ver.snapshot.report?.ats_match && (
                            <span className="flex items-center gap-1 font-mono text-primary">
                              <Target className="h-3 w-3" />
                              {ver.snapshot.report.ats_match.overall_match_score}% ATS Match
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[10px]">
                            <Calendar className="h-3 w-3" />
                            {new Date(ver.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onRestoreVersion(ver);
                            onOpenChange(false);
                            toast.success(`Restored to ${ver.version_name}`);
                          }}
                          className="h-7 text-xs gap-1.5 hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Rollback
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: MY RESUMES VAULT */}
          <TabsContent value="resumes" className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">
                All resume profiles stored in your account library.
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={refreshData}
                disabled={isLoading}
                className="h-7 text-xs"
              >
                Refresh
              </Button>
            </div>

            {resumesList.length === 0 ? (
              <div className="p-8 text-center border rounded-xl bg-card/40">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                <p className="text-xs text-muted-foreground font-medium">
                  Your Cloud Vault is currently empty.
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Resumes created or imported in the workspace are automatically synced here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {resumesList.map((r) => {
                  const isCurrent = r.id === activeResumeId;

                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "p-4 rounded-xl border bg-card transition-all flex flex-col justify-between shadow-xs",
                        isCurrent
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : "hover:border-border/80",
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          {editingResumeId === r.id ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <Input
                                value={editTitleInput}
                                onChange={(e) => setEditTitleInput(e.target.value)}
                                className="h-7 text-xs"
                                autoFocus
                              />
                              <Button
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleSaveRename(r.id)}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-foreground truncate">
                                {r.title}
                              </h4>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {r.file_name}
                              </p>
                            </div>
                          )}

                          <Badge
                            variant={isCurrent ? "default" : "outline"}
                            className="text-[9px] h-4.5 px-1.5 shrink-0 font-mono"
                          >
                            v{r.active_version}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-3 mt-3 text-[11px]">
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                            {r.neutrality_score}% Neutrality
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            Updated {new Date(r.updated_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 mt-3 border-t gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingResumeId(r.id);
                              setEditTitleInput(r.title);
                            }}
                            title="Rename"
                            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Edit2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateResume(r.id, r.title)}
                            title="Branch copy"
                            className="p-1 rounded text-muted-foreground hover:text-primary transition-colors"
                          >
                            <GitBranch className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveResume(r.id, r.title)}
                            title="Archive"
                            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>

                        {!isCurrent && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLoadResume(r.id)}
                            className="h-6 text-[10px] gap-1 px-2.5"
                          >
                            Open in Editor
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                        {isCurrent && (
                          <span className="text-[10px] font-semibold text-primary">
                            Active in Workspace
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
