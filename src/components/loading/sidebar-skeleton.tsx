import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface SidebarSkeletonProps {
  className?: string;
}

export function SidebarSkeleton({ className }: SidebarSkeletonProps) {
  return (
    <div className={cn("flex flex-col bg-card h-full p-5 space-y-6", className)}>
      {/* Review Queue Header */}
      <div className="space-y-4 border-b pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-2.5 w-20 rounded" />
            <Skeleton className="h-5 w-32 rounded" />
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>

        {/* Issue Number Badges */}
        <div className="flex gap-1.5 overflow-hidden">
          <Skeleton className="size-8 rounded-md shrink-0" />
          <Skeleton className="size-8 rounded-md shrink-0" />
          <Skeleton className="size-8 rounded-md shrink-0" />
          <Skeleton className="size-8 rounded-md shrink-0" />
          <Skeleton className="size-8 rounded-md shrink-0" />
        </div>
      </div>

      {/* Active Issue Meta */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-24 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
          <Skeleton className="h-4 w-24 rounded" />
        </div>

        {/* Flagged Phrase Title */}
        <div className="space-y-2">
          <Skeleton className="h-8 w-3/4 rounded" />
          <Skeleton className="h-3.5 w-full rounded" />
          <Skeleton className="h-3.5 w-5/6 rounded" />
        </div>

        {/* Research Citation */}
        <Skeleton className="h-3 w-2/3 rounded" />
      </div>

      {/* Suggested Revision Diff Box */}
      <div className="rounded-lg border p-4 bg-muted/20 space-y-3">
        <Skeleton className="h-3 w-28 rounded" />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border p-3 space-y-2">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <div className="rounded-md border p-3 space-y-2">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
        </div>
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-[1fr_auto] gap-2 pt-2">
        <Skeleton className="h-10 rounded-md" />
        <Skeleton className="h-10 w-24 rounded-md" />
      </div>
    </div>
  );
}
