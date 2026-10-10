import { useState, useMemo } from "react";
import {
  GitCompare,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Target,
  RotateCcw,
  Plus,
  Minus,
  Edit3,
  Calendar,
  Layers,
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { CloudResumeVersionRecord } from "@/lib/cloud-vault-service";
import { compareVersionSnapshots, type VersionMeta } from "@/lib/version-diff-engine";

interface ResumeDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: CloudResumeVersionRecord[];
  activeResumeTitle: string;
  onRestoreVersion?: (version: CloudResumeVersionRecord) => void;
}

export function ResumeDiffModal({
  open,
  onOpenChange,
  versions,
  activeResumeTitle,
  onRestoreVersion,
}: ResumeDiffModalProps) {
  // Sort versions ascending by version_number
  const sorted = useMemo(() => {
    return [...versions].sort((a, b) => a.version_number - b.version_number);
  }, [versions]);

  // Default selection: Version A is the earliest (v1), Version B is the latest
  const [versionAId, setVersionAId] = useState<string>("");
  const [versionBId, setVersionBId] = useState<string>("");

  const selectedA = useMemo(() => {
    return sorted.find((v) => v.id === versionAId) || sorted[0] || null;
  }, [sorted, versionAId]);

  const selectedB = useMemo(() => {
    return (
      sorted.find((v) => v.id === versionBId) ||
      (sorted.length > 1 ? sorted[sorted.length - 1] : sorted[0]) ||
      null
    );
  }, [sorted, versionBId]);

  const diffResult = useMemo(() => {
    if (!selectedA || !selectedB) return null;

    const metaA: VersionMeta = {
      id: selectedA.id,
      name: selectedA.version_name,
      versionNumber: selectedA.version_number,
      neutralityScore: selectedA.neutrality_score,
      atsScore: selectedA.snapshot.report?.ats_match?.overall_match_score,
      totalFlags: selectedA.snapshot.report?.summary?.total_flags || 0,
      createdAt: selectedA.created_at,
    };

    const metaB: VersionMeta = {
      id: selectedB.id,
      name: selectedB.version_name,
      versionNumber: selectedB.version_number,
      neutralityScore: selectedB.neutrality_score,
      atsScore: selectedB.snapshot.report?.ats_match?.overall_match_score,
      totalFlags: selectedB.snapshot.report?.summary?.total_flags || 0,
      createdAt: selectedB.created_at,
    };

    return compareVersionSnapshots(selectedA.snapshot, selectedB.snapshot, metaA, metaB);
  }, [selectedA, selectedB]);

  function handleRestore(version: CloudResumeVersionRecord) {
    if (!onRestoreVersion) return;
    onRestoreVersion(version);
    onOpenChange(false);
    toast.success(`Restored to ${version.version_name}`, {
      description: "Canvas blocks and audit telemetry rolled back successfully.",
    });
  }

  if (versions.length < 2) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
            <GitCompare className="h-6 w-6" />
          </div>
          <DialogTitle className="text-base font-bold">At Least 2 Versions Required</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            You currently have {versions.length} version snapshot saved for "{activeResumeTitle}".
            Save another version point to enable side-by-side visual diffing.
          </DialogDescription>
          <div className="mt-4 flex justify-center">
            <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-6 sm:p-7">
        <DialogHeader className="space-y-1 shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <GitCompare className="h-5 w-5" />
            </span>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                Side-by-Side Version Diff Inspector
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Compare text alterations, keyword injections, and telemetry shifts between two
                snapshots.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Version Pickers Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3 p-3 rounded-xl border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Base (Version A):
            </span>
            <Select value={selectedA?.id || ""} onValueChange={(val) => setVersionAId(val)}>
              <SelectTrigger className="h-8 text-xs font-medium bg-background">
                <SelectValue placeholder="Select base version" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version_number} — {v.version_name} ({v.neutrality_score}% Neutrality)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Compare (Version B):
            </span>
            <Select value={selectedB?.id || ""} onValueChange={(val) => setVersionBId(val)}>
              <SelectTrigger className="h-8 text-xs font-medium bg-background">
                <SelectValue placeholder="Select comparison version" />
              </SelectTrigger>
              <SelectContent>
                {sorted.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version_number} — {v.version_name} ({v.neutrality_score}% Neutrality)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Telemetry Shift KPI Bar */}
        {diffResult && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-1 shrink-0">
            {/* Metric 1: Neutrality Delta */}
            <div className="p-3 rounded-lg border bg-card/60 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                Neutrality Index
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm text-muted-foreground font-mono">
                  {diffResult.versionA.neutralityScore}%
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-base font-bold font-mono text-foreground">
                  {diffResult.versionB.neutralityScore}%
                </span>
                <Badge
                  variant={diffResult.neutralityDelta >= 0 ? "default" : "destructive"}
                  className="h-4 px-1 text-[10px] ml-auto font-mono"
                >
                  {diffResult.neutralityDelta >= 0
                    ? `+${diffResult.neutralityDelta}%`
                    : `${diffResult.neutralityDelta}%`}
                </Badge>
              </div>
            </div>

            {/* Metric 2: ATS Match Delta */}
            <div className="p-3 rounded-lg border bg-card/60 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Target className="h-3 w-3 text-primary" />
                ATS Match Score
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm text-muted-foreground font-mono">
                  {diffResult.versionA.atsScore ?? "—"}%
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-base font-bold font-mono text-foreground">
                  {diffResult.versionB.atsScore ?? "—"}%
                </span>
                <Badge
                  variant={diffResult.atsDelta >= 0 ? "secondary" : "outline"}
                  className="h-4 px-1 text-[10px] ml-auto font-mono text-primary"
                >
                  {diffResult.atsDelta >= 0
                    ? `+${diffResult.atsDelta}%`
                    : `${diffResult.atsDelta}%`}
                </Badge>
              </div>
            </div>

            {/* Metric 3: Active Bias Flags */}
            <div className="p-3 rounded-lg border bg-card/60 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-amber-500" />
                Active Bias Flags
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-sm text-muted-foreground font-mono">
                  {diffResult.versionA.totalFlags}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-base font-bold font-mono text-foreground">
                  {diffResult.versionB.totalFlags}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1 text-[10px] ml-auto font-mono",
                    diffResult.flagsDelta <= 0
                      ? "text-emerald-600 border-emerald-500/30"
                      : "text-destructive",
                  )}
                >
                  {diffResult.flagsDelta <= 0
                    ? `${diffResult.flagsDelta} flags`
                    : `+${diffResult.flagsDelta} flags`}
                </Badge>
              </div>
            </div>

            {/* Metric 4: Diff Changes Counter */}
            <div className="p-3 rounded-lg border bg-card/60 flex flex-col justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Layers className="h-3 w-3 text-sky-500" />
                Block Modifications
              </span>
              <div className="flex items-center gap-2 mt-1 text-xs">
                <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                  <Plus className="h-3 w-3" />
                  {diffResult.summary.addedCount}
                </span>
                <span className="text-amber-500 font-medium flex items-center gap-0.5">
                  <Edit3 className="h-3 w-3" />
                  {diffResult.summary.modifiedCount}
                </span>
                <span className="text-destructive font-medium flex items-center gap-0.5">
                  <Minus className="h-3 w-3" />
                  {diffResult.summary.removedCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Side-by-Side Diff Comparison Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-[280px] overflow-hidden my-2">
          {/* Left Panel: Version A */}
          <div className="flex flex-col rounded-xl border bg-background overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-xs text-foreground truncate">
                  v{selectedA?.version_number}: {selectedA?.version_name}
                </span>
              </div>
              {onRestoreVersion && selectedA && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRestore(selectedA)}
                  className="h-6 text-[10px] gap-1 px-2 shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  Rollback to A
                </Button>
              )}
            </div>
            <div className="p-3 overflow-y-auto space-y-2 flex-1 text-xs leading-relaxed font-sans">
              {diffResult?.blockDiffs.map((diff) => {
                if (diff.status === "added") return null;

                return (
                  <div
                    key={`A-${diff.id}`}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      diff.status === "removed" &&
                        "bg-destructive/10 border border-destructive/20 text-destructive line-through",
                      diff.status === "modified" && "bg-amber-500/5 border border-amber-500/20",
                      diff.status === "unchanged" && "bg-muted/10 text-foreground/85",
                    )}
                  >
                    {diff.status === "modified" ? (
                      <div>
                        {diff.chunks.map((chunk, i) => (
                          <span
                            key={i}
                            className={cn(
                              chunk.type === "removed" &&
                                "bg-destructive/20 text-destructive line-through px-0.5 rounded",
                              chunk.type === "added" && "hidden",
                            )}
                          >
                            {chunk.text}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span>{diff.originalText}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Version B */}
          <div className="flex flex-col rounded-xl border bg-background overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-semibold text-xs text-foreground truncate">
                  v{selectedB?.version_number}: {selectedB?.version_name}
                </span>
              </div>
              {onRestoreVersion && selectedB && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRestore(selectedB)}
                  className="h-6 text-[10px] gap-1 px-2 shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  Rollback to B
                </Button>
              )}
            </div>
            <div className="p-3 overflow-y-auto space-y-2 flex-1 text-xs leading-relaxed font-sans">
              {diffResult?.blockDiffs.map((diff) => {
                if (diff.status === "removed") return null;

                return (
                  <div
                    key={`B-${diff.id}`}
                    className={cn(
                      "p-2 rounded-md transition-colors",
                      diff.status === "added" &&
                        "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-medium",
                      diff.status === "modified" && "bg-amber-500/5 border border-amber-500/20",
                      diff.status === "unchanged" && "bg-muted/10 text-foreground/85",
                    )}
                  >
                    {diff.status === "modified" ? (
                      <div>
                        {diff.chunks.map((chunk, i) => (
                          <span
                            key={i}
                            className={cn(
                              chunk.type === "added" &&
                                "bg-emerald-500/20 text-emerald-600 font-semibold px-0.5 rounded",
                              chunk.type === "removed" && "hidden",
                            )}
                          >
                            {chunk.text}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span>{diff.newText}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend & Footer */}
        <div className="flex items-center justify-between pt-2 border-t text-[11px] text-muted-foreground shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Added words</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              <span>Removed words</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Modified blocks</span>
            </span>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-7 text-xs"
          >
            Done Inspecting
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
