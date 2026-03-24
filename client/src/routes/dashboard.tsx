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
import { ScanErrorTable } from "@/components/scan-error-table";
import { ScanStatusCard } from "@/components/scan-status-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLatestScanRun, getPhoto, getPhotos, getScanErrors, startScanRun } from "@/lib/api";

const galleryPageSize = 24;
const overlayPageSize = 60;

function normalizeSearchValue(value: string | null) {
  return value ?? "";
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const dateFrom = normalizeSearchValue(searchParams.get("dateFrom"));
  const dateTo = normalizeSearchValue(searchParams.get("dateTo"));
  const selectedPhotoId = searchParams.get("photoId");
  const panel = searchParams.get("panel");
  const isAllPhotosOpen = panel === "all";
  const isFilteredPhotosOpen = panel === "filtered";
  const isLatestRunOpen = panel === "latest-run";
  const isErrorsOpen = panel === "errors";

  const latestScanQuery = useQuery({
    queryKey: ["latest-scan"],
    queryFn: getLatestScanRun,
  });

  const totalPhotosQuery = useQuery({
    queryKey: ["photos-total"],
    queryFn: () => getPhotos({ page: 1, page_size: 1 }),
  });

  const galleryQuery = useQuery({
    queryKey: ["photos", { dateFrom, dateTo }],
    queryFn: () =>
      getPhotos({
        page: 1,
        page_size: galleryPageSize,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["photo", selectedPhotoId],
    queryFn: () => getPhoto(Number(selectedPhotoId)),
    enabled: Boolean(selectedPhotoId),
  });

  const allPhotosModalQuery = useQuery({
    queryKey: ["photos-modal", "all"],
    queryFn: () => getPhotos({ page: 1, page_size: overlayPageSize }),
    enabled: isAllPhotosOpen,
  });

  const filteredPhotosModalQuery = useQuery({
    queryKey: ["photos-modal", "filtered", { dateFrom, dateTo }],
    queryFn: () =>
      getPhotos({
        page: 1,
        page_size: overlayPageSize,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    enabled: isFilteredPhotosOpen,
  });

  const latestRunPhotosModalQuery = useQuery({
    queryKey: ["photos-modal", "latest-run", latestScanQuery.data?.scan_run?.id],
    queryFn: () =>
      getPhotos({
        page: 1,
        page_size: overlayPageSize,
        scan_run_id: latestScanQuery.data?.scan_run?.id,
      }),
    enabled: isLatestRunOpen && latestScanQuery.data?.scan_run?.id != null,
  });

  const scanErrorsQuery = useQuery({
    queryKey: ["scan-errors-modal", latestScanQuery.data?.scan_run?.id],
    queryFn: () =>
      getScanErrors({
        scan_run_id: latestScanQuery.data?.scan_run?.id,
        page: 1,
        page_size: overlayPageSize,
      }),
    enabled: isErrorsOpen && latestScanQuery.data?.scan_run?.id != null,
  });

  const scanMutation = useMutation({
    mutationFn: startScanRun,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["latest-scan"] }),
        queryClient.invalidateQueries({ queryKey: ["photos-total"] }),
        queryClient.invalidateQueries({ queryKey: ["photos"] }),
      ]);
    },
  });

  const filteredCount = galleryQuery.data?.total ?? 0;
  const totalPhotos = totalPhotosQuery.data?.total ?? 0;
  const latestScan = latestScanQuery.data?.scan_run ?? null;
  const galleryErrorMessage = galleryQuery.error instanceof Error ? galleryQuery.error.message : null;
  const scanErrorMessage = scanMutation.error instanceof Error ? scanMutation.error.message : null;
  const scanErrorsMessage = scanErrorsQuery.error instanceof Error ? scanErrorsQuery.error.message : null;

  const statusHint = dateFrom || dateTo ? "Matching current date window" : "Currently indexed originals";

  function updatePanel(nextPanel: string | null) {
    const next = new URLSearchParams(searchParams);
    if (nextPanel) {
      next.set("panel", nextPanel);
    } else {
      next.delete("panel");
    }
    setSearchParams(next);
  }

  function handleSelectPhoto(photoId: number) {
    const next = new URLSearchParams(searchParams);
    next.set("photoId", String(photoId));
    setSearchParams(next);
  }

  const latestRunDescription = latestScan?.started_at
    ? `Photos successfully indexed by the latest scan that started at ${new Date(latestScan.started_at).toLocaleString()}.`
    : "Successful photos from the latest scan run.";

  return (
    <AppShell>
      <section className="grid gap-3 lg:grid-cols-[1.45fr_0.8fr_0.8fr]" data-testid="status-row">
        <ScanStatusCard isRunning={scanMutation.isPending} scanRun={latestScan} />
        <button className="text-left" onClick={() => updatePanel("all")} type="button">
          <MetricCard
            eyebrow="Library"
            hint="Open all indexed photos"
            testId="total-photos-card"
            title="All indexed photos"
            value={String(totalPhotos)}
          />
        </button>
        <button className="text-left" onClick={() => updatePanel("filtered")} type="button">
          <MetricCard
            eyebrow="Current view"
            hint={dateFrom || dateTo ? "Open date-filtered photos" : statusHint}
            testId="filtered-photos-card"
            title="Date-filtered photos"
            value={String(filteredCount)}
          />
        </button>
      </section>

      <Card className="grid gap-4 bg-white/72 lg:grid-cols-[1.25fr_0.95fr]" data-testid="controls-row">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-black/45">
              <ScanSearch size={16} />
              Scan library
            </div>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">Keep the gallery current without leaving the page.</h2>
            <p className="max-w-2xl text-sm leading-6 text-black/60">
              Scan configured folders, review the latest indexed photos, and inspect failures with real data from the current backend and database.
            </p>
          </div>
          {scanErrorMessage ? (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} />
              <span>{scanErrorMessage}</span>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button className="h-10 min-w-36" disabled={scanMutation.isPending} onClick={() => scanMutation.mutate()}>
              {scanMutation.isPending ? "Scanning..." : "Run scan"}
            </Button>
            <Button className="h-10" onClick={() => updatePanel("all")} type="button" variant="secondary">
              <Images size={15} />
              Inspect all indexed photos
            </Button>
            <Button className="h-10" onClick={() => updatePanel("filtered")} type="button" variant="secondary">
              <CalendarRange size={15} />
              Inspect current date view
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="text-left" disabled={!latestScan} onClick={() => updatePanel("latest-run")} type="button">
            <Card className="h-full bg-[#f7f2ea] transition hover:bg-[#f3ece2] disabled:cursor-not-allowed disabled:opacity-70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-black/42">
                <Layers3 size={15} />
                Latest run
              </div>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-ink">{latestScan?.photos_indexed ?? 0}</p>
              <p className="mt-1 text-sm leading-6 text-black/58">Inspect successful photos from the latest batch.</p>
            </Card>
          </button>
          <div className="space-y-2 rounded-[24px] border border-amber-200/70 bg-amber-50/80 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-amber-800/75">
              <FileWarning size={15} />
              Latest scan issues
            </div>
            <p className="text-2xl font-semibold tracking-tight text-ink">{latestScan?.errors_count ?? 0}</p>
            <div className="flex flex-wrap gap-2">
              <Button className="h-9" disabled={!latestScan || latestScan.errors_count === 0} onClick={() => updatePanel("errors")} type="button" variant="secondary">
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
            <p className="text-sm leading-6 text-amber-900/65">Clear per-file diagnostics stay accessible without leaving the dashboard.</p>
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

      <Card className="flex flex-1 flex-col overflow-hidden bg-[#fffdf9]/92 lg:min-h-0">
        <div className="flex items-center justify-between gap-4 border-b border-black/8 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Gallery</p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-ink">
              <Images size={18} />
              Indexed photos
            </h2>
            <p className="mt-1 text-sm leading-6 text-black/56">
              {dateFrom || dateTo
                ? "A focused view of photos that match the active date window."
                : "The main library surface for recently indexed originals."}
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

      <PhotoCollectionModal
        count={allPhotosModalQuery.data?.total ?? totalPhotos}
        description="Every successfully indexed photo currently stored in the library."
        emptyMessage="Run a scan to populate the library with indexed originals."
        emptyTitle="No indexed photos yet"
        errorMessage={allPhotosModalQuery.error instanceof Error ? allPhotosModalQuery.error.message : null}
        eyebrow="Library"
        isError={allPhotosModalQuery.isError}
        isLoading={allPhotosModalQuery.isLoading}
        isOpen={isAllPhotosOpen}
        onClose={() => updatePanel(null)}
        onRetry={() => void allPhotosModalQuery.refetch()}
        onSelectPhoto={handleSelectPhoto}
        photos={allPhotosModalQuery.data?.items ?? []}
        title="All indexed photos"
      />

      <PhotoCollectionModal
        count={filteredPhotosModalQuery.data?.total ?? filteredCount}
        description={dateFrom || dateTo ? `Photos filtered by the active date range${dateFrom ? ` from ${dateFrom}` : ""}${dateTo ? ` to ${dateTo}` : ""}.` : "Photos in the current gallery view."}
        emptyMessage="Adjust the date window or run a scan to bring matching photos into view."
        emptyTitle="No photos match this date filter"
        errorMessage={filteredPhotosModalQuery.error instanceof Error ? filteredPhotosModalQuery.error.message : null}
        eyebrow="Date filter"
        isError={filteredPhotosModalQuery.isError}
        isLoading={filteredPhotosModalQuery.isLoading}
        isOpen={isFilteredPhotosOpen}
        onClose={() => updatePanel(null)}
        onRetry={() => void filteredPhotosModalQuery.refetch()}
        onSelectPhoto={handleSelectPhoto}
        photos={filteredPhotosModalQuery.data?.items ?? []}
        title="Date-filtered photos"
      />

      <PhotoCollectionModal
        count={latestRunPhotosModalQuery.data?.total ?? latestScan?.photos_indexed ?? 0}
        description={latestRunDescription}
        emptyMessage="The latest scan did not index any successful photos."
        emptyTitle="No photos in the latest run"
        errorMessage={latestRunPhotosModalQuery.error instanceof Error ? latestRunPhotosModalQuery.error.message : null}
        eyebrow="Latest scan run"
        isError={latestRunPhotosModalQuery.isError}
        isLoading={latestRunPhotosModalQuery.isLoading}
        isOpen={isLatestRunOpen}
        onClose={() => updatePanel(null)}
        onRetry={() => void latestRunPhotosModalQuery.refetch()}
        onSelectPhoto={handleSelectPhoto}
        photos={latestRunPhotosModalQuery.data?.items ?? []}
        title="Latest run successful photos"
      />

      <ModalShell
        countLabel={`${scanErrorsQuery.data?.total ?? latestScan?.errors_count ?? 0} issue${(scanErrorsQuery.data?.total ?? latestScan?.errors_count ?? 0) === 1 ? "" : "s"}`}
        description="Failed or rejected files captured during the latest scan, with stored diagnostic detail for follow-up."
        eyebrow="Latest scan issues"
        isOpen={isErrorsOpen}
        onClose={() => updatePanel(null)}
        title="Failed and rejected files"
      >
        <ScanErrorTable
          emptyMessage="The latest scan completed without persisted file failures."
          emptyTitle="No failed files"
          errorMessage={scanErrorsMessage}
          errors={scanErrorsQuery.data?.items ?? []}
          isError={scanErrorsQuery.isError}
          isLoading={scanErrorsQuery.isLoading}
          onRetry={() => void scanErrorsQuery.refetch()}
        />
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
