import { Suspense } from "react";
import { NavLinks } from "./nav-links";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <span className="font-bold">
            <span className="text-accent">1h</span> Break Planner
          </span>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-muted hover:text-text">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-28">
        <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
      </main>
      <Suspense fallback={<nav className="fixed inset-x-0 bottom-0 h-16 border-t border-border bg-surface" />}>
        <NavLinks />
      </Suspense>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-8 w-1/2 animate-pulse rounded-lg bg-surface-2" />
      <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
      <div className="h-32 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}
