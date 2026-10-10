import { CheckCircle2, Loader2, Sparkles, FileText, Layers, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ProcessingStep {
  id: string;
  label: string;
  description: string;
  icon: typeof FileText;
}

export const PROCESSING_STEPS: ProcessingStep[] = [
  {
    id: "extract",
    label: "Parsing Document & Glyphs",
    description: "Extracting structured text coordinates and font vectors",
    icon: FileText,
  },
  {
    id: "cluster",
    label: "Clustering Layout Frames",
    description: "Reconstructing margins, text blocks, and vector canvas geometry",
    icon: Layers,
  },
  {
    id: "analyze",
    label: "Auditing Bias Taxonomy",
    description: "Screening gender, age, prestige, disability, and gap phrasing",
    icon: Sparkles,
  },
  {
    id: "fairness",
    label: "Calibrating Neutrality Index",
    description: "Simulating counterfactual perturbations and fairness scores",
    icon: ShieldCheck,
  },
];

interface ProcessingDialogProps {
  open: boolean;
  fileName?: string;
  currentStepIndex: number; // 0 to 3
}

export function ProcessingDialog({ open, fileName, currentStepIndex }: ProcessingDialogProps) {
  const percent = Math.min(
    100,
    Math.round(((currentStepIndex + 1) / PROCESSING_STEPS.length) * 100),
  );

  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md border-border/80 bg-card/95 backdrop-blur-md shadow-2xl p-6 sm:p-7"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Loader2 className="size-5 animate-spin" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Analyzing Resume Intelligence
              </DialogTitle>
              {fileName && (
                <p className="text-xs text-muted-foreground truncate max-w-[280px]">{fileName}</p>
              )}
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground pt-1">
            BiasLens is processing your document private-first in memory without cloud transmission.
          </DialogDescription>
        </DialogHeader>

        {/* Linear Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
            <span>Progress</span>
            <span className="text-primary font-bold">{percent}%</span>
          </div>
          <Progress value={percent} className="h-2 rounded-full" />
        </div>

        {/* Steps List */}
        <div className="space-y-3 pt-3">
          {PROCESSING_STEPS.map((step, idx) => {
            const isDone = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isPending = idx > currentStepIndex;
            const StepIcon = step.icon;

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-2.5 transition-all text-xs",
                  isCurrent && "border-primary/50 bg-primary/5 shadow-2xs",
                  isDone && "border-emerald-500/20 bg-emerald-500/5",
                  isPending && "border-transparent opacity-40",
                )}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="size-4 text-emerald-500" />
                  ) : isCurrent ? (
                    <Loader2 className="size-4 text-primary animate-spin" />
                  ) : (
                    <StepIcon className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "font-semibold leading-none",
                      isDone && "text-foreground",
                      isCurrent && "text-primary",
                      isPending && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-tight">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
