import { Skeleton } from "@/components/ui/skeleton";
import { CanvasSkeleton } from "./canvas-skeleton";
import { SidebarSkeleton } from "./sidebar-skeleton";

export function PageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground animate-in fade-in duration-200">
      {/* HEADER SKELETON */}
      <header className="border-b bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:px-5">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <Skeleton className="size-9 rounded-xl shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-20 rounded" />
              <Skeleton className="h-2.5 w-28 rounded" />
            </div>
          </div>

          {/* Neutrality Index Gauge Skeleton */}
          <div className="hidden items-center gap-3 border-l pl-4 lg:flex">
            <Skeleton className="size-11 rounded-full shrink-0" />
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-2.5 w-16 rounded" />
            </div>
          </div>

          {/* Category Filter Pills Skeleton */}
          <div className="hidden lg:flex items-center justify-center gap-1.5 px-4">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>

          {/* Action Buttons & Profile Skeleton */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md hidden sm:block" />
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
        </div>
      </header>

      {/* WORKSPACE MAIN BODY SKELETON */}
      <main className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,3.5fr)_minmax(330px,1.5fr)]">
        {/* Left: Canvas Area */}
        <section className="min-w-0 border-b p-3 sm:p-5 lg:border-b-0 lg:border-r flex flex-col bg-slate-50 dark:bg-zinc-950">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
          <div className="flex-1 min-h-[640px]">
            <CanvasSkeleton className="h-full" />
          </div>
        </section>

        {/* Right: Sidebar Queue */}
        <aside className="min-w-0 bg-card lg:border-l">
          <SidebarSkeleton />
        </aside>
      </main>

      {/* FOOTER SKELETON */}
      <footer className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t bg-card px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3 w-64 rounded" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded" />
          <Skeleton className="h-6 w-20 rounded" />
          <Skeleton className="h-6 w-28 rounded" />
        </div>
      </footer>
    </div>
  );
}
