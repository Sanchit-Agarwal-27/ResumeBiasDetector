import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Download, RefreshCw, RotateCcw, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[BiasLens ErrorBoundary] Uncaught runtime crash:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  private handleClearCacheAndReset = () => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("biaslens_active_blocks_v1");
        localStorage.removeItem("biaslens_active_pages_v1");
        localStorage.removeItem("biaslens_active_report_v1");
        localStorage.removeItem("biaslens_cached_workspace");
      } catch {
        // ignore
      }
      window.location.reload();
    }
  };

  private handleEmergencyExport = () => {
    if (typeof window === "undefined") return;

    try {
      let recoveredText = "";

      // 1. Try reading blocks
      const rawBlocks = localStorage.getItem("biaslens_active_blocks_v1");
      if (rawBlocks) {
        const blocks = JSON.parse(rawBlocks) as Array<{ text?: string }>;
        recoveredText = blocks
          .map((b) => b.text || "")
          .filter(Boolean)
          .join("\n\n");
      }

      // 2. Fallback to active report
      if (!recoveredText) {
        const rawReport = localStorage.getItem("biaslens_active_report_v1");
        if (rawReport) {
          const report = JSON.parse(rawReport) as { raw_text?: string };
          recoveredText = report.raw_text || "";
        }
      }

      // 3. Fallback to cached workspace
      if (!recoveredText) {
        recoveredText = localStorage.getItem("biaslens_cached_workspace") || "";
      }

      if (!recoveredText) {
        recoveredText = "No cached draft could be recovered from local memory.";
      }

      const blob = new Blob([recoveredText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `biaslens-emergency-backup-${Date.now()}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ErrorBoundary] Emergency export failed:", err);
    }
  };

  private handleCopyError = () => {
    const errorDetails = `BiasLens Crash Report\nError: ${this.state.error?.message}\nStack: ${this.state.error?.stack}\nComponent Stack: ${this.state.errorInfo?.componentStack}`;
    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
          <div className="w-full max-w-xl rounded-2xl border border-destructive/20 bg-card p-6 shadow-xl space-y-6">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="size-6" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Workspace Error Encountered
                </h1>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  An unexpected rendering issue occurred in the editor. Your draft content is
                  preserved in browser storage. You can recover your text or refresh the workspace.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="font-semibold text-foreground">Diagnostic Details</span>
                <button
                  type="button"
                  onClick={this.handleCopyError}
                  className="flex items-center gap-1 hover:text-foreground cursor-pointer transition-colors"
                >
                  {this.state.copied ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  <span>{this.state.copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-destructive break-words line-clamp-3">
                {this.state.error?.message || "Unknown client error"}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleEmergencyExport}
                className="text-xs gap-1.5"
                title="Extract and download your active text draft as a text file"
              >
                <Download className="size-3.5 text-primary" />
                <span>Recover Draft (.txt)</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleClearCacheAndReset}
                  className="text-xs text-muted-foreground hover:text-destructive gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Clear Cache & Reset</span>
                </Button>
                <Button size="sm" onClick={this.handleReset} className="text-xs gap-1.5">
                  <RefreshCw className="size-3.5" />
                  <span>Reload Workspace</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
