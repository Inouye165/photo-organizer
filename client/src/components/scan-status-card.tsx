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
    <Card className="bg-gradient-to-br from-ink to-black text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">Latest scan</p>
          <CardTitle className="mt-3 text-2xl text-white">{summary}</CardTitle>
          <CardDescription className="mt-2 text-white/70">
            {scanRun?.started_at
              ? `Started ${formatDistanceToNowStrict(new Date(scanRun.started_at), { addSuffix: true })}`
              : "No scan has been executed yet."}
          </CardDescription>
        </div>
        <div className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
          {isRunning ? "Running" : scanRun?.status ?? "Idle"}
        </div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-white/50">Files seen</p>
          <p className="mt-1 text-xl font-semibold text-white">{scanRun?.files_seen ?? 0}</p>
        </div>
        <div>
          <p className="text-white/50">Indexed</p>
          <p className="mt-1 text-xl font-semibold text-white">{scanRun?.photos_indexed ?? 0}</p>
        </div>
        <div>
          <p className="text-white/50">Errors</p>
          <p className="mt-1 text-xl font-semibold text-white">{scanRun?.errors_count ?? 0}</p>
        </div>
      </div>
    </Card>
  );
}
