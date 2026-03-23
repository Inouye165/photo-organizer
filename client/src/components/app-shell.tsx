import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 pb-8 pt-8 sm:px-6 lg:px-8 lg:pt-12">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-moss">Phase 1</p>
            <h1 className="font-serif text-4xl leading-tight text-ink sm:text-5xl">
              A real gallery built from your disk, your database, and real generated media.
            </h1>
          </div>
          <p className="max-w-xl text-sm leading-6 text-black/65 sm:text-base">
            Scan configured roots, index originals, generate derivatives, and browse the resulting
            library without placeholder data.
          </p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-12 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
