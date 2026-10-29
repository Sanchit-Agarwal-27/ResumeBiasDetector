import React, { useState, useMemo } from "react";
import {
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  ShieldCheck,
  RotateCcw,
  Sliders,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BiasSpan, RewriteSuggestion } from "@/lib/resume-contract";
import {
  selectMitigationRecommendation,
  globalFeedbackStore,
  globalBanditPolicy,
  REWARD_SCALE,
  type FeedbackRating,
  type RecommendationOption,
  type RLRecommendationSelection,
} from "@/lib/rl";
import {
  fetchBackendRLRecommendation,
  sendBackendRLFeedback,
} from "@/lib/analysis-service";

interface RLRecommendationCardProps {
  activeSpan: BiasSpan;
  baselineSuggestion?: RewriteSuggestion;
  customRewrite: string;
  engineMode?: "local" | "fastapi";
  fastApiUrl?: string;
  onSelectRewrite: (text: string) => void;
  onApplyRewrite: () => void;
  onDismiss: () => void;
}

export function RLRecommendationCard({
  activeSpan,
  baselineSuggestion,
  customRewrite,
  engineMode = "local",
  fastApiUrl,
  onSelectRewrite,
  onApplyRewrite,
  onDismiss,
}: RLRecommendationCardProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [submittedRating, setSubmittedRating] = useState<FeedbackRating | null>(null);

  // Compute RL recommendation selection for the active span
  const rlSelection: RLRecommendationSelection = useMemo(() => {
    return selectMitigationRecommendation(activeSpan, baselineSuggestion);
  }, [activeSpan.id, activeSpan.category, activeSpan.severity, baselineSuggestion]);

  // Active chosen option (can be switched by clicking an alternative)
  const [chosenActionId, setChosenActionId] = useState<string>(rlSelection.selectedAction);

  // Sync chosen action when span changes
  React.useEffect(() => {
    setChosenActionId(rlSelection.selectedAction);
    setSubmittedRating(null);
  }, [activeSpan.id, rlSelection.selectedAction]);

  const activeOption: RecommendationOption = useMemo(() => {
    return (
      rlSelection.allOptions.find((o) => o.actionId === chosenActionId) ||
      rlSelection.selectedOption
    );
  }, [rlSelection, chosenActionId]);

  function handlePickOption(option: RecommendationOption) {
    setChosenActionId(option.actionId);
    onSelectRewrite(option.suggestedText);
    toast.info(`Selected: ${option.label}`, {
      description: option.strategyDescription,
    });
  }

  function handleSendFeedback(rating: FeedbackRating) {
    const stateVector = Object.values(rlSelection.stateFeatures);
    const res = globalFeedbackStore.recordFeedback({
      spanId: activeSpan.id,
      category: activeSpan.category,
      actionId: activeOption.actionId,
      rating,
      suggestedText: activeOption.suggestedText,
      userEditedText: customRewrite !== activeOption.suggestedText ? customRewrite : undefined,
      policyVersion: rlSelection.policyVersion,
      stateVector,
    });

    // 1. Immediately update client-side LinUCB weights in real-time
    const numericReward = REWARD_SCALE[rating] ?? 0.0;
    if (stateVector.length === 8) {
      globalBanditPolicy.updateArm(activeOption.actionId, stateVector, numericReward);
    }

    // 2. Dispatch feedback to Python FastAPI backend if in FastAPI mode
    if (engineMode === "fastapi") {
      sendBackendRLFeedback(
        {
          spanId: activeSpan.id,
          actionId: activeOption.actionId,
          rating,
          suggestedText: activeOption.suggestedText,
          userEditedText: customRewrite !== activeOption.suggestedText ? customRewrite : undefined,
          stateFeatures: stateVector,
          policyVersion: rlSelection.policyVersion,
        },
        fastApiUrl,
      ).catch(() => {});
    }

    if (res.success) {
      setSubmittedRating(rating);
      toast.success("Feedback recorded for RL Agent!", {
        description: `Your rating (${rating.replace("_", " ")}) refines LinUCB policy weights in real-time.`,
      });
    } else if (res.message) {
      toast.info(res.message);
    }
  }

  return (
    <div className="space-y-4">
      {/* HEADER: RL SELECTION BADGE & EXPLAINABILITY TOGGLE */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-semibold gap-1 py-0.5 px-2",
              rlSelection.decisionSource === "rl_policy"
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted text-muted-foreground border-border",
            )}
          >
            <Sparkles className="size-3 text-primary animate-pulse" />
            <span>
              {rlSelection.decisionSource === "rl_policy"
                ? `RL Policy (${rlSelection.policyVersion})`
                : "Rule Baseline"}
            </span>
          </Badge>
          <span className="text-[10px] text-muted-foreground font-mono">
            UCB: {activeOption.confidenceBound.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
        >
          <Info className="size-3" />
          <span>Why this was chosen</span>
        </button>
      </div>

      {/* EXPLAINABILITY DRAWER / POPOVER */}
      {showExplanation && (
        <div className="rounded-lg border bg-muted/40 p-3 text-xs space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Sliders className="size-3 text-primary" />
              Bandit Policy Reasoning
            </span>
            <span className="text-[10px] text-muted-foreground">
              Est. Reward: {activeOption.expectedReward.toFixed(2)} | Bonus: +{activeOption.explorationBonus.toFixed(2)}
            </span>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {rlSelection.reasoning}
          </p>

          <div className="pt-1.5 border-t border-muted-foreground/10 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            <div>
              <span>Finding: </span>
              <strong className="text-foreground">{activeSpan.matched_text}</strong>
            </div>
            <div>
              <span>Category Satisfaction: </span>
              <strong className="text-foreground">
                {(rlSelection.historicalCategoryStats.positiveRate * 100).toFixed(0)}% (
                {rlSelection.historicalCategoryStats.totalInteractions} reviews)
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* SUGGESTED REVISION BOX WITH EDITABLE TEXTAREA */}
      <div className="rounded-xl border p-4 bg-muted/20 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {activeOption.label} Strategy
          </span>
          {customRewrite !== (activeOption.suggestedText || "") && (
            <button
              type="button"
              onClick={() => onSelectRewrite(activeOption.suggestedText || "")}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="size-2.5" />
              Reset to suggestion
            </button>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Before */}
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <span className="text-[10px] font-bold uppercase text-destructive block mb-1">
              Before
            </span>
            <p className="text-xs font-semibold text-destructive break-words font-mono">
              "{activeSpan.matched_text}"
            </p>
          </div>

          {/* After */}
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                After (Editable)
              </span>
              {activeOption.suggestedText === "" && (
                <span className="text-[9px] text-muted-foreground font-mono">Omit token</span>
              )}
            </div>
            <textarea
              value={customRewrite}
              onChange={(e) => onSelectRewrite(e.target.value)}
              placeholder="Custom neutral rewrite..."
              rows={2}
              className="w-full flex-1 min-h-[52px] resize-y rounded border border-emerald-500/30 bg-background/90 p-2 text-xs font-mono font-medium text-foreground focus:border-emerald-500 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {activeOption.rationale}
        </p>

        {/* FEEDBACK CONTROLS */}
        <div className="pt-2 border-t flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] font-medium text-muted-foreground">
            Was this recommendation helpful?
          </span>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant={submittedRating === "helpful" ? "default" : "outline"}
              size="sm"
              onClick={() => handleSendFeedback("helpful")}
              className="h-6 text-[10px] px-2 gap-1 cursor-pointer"
            >
              <ThumbsUp className="size-2.5" />
              Helpful
            </Button>
            <Button
              type="button"
              variant={submittedRating === "partially_helpful" ? "secondary" : "outline"}
              size="sm"
              onClick={() => handleSendFeedback("partially_helpful")}
              className="h-6 text-[10px] px-2 gap-1 cursor-pointer"
            >
              Partial
            </Button>
            <Button
              type="button"
              variant={submittedRating === "not_helpful" ? "destructive" : "outline"}
              size="sm"
              onClick={() => handleSendFeedback("not_helpful")}
              className="h-6 text-[10px] px-2 gap-1 cursor-pointer"
            >
              <ThumbsDown className="size-2.5" />
              Not helpful
            </Button>
          </div>
        </div>
      </div>

      {/* ALTERNATIVE RECOMMENDATIONS ACCORDION */}
      {rlSelection.allOptions.length > 1 && (
        <div className="rounded-lg border bg-card/60 p-2.5 space-y-2">
          <button
            type="button"
            onClick={() => setShowAlternatives(!showAlternatives)}
            className="w-full flex items-center justify-between text-xs font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <span>
              Alternative Mitigation Strategies ({rlSelection.allOptions.length - 1} available)
            </span>
            {showAlternatives ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>

          {showAlternatives && (
            <div className="space-y-1.5 pt-1 border-t">
              {rlSelection.allOptions
                .filter((opt) => opt.actionId !== activeOption.actionId)
                .map((alt) => (
                  <div
                    key={alt.actionId}
                    onClick={() => handlePickOption(alt)}
                    className="p-2 rounded-md border bg-background hover:bg-muted/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground">{alt.label}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          (UCB: {alt.confidenceBound.toFixed(2)})
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {alt.suggestedText ? `"${alt.suggestedText}"` : "Omit / Remove text"} — {alt.rationale}
                      </p>
                    </div>

                    <Button variant="ghost" size="sm" className="h-6 text-[10px] shrink-0 ml-2">
                      Switch
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
