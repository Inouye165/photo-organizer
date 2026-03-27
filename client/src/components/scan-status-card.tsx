import { formatDistanceToNowStrict } from "date-fns";

import type { ScanRun } from "@/lib/api";
import { getOutcomeCount } from "@/lib/scan-diagnostics";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

function prettyStatus(status: string | null) {
  if (!status) {
    return "Waiting for first scan";
  }
  return status.replaceAll("_", " ");
}

type ScanStatusCardProps = {
  pendingMode: "full" | "evaluation" | null;
  scanRun: ScanRun | null;
  isRunning: boolean;
};

function modeLabel(mode: string | null) {
  if (mode === "evaluation") {
    return "Bounded evaluation";
  }
  if (mode === "full") {
    return "Full library scan";
  }
  return "Latest scan";
}

export function ScanStatusCard({ pendingMode, scanRun, isRunning }: ScanStatusCardProps) {
  const effectiveMode = pendingMode ?? scanRun?.mode ?? null;
  const summary = isRunning
    ? pendingMode === "evaluation"
      ? "Running bounded photo evaluation"
      : "Scanning configured roots"
    : prettyStatus(scanRun?.status ?? null);
  const excludedPaths = getOutcomeCount(scanRun, "excluded_path_skips");
  const unsupportedFiles = getOutcomeCount(scanRun, "unsupported_files");
  const duplicateFiles = getOutcomeCount(scanRun, "duplicate_files");

  return (
    <Card className="h-full bg-gradient-to-br from-ink via-[#24303c] to-black text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">{modeLabel(effectiveMode)}</p>
          <CardTitle className="mt-2 text-lg text-white sm:text-xl">{summary}</CardTitle>
          <CardDescription className="mt-1 text-white/70">
            {scanRun?.started_at
              ? `Started ${formatDistanceToNowStrict(new Date(scanRun.started_at), { addSuffix: true })}`
              : isRunning
                ? "Preparing the next run."
                : "No scan has been executed yet."}
          </CardDescription>
        </div>
        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
          {isRunning ? pendingMode ?? "running" : scanRun?.status ?? "Idle"}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-white/50">Candidates</p>
          <p className="mt-1 text-lg font-semibold text-white">{scanRun?.candidate_images_evaluated ?? 0}</p>
        </div>
        <div>
          <p className="text-white/50">Accepted</p>
          <p className="mt-1 text-lg font-semibold text-white">{scanRun?.likely_photos_accepted ?? 0}</p>
        </div>
        <div>
          <p className="text-white/50">Graphics</p>
          <p className="mt-1 text-lg font-semibold text-white">{scanRun?.likely_graphics_rejected ?? 0}</p>
        </div>
        <div>
          <p className="text-white/50">Failed</p>
          <p className="mt-1 text-lg font-semibold text-white">{scanRun?.unreadable_failed_count ?? 0}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/72">
        <span className="rounded-full border border-white/12 bg-white/8 px-2.5 py-1">
          Excluded paths {excludedPaths}
        </span>
        <span className="rounded-full border border-white/12 bg-white/8 px-2.5 py-1">
          Unsupported {unsupportedFiles}
        </span>
        <span className="rounded-full border border-white/12 bg-white/8 px-2.5 py-1">
          Duplicates {duplicateFiles}
        </span>
      </div>
    </Card>
  );
}
