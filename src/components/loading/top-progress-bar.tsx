import { cn } from "@/lib/utils";

interface TopProgressBarProps {
  loading: boolean;
  progress?: number; // 0 to 100 optional determinate value
  className?: string;
}

export function TopProgressBar({ loading, progress, className }: TopProgressBarProps) {
  if (!loading) return null;

  const isDeterminate = typeof progress === "number" && progress >= 0 && progress <= 100;

  return (
    <div
      role="progressbar"
      aria-label="Loading workspace data"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isDeterminate ? progress : undefined}
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] h-1 overflow-hidden bg-primary/10",
        className,
      )}
    >
      <div
        className={cn(
          "h-full bg-gradient-to-r from-primary via-sky-500 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] transition-all duration-300 ease-out",
          isDeterminate ? "w-full" : "w-1/2 animate-top-progress",
        )}
        style={isDeterminate ? { width: `${progress}%` } : undefined}
      />
    </div>
  );
}
