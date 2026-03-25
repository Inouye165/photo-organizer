import { format, formatDistanceToNowStrict } from "date-fns";
import { FileWarning, Images, Layers3 } from "lucide-react";

import type { ScanRun } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RecentScanRunsCardProps = {
  canLoadMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  onOpenErrors: (scanRunId: number) => void;
  onOpenPhotos: (scanRunId: number) => void;
  runs: ScanRun[];
};

function formatRunStatus(status: string) {
  return status.replaceAll("_", " ");
}

function formatRunMode(mode: string) {
  return mode === "evaluation" ? "evaluation" : "full scan";
}

function runStatusTone(status: string) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-700";
  }
  if (status === "completed_with_errors") {
    return "bg-amber-50 text-amber-700";
  }
  if (status === "failed") {
    return "bg-red-50 text-red-700";
  }
  return "bg-black/5 text-black/55";
}

function timeLabel(value: string | null) {
  if (!value) {
    return "Still running";
  }
  return format(new Date(value), "PPp");
}

export function RecentScanRunsCard({
  canLoadMore,
  isLoading,
  onLoadMore,
  onOpenErrors,
  onOpenPhotos,
  runs,
}: RecentScanRunsCardProps) {
  return (
    <Card className="flex min-h-0 flex-col overflow-hidden bg-[#fffdf9]/92">
      <div className="flex items-center justify-between gap-4 border-b border-black/8 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Recent scans</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-ink">
            <Layers3 size={18} />
            Scan history
          </h2>
          <p className="mt-1 text-sm leading-6 text-black/56">Review recent runs and open successful photos or persisted failures for any batch.</p>
        </div>
      </div>

      <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-[20px] bg-black/5" />
            ))}
          </div>
        ) : runs.length === 0 ? (
          <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-black/10 bg-white/55 p-6 text-center">
            <Layers3 size={28} className="text-black/20" />
            <p className="text-lg font-semibold text-ink">No scan history yet</p>
            <p className="max-w-xl text-sm leading-6 text-black/55">Run a scan to populate the recent history list with real batch results.</p>
          </div>
        ) : (
          runs.map((run) => (
            <article key={run.id} className="rounded-[24px] border border-black/8 bg-white/72 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-ink">Run #{run.id}</p>
                    <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/55">
                      {formatRunMode(run.mode)}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${runStatusTone(run.status)}`}>
                      {formatRunStatus(run.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-black/42">
                    Started {formatDistanceToNowStrict(new Date(run.started_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="text-right text-xs text-black/42">
                  <p>{timeLabel(run.started_at)}</p>
                  <p className="mt-1">Finished {timeLabel(run.finished_at)}</p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-black/42">Candidates</p>
                  <p className="mt-1 font-semibold text-ink">{run.candidate_images_evaluated}</p>
                </div>
                <div>
                  <p className="text-black/42">Accepted</p>
                  <p className="mt-1 font-semibold text-ink">{run.likely_photos_accepted}</p>
                </div>
                <div>
                  <p className="text-black/42">Graphics</p>
                  <p className="mt-1 font-semibold text-ink">{run.likely_graphics_rejected}</p>
                </div>
                <div>
                  <p className="text-black/42">Failed</p>
                  <p className="mt-1 font-semibold text-ink">{run.unreadable_failed_count}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button className="h-9" onClick={() => onOpenPhotos(run.id)} type="button" variant="secondary">
                  <Images size={15} />
                  Photos
                </Button>
                <Button className="h-9" disabled={run.errors_count === 0} onClick={() => onOpenErrors(run.id)} type="button" variant="secondary">
                  <FileWarning size={15} />
                  Errors
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      {canLoadMore ? (
        <div className="mt-3 border-t border-black/8 pt-3">
          <Button className="h-9 w-full" onClick={onLoadMore} type="button" variant="ghost">
            Load more runs
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
