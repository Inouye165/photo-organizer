import { formatDistanceToNowStrict } from "date-fns";

import type { ScanRun } from "@/lib/api";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";

function prettyStatus(status: string | null) {
  if (!status) {
    return "Waiting for first scan";
  }
  return status.replaceAll("_", " ");
}

type ScanStatusCardProps = {
  scanRun: ScanRun | null;
  isRunning: boolean;
};

export function ScanStatusCard({ scanRun, isRunning }: ScanStatusCardProps) {
  const summary = isRunning
    ? "Scanning configured roots"
    : prettyStatus(scanRun?.status ?? null);

  return (
    <Card className="h-full bg-gradient-to-br from-ink via-[#24303c] to-black text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">Latest scan</p>
          <CardTitle className="mt-2 text-lg text-white sm:text-xl">{summary}</CardTitle>
          <CardDescription className="mt-1 text-white/70">
            {scanRun?.started_at
              ? `Started ${formatDistanceToNowStrict(new Date(scanRun.started_at), { addSuffix: true })}`
              : "No scan has been executed yet."}
          </CardDescription>
        </div>
        <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">
          {isRunning ? "Running" : scanRun?.status ?? "Idle"}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <p className="text-white/50">Files seen</p>
          <p className="mt-1 text-lg font-semibold text-white">{scanRun?.files_seen ?? 0}</p>
        </div>
        <div>
          <p className="text-white/50">Indexed</p>
          <p className="mt-1 text-lg font-semibold text-white">{scanRun?.photos_indexed ?? 0}</p>
        </div>
        <div>
          <p className="text-white/50">Errors</p>
          <p className="mt-1 text-lg font-semibold text-white">{scanRun?.errors_count ?? 0}</p>
        </div>
      </div>
    </Card>
  );
}
