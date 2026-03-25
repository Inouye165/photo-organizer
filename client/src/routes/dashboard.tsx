import { useEffect, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarRange, FileWarning, Images, Layers3, ScanSearch } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { DateRangeFilter } from "@/components/date-range-filter";
import { GalleryGrid } from "@/components/gallery-grid";
import { MetricCard } from "@/components/metric-card";
import { ModalShell } from "@/components/modal-shell";
import { PhotoCollectionModal } from "@/components/photo-collection-modal";
import { PhotoDetailPanel } from "@/components/photo-detail-panel";
import { RecentScanRunsCard } from "@/components/recent-scan-runs-card";
import { ScanErrorTable } from "@/components/scan-error-table";
import { ScanStatusCard } from "@/components/scan-status-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getDiscoveryPlan, getLatestScanRun, getPhoto, getPhotos, getScanErrors, getScanRuns, resetScanState, startScanRun } from "@/lib/api";

const galleryPageSize = 24;
const overlayPageSize = 60;
const historyPageSizeStep = 6;

function normalizeSearchValue(value: string | null) {
  return value ?? "";
}

function buildPhotoListParams(
  pageSize: number,
  filters: {
    dateFrom?: string;
    dateTo?: string;
    scanRunId?: number;
  } = {},
) {
  return {
    page: 1,
    page_size: pageSize,
    ...(filters.dateFrom ? { date_from: filters.dateFrom } : {}),
    ...(filters.dateTo ? { date_to: filters.dateTo } : {}),
    ...(filters.scanRunId != null ? { scan_run_id: filters.scanRunId } : {}),
  };
}

function buildScanErrorParams(pageSize: number, scanRunId?: number) {
  return {
    page: 1,
    page_size: pageSize,
    ...(scanRunId != null ? { scan_run_id: scanRunId } : {}),
  };
}

type ScanFeedbackStage = "ready" | "running" | "complete";

const scanFeedbackSteps: Array<{
  stage: ScanFeedbackStage;
  label: string;
  description: string;
}> = [
  {
    stage: "ready",
    label: "Ready to scan",
    description: "Choose a scan and start when you are ready.",
  },
  {
    stage: "running",
    label: "Scanning...",
    description: "Live progress will land here once scan updates are available.",
  },
  {
    stage: "complete",
    label: "Complete",
    description: "Review the latest results or start another run.",
  },
];

function getScanFeedbackStage(isRunning: boolean, hasLatestScan: boolean): ScanFeedbackStage {
  if (isRunning) {
    return "running";
  }

  if (hasLatestScan) {
    return "complete";
  }

  return "ready";
}

function getScanFeedbackSummary(stage: ScanFeedbackStage) {
  if (stage === "running") {
    return "Scanning now";
  }

  if (stage === "complete") {
    return "Latest run finished";
  }

  return "Ready to scan";
}

function getScanFeedbackDescription(stage: ScanFeedbackStage) {
  if (stage === "running") {
    return "Keep this page open while the scanner works. Results and issues will appear below.";
  }

  if (stage === "complete") {
    return "Open the latest results, review issues, or start a new run.";
  }

  return "Start a scan when you want to refresh the library.";
}

