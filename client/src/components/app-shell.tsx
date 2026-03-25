import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen min-h-dvh flex-col overflow-x-clip">
      <header className="mx-auto flex w-full max-w-7xl shrink-0 items-center justify-between gap-4 px-4 pb-3 pt-4 sm:px-6 lg:px-8 lg:pb-4 lg:pt-5">
        <div className="min-w-0">
          <h1 className="font-serif text-2xl leading-none text-ink sm:text-3xl">Photo Organizer</h1>
          <p className="mt-1 text-sm text-black/60 sm:text-[15px]">
            Scan selected folders, index your photos, and browse them by date.
          </p>
        </div>
        <div className="hidden rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45 lg:block">
          Phase 1
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-3 overflow-y-auto px-4 pb-6 sm:px-6 lg:min-h-0 lg:px-8 lg:pb-8">
        {children}
      </main>
    </div>
  );
}
