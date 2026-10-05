import {
  AlertTriangle,
  CheckCircle2,
  LockKeyhole,
  Scale,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EthicsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EthicsModal({ open, onOpenChange }: EthicsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-0">
        <DialogHeader className="border-b p-6 pr-12">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-6" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Phase 7: Ethical Framing & Methodology
            </span>
          </div>
          <DialogTitle className="mt-1 font-display text-2xl font-bold">
            Ethical Considerations, Limitations & Privacy Guarantees
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Academic framing of proxy variables, statistical trade-offs, and privacy protection protocols.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-6 text-xs leading-relaxed text-muted-foreground">
          {/* Important distinction */}
          <div className="rounded-lg border-l-4 border-amber-500 bg-amber-500/10 p-4 text-foreground">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <span>Crucial Distinction: Proxy Detection vs. Ground-Truth Discrimination</span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              BiasLens identifies <strong>linguistic and structural proxies</strong> that historical research shows correlate with unfair screening heuristics in human and automated ATS screeners. Flagging an adjective or date does <em>not</em> imply malicious discriminatory intent by the applicant or employer; rather, it identifies vulnerability vectors that can trigger unconscious screening penalties.
            </p>
          </div>

          {/* Core tenets */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-display text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Scale className="size-4 text-primary" /> False Positives vs. False Negatives
              </h4>
              <p className="mt-2 text-xs leading-relaxed">
                In employment screening, false negatives (failing to flag coded discriminatory signals) perpetuate structural inequality. However, overly aggressive false positives risk homogenizing candidate authentic self-expression. BiasLens balances this via confidence calibration (only highlighting terms with ≥ 80% confidence) and actionable neutral rewrites.
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4">
              <h4 className="font-display text-sm font-semibold text-foreground flex items-center gap-1.5">
                <LockKeyhole className="size-4 text-emerald-600" /> Private by Design (Zero-Retention)
              </h4>
              <p className="mt-2 text-xs leading-relaxed">
                Resumes contain sensitive Personally Identifiable Information (PII) including candidate names, addresses, educational history, and career transitions. BiasLens performs all PDF parsing and initial NLP token analysis strictly in-browser memory. Uploaded documents are never permanently stored or logged.
              </p>
            </div>
          </div>

          {/* Academic Literature Foundations */}
          <div className="rounded-lg border bg-card p-4">
            <h4 className="font-display text-sm font-semibold text-foreground">
              Academic Foundations & Primary Research Citations
            </h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  <strong>Gaucher, Friesen, & Kay (2011):</strong> "Evidence That Gendered Wording in Job Advertisements Exists and Sustains Gender Inequality." <em>Journal of Personality and Social Psychology</em>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  <strong>Rivera, Lauren A. (2012):</strong> "Pedigree: How Elite Students Get Elite Jobs." <em>Research in Social Stratification and Mobility</em>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  <strong>Bertrand, M. & Mullainathan, S. (2004):</strong> "Are Emily and Greg More Employable Than Lakisha and Jamal? A Field Experiment on Labor Market Discrimination." <em>American Economic Review</em>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  <strong>Neumark, Burn, & Button (2019):</strong> "Is It Harder for Older Workers to Find Jobs? New and Improved Evidence from a Field Experiment." <em>Journal of Political Economy</em>.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