function getScanFeedbackProgressWidth(stage: ScanFeedbackStage) {
  if (stage === "running") {
    return "58%";
  }

  if (stage === "complete") {
    return "100%";
  }

  return "12%";
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [isFreshRunConfirmOpen, setIsFreshRunConfirmOpen] = useState(false);
  const [resetSummaryMessage, setResetSummaryMessage] = useState<string | null>(null);
  const dateFrom = normalizeSearchValue(searchParams.get("dateFrom"));
  const dateTo = normalizeSearchValue(searchParams.get("dateTo"));
  const selectedPhotoId = searchParams.get("photoId");
  const panel = searchParams.get("panel");
  const selectedRunId = Number(searchParams.get("runId") ?? "0") || null;
  const isAllPhotosOpen = panel === "all";
  const isFilteredPhotosOpen = panel === "filtered";
  const isRunPhotosOpen = panel === "run-photos";
  const isRunErrorsOpen = panel === "run-errors";
  const [allPhotosPageSize, setAllPhotosPageSize] = useState(overlayPageSize);
  const [filteredPhotosPageSize, setFilteredPhotosPageSize] = useState(overlayPageSize);
  const [runPhotosPageSize, setRunPhotosPageSize] = useState(overlayPageSize);
  const [runErrorsPageSize, setRunErrorsPageSize] = useState(overlayPageSize);
  const [historyPageSize, setHistoryPageSize] = useState(historyPageSizeStep);

  const latestScanQuery = useQuery({
    queryKey: ["latest-scan"],
    queryFn: getLatestScanRun,
  });

  const discoveryPlanQuery = useQuery({
    queryKey: ["discovery-plan"],
    queryFn: getDiscoveryPlan,
  });

  const scanRunsQuery = useQuery({
    queryKey: ["scan-runs", historyPageSize],
    queryFn: () => getScanRuns({ page: 1, page_size: historyPageSize }),
  });

  const totalPhotosQuery = useQuery({
    queryKey: ["photos-total"],
    queryFn: () => getPhotos({ page: 1, page_size: 1 }),
  });

  const galleryQuery = useQuery({
    queryKey: ["photos", { dateFrom, dateTo }],
    queryFn: () =>
      getPhotos(buildPhotoListParams(galleryPageSize, { dateFrom, dateTo })),
  });

  const detailQuery = useQuery({
    queryKey: ["photo", selectedPhotoId],
    queryFn: () => getPhoto(Number(selectedPhotoId)),
    enabled: Boolean(selectedPhotoId),
  });

  const allPhotosModalQuery = useQuery({
    queryKey: ["photos-modal", "all", allPhotosPageSize],
    queryFn: () => getPhotos({ page: 1, page_size: allPhotosPageSize }),
    enabled: isAllPhotosOpen,
  });

  const filteredPhotosModalQuery = useQuery({
    queryKey: ["photos-modal", "filtered", { dateFrom, dateTo, filteredPhotosPageSize }],
    queryFn: () =>
      getPhotos(buildPhotoListParams(filteredPhotosPageSize, { dateFrom, dateTo })),
    enabled: isFilteredPhotosOpen,
  });

  const selectedRun = scanRunsQuery.data?.items.find((run) => run.id === selectedRunId)
    ?? (latestScanQuery.data?.scan_run?.id === selectedRunId ? latestScanQuery.data.scan_run : null);

  const selectedRunPhotosModalQuery = useQuery({
    queryKey: ["photos-modal", "run", selectedRunId, runPhotosPageSize],
    queryFn: () =>
      getPhotos(
        buildPhotoListParams(
          runPhotosPageSize,
          selectedRunId != null ? { scanRunId: selectedRunId } : {},
        ),
      ),
    enabled: isRunPhotosOpen && selectedRunId != null,
  });

  const scanErrorsQuery = useQuery({
    queryKey: ["scan-errors-modal", selectedRunId, runErrorsPageSize],
    queryFn: () =>
      getScanErrors(buildScanErrorParams(runErrorsPageSize, selectedRunId ?? undefined)),
    enabled: isRunErrorsOpen && selectedRunId != null,
  });

  const fullScanMutation = useMutation({
    mutationFn: () => startScanRun({ mode: "full" }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["latest-scan"] }),
        queryClient.invalidateQueries({ queryKey: ["scan-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["photos-total"] }),
        queryClient.invalidateQueries({ queryKey: ["photos"] }),
      ]);
    },
  });

  const clearIndexedDataMutation = useMutation({
    mutationFn: resetScanState,
    onSuccess: async (resetSummary) => {
      setResetSummaryMessage(
        `Indexed data cleared: removed ${resetSummary.photos_deleted} indexed photos, ${resetSummary.scan_runs_deleted} runs, and ${resetSummary.media_files_deleted} generated browser copies. Original files were not modified or deleted.`
      );
      setIsClearConfirmOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["latest-scan"] }),
        queryClient.invalidateQueries({ queryKey: ["scan-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["photos-total"] }),
        queryClient.invalidateQueries({ queryKey: ["photos"] }),
        queryClient.invalidateQueries({ queryKey: ["scan-errors-modal"] }),
      ]);
    },
  });

  const freshEvaluationMutation = useMutation({
    mutationFn: async () => {
      const resetSummary = await resetScanState();
      const scanRun = await startScanRun({ mode: "evaluation" });
      return { resetSummary, scanRun };
    },
    onSuccess: async ({ resetSummary }) => {
      setResetSummaryMessage(
        `Fresh evaluation cleared ${resetSummary.photos_deleted} indexed photos, ${resetSummary.scan_runs_deleted} prior runs, and ${resetSummary.media_files_deleted} generated browser copies before starting a new scan. Original source files were left untouched.`
      );
      setIsFreshRunConfirmOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["latest-scan"] }),
        queryClient.invalidateQueries({ queryKey: ["scan-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["photos-total"] }),
        queryClient.invalidateQueries({ queryKey: ["photos"] }),
        queryClient.invalidateQueries({ queryKey: ["scan-errors-modal"] }),
      ]);
    },
  });

  const filteredCount = galleryQuery.data?.total ?? 0;
  const totalPhotos = totalPhotosQuery.data?.total ?? 0;
  const latestScan = latestScanQuery.data?.scan_run ?? null;
  const discoveryPlan = discoveryPlanQuery.data?.plan ?? null;
  const recentRuns = scanRunsQuery.data?.items ?? [];
  const selectedRunLabel = selectedRunId != null ? `Run #${selectedRunId}` : "Scan run";
  const galleryErrorMessage = galleryQuery.error instanceof Error ? galleryQuery.error.message : null;
  const scanErrorMessage = fullScanMutation.error instanceof Error
    ? fullScanMutation.error.message
    : clearIndexedDataMutation.error instanceof Error
      ? clearIndexedDataMutation.error.message
    : freshEvaluationMutation.error instanceof Error
      ? freshEvaluationMutation.error.message
      : null;
  const scanErrorsMessage = scanErrorsQuery.error instanceof Error ? scanErrorsQuery.error.message : null;
  const isRunning = fullScanMutation.isPending || freshEvaluationMutation.isPending;
  const isMutating = isRunning || clearIndexedDataMutation.isPending;
  const pendingMode = freshEvaluationMutation.isPending
    ? "evaluation"
    : fullScanMutation.isPending
      ? "full"
      : null;

  const statusHint = dateFrom || dateTo ? "Matching current date window" : "Currently indexed originals";
  const latestRunPhotosHint = latestScan?.mode === "evaluation"
    ? "Inspect accepted likely photos from the bounded evaluation run."
    : "Inspect accepted photos from the latest full-library scan.";
  const latestRunIssuesHint = latestScan?.mode === "evaluation"
    ? "Review likely graphics, unreadable files, and other evaluation rejects."
    : "Review failed files and non-photo rejects from the latest full scan.";
  const scanFeedbackStage = getScanFeedbackStage(isRunning, latestScan != null);
  const scanFeedbackSummary = getScanFeedbackSummary(scanFeedbackStage);
  const scanFeedbackDescription = getScanFeedbackDescription(scanFeedbackStage);
  const scanFeedbackProgressWidth = getScanFeedbackProgressWidth(scanFeedbackStage);

  useEffect(() => {
    setRunPhotosPageSize(overlayPageSize);
    setRunErrorsPageSize(overlayPageSize);
  }, [selectedRunId]);

  function updatePanel(nextPanel: string | null, runId?: number | null) {
    const next = new URLSearchParams(searchParams);
    if (nextPanel) {
      next.set("panel", nextPanel);
    } else {
      next.delete("panel");
    }
    if (runId != null) {
      next.set("runId", String(runId));
    } else if (nextPanel !== "run-photos" && nextPanel !== "run-errors") {
      next.delete("runId");
    }
    setSearchParams(next);
  }

  function handleSelectPhoto(photoId: number) {
    const next = new URLSearchParams(searchParams);
    next.set("photoId", String(photoId));
    setSearchParams(next);
  }

  const selectedRunDescription = selectedRun?.started_at
    ? `${selectedRun.mode === "evaluation" ? "Likely photos accepted during evaluation run" : "Accepted photos indexed during full run"} #${selectedRun.id}, started ${new Date(selectedRun.started_at).toLocaleString()}.`
    : selectedRunId != null
      ? `Accepted likely photos from run #${selectedRunId}.`
      : "Accepted likely photos from the selected scan run.";

  const selectedRunErrorDescription = selectedRun != null
    ? `Persisted failures captured during run #${selectedRun.id}.`
    : selectedRunId != null
      ? `Persisted failures captured during run #${selectedRunId}.`
      : "Persisted failures captured during the selected scan run.";

  return (
    <AppShell>
      <section className="grid gap-3 lg:grid-cols-[1.45fr_0.8fr_0.8fr]" data-testid="status-row">
        <ScanStatusCard isRunning={isRunning} pendingMode={pendingMode} scanRun={latestScan} />
        <button className="text-left" onClick={() => updatePanel("all")} type="button">
          <MetricCard
            eyebrow="Library"
            hint="Open the accepted indexed library"
            testId="total-photos-card"
            title="Indexed library"
            value={String(totalPhotos)}
          />
        </button>
        <button className="text-left" onClick={() => updatePanel("filtered")} type="button">
          <MetricCard
            eyebrow="Current library view"
            hint={dateFrom || dateTo ? "Open date-filtered library results" : statusHint}
            testId="filtered-photos-card"
            title="Filtered library view"
            value={String(filteredCount)}
          />
        </button>
      </section>

      <Card className="grid gap-4 bg-white/72 lg:grid-cols-[1.25fr_0.95fr]" data-testid="controls-row">
        <div className="flex h-full flex-col gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-black/45">
              <ScanSearch size={16} />
              New Scan
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">New Scan</h2>
            <p className="max-w-2xl text-sm leading-6 text-black/60">
              Start a new run, watch the scanner state, then inspect accepted photos and issues from the latest results.
            </p>
          </div>
          <div className="rounded-[28px] border border-black/8 bg-[#f8f3e9]/88 p-4" data-testid="scan-feedback-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Scanner state</p>
                <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{scanFeedbackSummary}</p>
                <p className="mt-1 text-sm leading-6 text-black/60">{scanFeedbackDescription}</p>
              </div>
              <div className="rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-black/55">
                {scanFeedbackStage}
              </div>
            </div>
            <div className="mt-4 h-2 rounded-full bg-black/8">
              <div
                aria-hidden="true"
                className="h-full rounded-full bg-ink/80 transition-[width] duration-300"
                style={{ width: scanFeedbackProgressWidth }}
              />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {scanFeedbackSteps.map((step) => {
                const isActive = step.stage === scanFeedbackStage;
                return (
                  <div
                    key={step.stage}
                    className={isActive
                      ? "rounded-[22px] border border-black/12 bg-white px-4 py-3 shadow-sm"
                      : "rounded-[22px] border border-black/8 bg-white/55 px-4 py-3"
                    }
                  >
                    <p className="text-sm font-semibold text-ink">{step.label}</p>
                    <p className="mt-1 text-sm leading-6 text-black/58">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
          {scanErrorMessage ? (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} />
              <span>{scanErrorMessage}</span>
            </div>
          ) : null}
          {resetSummaryMessage ? (
            <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm leading-6 text-emerald-800">
              {resetSummaryMessage}
            </div>
          ) : null}
          <div className="mt-auto flex flex-wrap gap-2">
            <Button className="h-10 min-w-40" disabled={isMutating} onClick={() => fullScanMutation.mutate()}>
              {fullScanMutation.isPending ? "Scanning..." : "Run full library scan"}
            </Button>
            <Button className="h-10 min-w-40" disabled={isMutating} onClick={() => setIsClearConfirmOpen(true)} type="button" variant="secondary">
              {clearIndexedDataMutation.isPending ? "Clearing..." : "Clear indexed data"}
            </Button>
            <Button className="h-10 min-w-40" disabled={isMutating} onClick={() => setIsFreshRunConfirmOpen(true)} type="button" variant="secondary">
              {freshEvaluationMutation.isPending ? "Evaluating..." : "Start fresh evaluation"}
            </Button>
            <Button className="h-10" onClick={() => updatePanel("all")} type="button" variant="secondary">
              <Images size={15} />
              Inspect indexed library
            </Button>
            <Button className="h-10" onClick={() => updatePanel("filtered")} type="button" variant="secondary">
              <CalendarRange size={15} />
              Inspect current library view
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="text-left" disabled={!latestScan} onClick={() => updatePanel("run-photos", latestScan?.id)} type="button">
            <Card className="h-full bg-[#f7f2ea] transition hover:bg-[#f3ece2] disabled:cursor-not-allowed disabled:opacity-70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-black/42">
                <Layers3 size={15} />
                Latest results
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{latestScan?.likely_photos_accepted ?? 0}</p>
              <p className="mt-1 text-sm leading-6 text-black/58">{latestRunPhotosHint}</p>
            </Card>
          </button>
          <div className="space-y-2 rounded-[24px] border border-amber-200/70 bg-amber-50/80 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-800/75">
              <FileWarning size={15} />
              Latest run diagnostics
            </div>
            <p className="text-2xl font-semibold tracking-tight text-ink">{latestScan?.errors_count ?? 0}</p>
            <div className="flex flex-wrap gap-2">
              <Button className="h-9" disabled={!latestScan || latestScan.errors_count === 0} onClick={() => updatePanel("run-errors", latestScan?.id)} type="button" variant="secondary">
                Review failed files
              </Button>
              {latestScan ? (
                <Link to={`/rejected?scanRunId=${latestScan.id}`}>
                  <Button className="h-9" type="button" variant="ghost">
                    Deep link
                  </Button>
                </Link>
              ) : null}
            </div>
            <p className="text-sm leading-6 text-amber-900/65">{latestRunIssuesHint}</p>
          </div>
        </div>
      </Card>

      <Card className="grid gap-4 bg-[#f8f3e9]/82 lg:grid-cols-[1.15fr_0.85fr]" data-testid="discovery-plan-card">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Discovery strategy</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">Priority-first traversal with explainable exclusions.</h2>
            <p className="mt-1 text-sm leading-6 text-black/60">
              The scanner now prioritizes obvious photo folders before broader filesystem coverage. This summary shows the current traversal plan so you can verify what will be scanned first and which noisy path categories are skipped.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {discoveryPlan?.tiers.map((tier) => (
              <div key={tier.name} className="rounded-[24px] border border-black/8 bg-white/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">{tier.name}</p>
                <p className="mt-2 text-sm leading-6 text-black/65">{tier.description}</p>
                <div className="mt-3 space-y-1 text-sm text-ink">
                  {tier.paths.length > 0 ? tier.paths.slice(0, 4).map((tierPath) => (
                    <p key={tierPath} className="break-all">{tierPath}</p>
                  )) : <p className="text-black/45">No existing paths discovered for this tier.</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-[24px] border border-black/8 bg-white/75 p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Current scope</p>
            <p className="mt-2 text-sm leading-6 text-black/65">
              {discoveryPlan == null
                ? "Loading discovery plan..."
                : discoveryPlan.mode === "configured"
                  ? "Using explicitly configured scan roots."
                  : "Using broad machine discovery across accessible roots."}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Ordered roots</p>
            <div className="mt-2 space-y-1 text-sm text-ink">
              {discoveryPlan?.ordered_roots.slice(0, 6).map((root) => (
                <p key={root} className="break-all">{root}</p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Excluded categories</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {discoveryPlan?.excluded_path_categories.map((category) => (
                <span key={category} className="rounded-full bg-black/5 px-3 py-1 text-sm text-black/65">
                  {category}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <DateRangeFilter
        initialDateFrom={dateFrom}
        initialDateTo={dateTo}
        onApply={({ dateFrom: nextDateFrom, dateTo: nextDateTo }) => {
          const next = new URLSearchParams(searchParams);
          if (nextDateFrom) {
            next.set("dateFrom", nextDateFrom);
          } else {
            next.delete("dateFrom");
          }
          if (nextDateTo) {
            next.set("dateTo", nextDateTo);
          } else {
            next.delete("dateTo");
          }
          next.delete("photoId");
          setSearchParams(next);
        }}
        onClear={() => {
          const next = new URLSearchParams(searchParams);
          next.delete("dateFrom");
          next.delete("dateTo");
          next.delete("photoId");
          setSearchParams(next);
        }}
      />

      <div className="grid flex-1 gap-3 lg:min-h-0 lg:grid-cols-[1.35fr_0.95fr]">
        <Card className="flex flex-col overflow-hidden bg-[#fffdf9]/92 lg:min-h-0">
          <div className="flex items-center justify-between gap-4 border-b border-black/8 pb-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Gallery</p>
              <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-ink">
                <Images size={18} />
                Indexed library
              </h2>
              <p className="mt-1 text-sm leading-6 text-black/56">
                {dateFrom || dateTo
                  ? "A focused view of accepted library photos that match the active date window. Originals stay on disk; the browser sees generated display copies."
                  : "The accepted-photo library, separate from latest evaluation counters and run diagnostics. Searchable metadata comes from DB-backed indexing, not embedded browser copies."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="rounded-full bg-black/5 px-3 py-1 text-sm text-black/55">{filteredCount} visible</p>
              <Button className="h-9" onClick={() => updatePanel(dateFrom || dateTo ? "filtered" : "all")} type="button" variant="secondary">
                Open focused view
              </Button>
            </div>
          </div>
          <div className="mt-3 flex-1 overflow-y-auto pr-1" data-testid="gallery-scroll-region">
            <GalleryGrid
              errorMessage={galleryErrorMessage}
              isError={galleryQuery.isError}
              isLoading={galleryQuery.isLoading}
              onRetry={() => void galleryQuery.refetch()}
              onSelectPhoto={handleSelectPhoto}
              photos={galleryQuery.data?.items ?? []}
            />
          </div>
        </Card>

        <RecentScanRunsCard
          canLoadMore={(scanRunsQuery.data?.total ?? 0) > recentRuns.length}
          isLoading={scanRunsQuery.isLoading}
          onLoadMore={() => setHistoryPageSize((current) => current + historyPageSizeStep)}
          onOpenErrors={(scanRunId) => updatePanel("run-errors", scanRunId)}
          onOpenPhotos={(scanRunId) => updatePanel("run-photos", scanRunId)}
          runs={recentRuns}
        />
      </div>

      <PhotoCollectionModal
        canLoadMore={(allPhotosModalQuery.data?.total ?? 0) > (allPhotosModalQuery.data?.items.length ?? 0)}
        count={allPhotosModalQuery.data?.total ?? totalPhotos}
        description="Every accepted likely-photo currently stored in the library."
        emptyMessage="Run a scan to populate the library with indexed originals."
        emptyTitle="No indexed photos yet"
        errorMessage={allPhotosModalQuery.error instanceof Error ? allPhotosModalQuery.error.message : null}
        eyebrow="Library"
        isError={allPhotosModalQuery.isError}
        isLoading={allPhotosModalQuery.isLoading}
        isLoadingMore={allPhotosModalQuery.isFetching && !allPhotosModalQuery.isLoading}
        isOpen={isAllPhotosOpen}
        onClose={() => updatePanel(null)}
        onLoadMore={() => setAllPhotosPageSize((current) => current + overlayPageSize)}
        onRetry={() => void allPhotosModalQuery.refetch()}
        onSelectPhoto={handleSelectPhoto}
        photos={allPhotosModalQuery.data?.items ?? []}
        title="Indexed library"
      />

      <PhotoCollectionModal
        canLoadMore={(filteredPhotosModalQuery.data?.total ?? 0) > (filteredPhotosModalQuery.data?.items.length ?? 0)}
        count={filteredPhotosModalQuery.data?.total ?? filteredCount}
        description={dateFrom || dateTo ? `Photos filtered by the active date range${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}.` : "Photos in the current gallery view."}
        emptyMessage="Adjust the date window or run a scan to bring matching photos into view."
        emptyTitle="No photos match this date filter"
        errorMessage={filteredPhotosModalQuery.error instanceof Error ? filteredPhotosModalQuery.error.message : null}
        eyebrow="Date filter"
        isError={filteredPhotosModalQuery.isError}
        isLoading={filteredPhotosModalQuery.isLoading}
        isLoadingMore={filteredPhotosModalQuery.isFetching && !filteredPhotosModalQuery.isLoading}
        isOpen={isFilteredPhotosOpen}
        onClose={() => updatePanel(null)}
        onLoadMore={() => setFilteredPhotosPageSize((current) => current + overlayPageSize)}
        onRetry={() => void filteredPhotosModalQuery.refetch()}
        onSelectPhoto={handleSelectPhoto}
        photos={filteredPhotosModalQuery.data?.items ?? []}
        title="Filtered library photos"
      />

      <PhotoCollectionModal
        canLoadMore={(selectedRunPhotosModalQuery.data?.total ?? 0) > (selectedRunPhotosModalQuery.data?.items.length ?? 0)}
        count={selectedRunPhotosModalQuery.data?.total ?? selectedRun?.likely_photos_accepted ?? 0}
        description={selectedRunDescription}
        emptyMessage="The selected scan run did not accept any likely photos."
        emptyTitle="No photos in this run"
        errorMessage={selectedRunPhotosModalQuery.error instanceof Error ? selectedRunPhotosModalQuery.error.message : null}
        eyebrow={selectedRunLabel}
        isError={selectedRunPhotosModalQuery.isError}
        isLoading={selectedRunPhotosModalQuery.isLoading}
        isLoadingMore={selectedRunPhotosModalQuery.isFetching && !selectedRunPhotosModalQuery.isLoading}
        isOpen={isRunPhotosOpen}
        onClose={() => updatePanel(null)}
        onLoadMore={() => setRunPhotosPageSize((current) => current + overlayPageSize)}
        onRetry={() => void selectedRunPhotosModalQuery.refetch()}
        onSelectPhoto={handleSelectPhoto}
        photos={selectedRunPhotosModalQuery.data?.items ?? []}
        title={selectedRunId != null ? `Run #${selectedRunId} accepted likely photos` : "Run accepted likely photos"}
      />

      <ModalShell
        countLabel={`${scanErrorsQuery.data?.total ?? selectedRun?.errors_count ?? 0} issue${(scanErrorsQuery.data?.total ?? selectedRun?.errors_count ?? 0) === 1 ? "" : "s"}`}
        description={selectedRunErrorDescription}
        eyebrow={selectedRunId != null ? `Run #${selectedRunId} issues` : "Scan run issues"}
        isOpen={isRunErrorsOpen}
        onClose={() => updatePanel(null)}
        title={selectedRunId != null ? `Run #${selectedRunId} failed and rejected files` : "Failed and rejected files"}
      >
        <ScanErrorTable
          canLoadMore={(scanErrorsQuery.data?.total ?? 0) > (scanErrorsQuery.data?.items.length ?? 0)}
          emptyMessage="The selected scan run completed without persisted file failures."
          emptyTitle="No failed files"
          errorMessage={scanErrorsMessage}
          errors={scanErrorsQuery.data?.items ?? []}
          isError={scanErrorsQuery.isError}
          isLoading={scanErrorsQuery.isLoading}
          isLoadingMore={scanErrorsQuery.isFetching && !scanErrorsQuery.isLoading}
          onLoadMore={() => setRunErrorsPageSize((current) => current + overlayPageSize)}
          onRetry={() => void scanErrorsQuery.refetch()}
        />
      </ModalShell>

      <ModalShell
        description="This clears indexed scan data and generated previews. Original source files stay untouched."
        eyebrow="Clear indexed data"
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        title="Clear indexed data and generated copies"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-black/8 bg-white/72 p-4 text-sm leading-6 text-black/65">
            Scan history, indexed records, and generated previews will be removed. Originals are never modified or deleted.
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsClearConfirmOpen(false)} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={clearIndexedDataMutation.isPending} onClick={() => clearIndexedDataMutation.mutate()} type="button">
              {clearIndexedDataMutation.isPending ? "Clearing indexed data..." : "Clear indexed data"}
            </Button>
          </div>
        </div>
      </ModalShell>

      <ModalShell
        description="This resets indexed scan state, then starts a clean evaluation run. Your original files stay untouched."
        eyebrow="Fresh evaluation"
        isOpen={isFreshRunConfirmOpen}
        onClose={() => setIsFreshRunConfirmOpen(false)}
        title="Start a genuinely fresh evaluation run"
      >
        <div className="space-y-4">
          <div className="rounded-[24px] border border-black/8 bg-white/72 p-4 text-sm leading-6 text-black/65">
            Use this when you want a clean pass without carrying forward previous indexed results.
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setIsFreshRunConfirmOpen(false)} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={freshEvaluationMutation.isPending} onClick={() => freshEvaluationMutation.mutate()} type="button">
              {freshEvaluationMutation.isPending ? "Resetting and evaluating..." : "Clear state and start evaluation"}
            </Button>
          </div>
        </div>
      </ModalShell>

      <PhotoDetailPanel
        isOpen={Boolean(selectedPhotoId)}
        onClose={() => {
          const next = new URLSearchParams(searchParams);
          next.delete("photoId");
          setSearchParams(next);
        }}
        photo={detailQuery.data ?? null}
      />
    </AppShell>
  );
}
