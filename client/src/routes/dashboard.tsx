import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Images, ScanSearch } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { DateRangeFilter } from "@/components/date-range-filter";
import { GalleryGrid } from "@/components/gallery-grid";
import { MetricCard } from "@/components/metric-card";
import { PhotoDetailPanel } from "@/components/photo-detail-panel";
import { ScanStatusCard } from "@/components/scan-status-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLatestScanRun, getPhoto, getPhotos, startScanRun } from "@/lib/api";

const galleryPageSize = 24;

function normalizeSearchValue(value: string | null) {
  return value ?? "";
}

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const dateFrom = normalizeSearchValue(searchParams.get("dateFrom"));
  const dateTo = normalizeSearchValue(searchParams.get("dateTo"));
  const selectedPhotoId = searchParams.get("photoId");

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

  const statusHint = dateFrom || dateTo ? "Matching current date window" : "Currently indexed originals";

  return (
    <AppShell>
      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr_1fr]">
        <ScanStatusCard isRunning={scanMutation.isPending} scanRun={latestScan} />
        <MetricCard
          eyebrow="Library"
          hint="Real records from the API"
          testId="total-photos-card"
          title="Total photos"
          value={String(totalPhotos)}
        />
        <MetricCard
          eyebrow="Current view"
          hint={statusHint}
          testId="filtered-photos-card"
          title="Gallery results"
          value={String(filteredCount)}
        />
      </section>

      <Card className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-black/45">
            <ScanSearch size={16} />
            Scan roots
          </div>
          <p className="max-w-2xl text-sm leading-6 text-black/60">
            Trigger a synchronous scan across configured roots. Every tile on this page comes from
            the latest backend response and persisted records.
          </p>
          {scanErrorMessage ? (
            <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} />
              <span>{scanErrorMessage}</span>
            </div>
          ) : null}
        </div>
        <Button className="h-12 min-w-40" disabled={scanMutation.isPending} onClick={() => scanMutation.mutate()}>
          {scanMutation.isPending ? "Scanning..." : "Run scan"}
        </Button>
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

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/45">Gallery</p>
            <h2 className="mt-2 flex items-center gap-2 text-3xl font-semibold text-ink">
              <Images size={24} />
              Real indexed photos
            </h2>
          </div>
        </div>
        <GalleryGrid
          errorMessage={galleryErrorMessage}
          isError={galleryQuery.isError}
          isLoading={galleryQuery.isLoading}
          onRetry={() => void galleryQuery.refetch()}
          onSelectPhoto={(photoId) => {
            const next = new URLSearchParams(searchParams);
            next.set("photoId", String(photoId));
            setSearchParams(next);
          }}
          photos={galleryQuery.data?.items ?? []}
        />
      </section>

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
