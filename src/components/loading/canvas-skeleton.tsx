import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface CanvasSkeletonProps {
  className?: string;
  pageCount?: number;
}

export function CanvasSkeleton({ className, pageCount = 1 }: CanvasSkeletonProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-start overflow-hidden bg-slate-100/70 p-6 dark:bg-zinc-950/80 rounded-xl border border-border/50",
        className,
      )}
    >
      {/* Editor Toolbar Skeleton */}
      <div className="mb-4 flex w-full max-w-[650px] items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/90 px-3 py-2 shadow-xs backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-20 rounded" />
          <Skeleton className="h-7 w-12 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
          <Skeleton className="h-7 w-7 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded" />
          <Skeleton className="h-7 w-8 rounded" />
        </div>
      </div>

      {/* Pages Container */}
      <div className="flex flex-col gap-6 items-center w-full">
        {Array.from({ length: pageCount }).map((_, pageIdx) => (
          <div
            key={pageIdx}
            className="w-full max-w-[595px] aspect-[1/1.414] rounded-lg border border-border/80 bg-card p-10 shadow-lg relative flex flex-col gap-5"
          >
            {/* Header: Candidate Name & Title */}
            <div className="space-y-2 border-b border-border/50 pb-4">
              <Skeleton className="h-7 w-2/5 rounded" />
              <Skeleton className="h-4 w-1/3 rounded" />
              <div className="flex items-center gap-3 pt-1">
                <Skeleton className="h-3 w-28 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
                <Skeleton className="h-3 w-32 rounded-full" />
              </div>
            </div>

            {/* Professional Summary */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4 rounded font-semibold" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-11/12 rounded" />
              <Skeleton className="h-3 w-4/5 rounded" />
            </div>

            {/* Experience Section 1 */}
            <div className="space-y-3 pt-2">
              <Skeleton className="h-4 w-1/3 rounded" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-3.5 w-44 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
              <div className="space-y-2 pl-3">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <Skeleton className="h-3 w-full rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <Skeleton className="h-3 w-10/12 rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <Skeleton className="h-3 w-4/5 rounded" />
                </div>
              </div>
            </div>

            {/* Experience Section 2 */}
            <div className="space-y-3 pt-2">
              <div className="flex justify-between items-center">
                <Skeleton className="h-3.5 w-40 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
              <div className="space-y-2 pl-3">
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <Skeleton className="h-3 w-11/12 rounded" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <Skeleton className="h-3 w-3/4 rounded" />
                </div>
              </div>
            </div>

            {/* Skills & Education Tags */}
            <div className="mt-auto pt-4 border-t border-border/40 space-y-2">
              <Skeleton className="h-3.5 w-1/5 rounded" />
              <div className="flex flex-wrap gap-1.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-18 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
