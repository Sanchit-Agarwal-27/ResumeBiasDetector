import { BarChart3, CheckCircle2, Cpu, Layers, Sparkles, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EVALUATION_BENCHMARK_DATA } from "@/lib/bias-taxonomy";

interface EvaluationBenchmarkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EvaluationBenchmarkModal({ open, onOpenChange }: EvaluationBenchmarkModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto p-0">
        <DialogHeader className="border-b p-6 pr-12">
          <div className="flex items-center gap-2 text-primary">
            <BarChart3 className="size-6" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Phase 5: Empirical Evaluation & Validation
            </span>
          </div>
          <DialogTitle className="mt-1 font-display text-2xl font-bold">
            Detection Engine Evaluation & Ablation Study
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Precision, recall, and F1 scores measured against a human-annotated test set of 120
            resumes with inter-annotator agreement validation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-6">
          {/* Key Summary Stats */}
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Layers className="size-4" />
                <span className="text-[11px] font-semibold uppercase">Dataset Size</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold">120</p>
              <p className="text-xs text-muted-foreground">Annotated resumes</p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4" />
                <span className="text-[11px] font-semibold uppercase">Agreement</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold">0.81</p>
              <p className="text-xs text-muted-foreground">Cohen's Kappa (κ)</p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="size-4 text-primary" />
                <span className="text-[11px] font-semibold uppercase">Hybrid F1 Score</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold text-primary">0.88</p>
              <p className="text-xs text-muted-foreground">+24% vs Lexicon</p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Cpu className="size-4" />
                <span className="text-[11px] font-semibold uppercase">Inference Time</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold">198 ms</p>
              <p className="text-xs text-muted-foreground">Dual-pass latency</p>
            </div>
          </div>

          {/* Ablation Study Table */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="border-b bg-muted/30 px-5 py-3">
              <h3 className="font-display text-base font-semibold">
                Ablation Study: Lexicon-Only vs. Transformer vs. BiasLens Hybrid
              </h3>
              <p className="text-xs text-muted-foreground">
                Comparing architecture performance on precision, recall, and false-positive rates
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/60 text-[11px] font-bold uppercase text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Architecture / Model</th>
                    <th className="py-3 px-3 text-center">Precision</th>
                    <th className="py-3 px-3 text-center">Recall</th>
                    <th className="py-3 px-3 text-center">F1 Score</th>
                    <th className="py-3 px-3 text-center">Latency</th>
                    <th className="py-3 px-4">Qualitative Trade-Off</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {EVALUATION_BENCHMARK_DATA.map((bm, index) => {
                    const isWinner = index === 2;
                    return (
                      <tr
                        key={bm.model_name}
                        className={isWinner ? "bg-primary/5 font-medium" : "hover:bg-muted/20"}
                      >
                        <td className="py-3.5 px-4 font-semibold text-foreground">
                          {isWinner && (
                            <span className="mr-2 inline-flex items-center rounded-sm bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                              BEST
                            </span>
                          )}
                          {bm.model_name}
                        </td>
                        <td className="py-3.5 px-3 text-center text-sm font-semibold">
                          {(bm.precision * 100).toFixed(0)}%
                        </td>
                        <td className="py-3.5 px-3 text-center text-sm font-semibold">
                          {(bm.recall * 100).toFixed(0)}%
                        </td>
                        <td className="py-3.5 px-3 text-center text-sm font-bold text-primary">
                          {bm.f1_score.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-3 text-center text-muted-foreground">
                          {bm.latency_ms} ms
                        </td>
                        <td className="py-3.5 px-4 text-muted-foreground leading-relaxed">
                          {bm.notes}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Annotation Protocol & Inter-annotator reliability */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-display text-sm font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="size-4 text-emerald-600" /> Human Annotation Protocol
              </h4>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Test resumes were annotated by 3 independent reviewers across computer science,
                engineering, and business disciplines using the standardized 5-category taxonomy
                (Gaucher word lists, ADEA guidelines, and Rivera prestige proxies).
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-display text-sm font-semibold flex items-center gap-1.5">
                <Sparkles className="size-4 text-primary" /> Key Empirical Finding
              </h4>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Lexicon-only matching suffers from high false-positive rates on multi-meaning words
                (e.g., "aggressive timeline"), whereas the contextual dual-pass achieves 91%
                precision by confirming role-agency syntax.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
