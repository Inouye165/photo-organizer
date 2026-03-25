import { AlertTriangle, FileWarning, ShieldX } from "lucide-react";

import type { ScanError } from "@/lib/api";

import { Button } from "@/components/ui/button";

type ScanErrorTableProps = {
  canLoadMore?: boolean;
  emptyMessage: string;
  emptyTitle: string;
  errorMessage: string | null;
  errors: ScanError[];
  isError: boolean;
  isLoading: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  onRetry: () => void;
};

function errorTypeLabel(errorType: string) {
  const labels: Record<string, string> = {
    corrupt: "Corrupt file",
    duplicate: "Duplicate content",
    file_io: "File access issue",
    invalid_metadata: "Invalid metadata",
    missing_root: "Missing folder",
    permission: "Permission denied",
    processing_error: "Processing failure",
    rejected: "Not a photo",
  };
  return labels[errorType] ?? errorType.replaceAll("_", " ");
}

function errorTypeIcon(errorType: string) {
  switch (errorType) {
    case "corrupt":
    case "processing_error":
      return <FileWarning size={16} className="text-red-500" />;
    case "rejected":
    case "permission":
      return <ShieldX size={16} className="text-amber-600" />;
    case "duplicate":
      return <AlertTriangle size={16} className="text-blue-500" />;
    default:
      return <AlertTriangle size={16} className="text-black/35" />;
  }
}

function metadataLabel(error: ScanError) {
  const stage = typeof error.diagnostic_metadata?.processing_stage === "string"
    ? error.diagnostic_metadata.processing_stage.replaceAll("_", " ")
    : null;
  const exceptionClass = typeof error.diagnostic_metadata?.exception_class === "string"
    ? error.diagnostic_metadata.exception_class
    : null;

  return [stage, exceptionClass].filter(Boolean).join(" • ");
}

export function ScanErrorTable({
  canLoadMore = false,
  emptyMessage,
  emptyTitle,
  errorMessage,
  errors,
  isError,
  isLoading,
  isLoadingMore = false,
  onLoadMore,
  onRetry,
}: ScanErrorTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-[20px] bg-black/5" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-semibold text-red-800">Failed to load scan errors.</p>
        <p className="mt-1 leading-6">{errorMessage ?? "The request did not complete."}</p>
        <div className="mt-3">
          <Button onClick={onRetry} type="button" variant="secondary">
            Retry request
          </Button>
        </div>
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-black/10 bg-white/55 p-6 text-center">
        <AlertTriangle size={28} className="text-black/20" />
        <p className="text-lg font-semibold text-ink">{emptyTitle}</p>
        <p className="max-w-xl text-sm leading-6 text-black/55">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[24px] border border-black/8 bg-white/68">
      <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(180px,1fr)_minmax(0,2fr)] gap-4 border-b border-black/8 bg-black/[0.03] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-black/45 lg:grid">
        <div>File</div>
        <div>Type</div>
        <div>Detail</div>
      </div>
      <div className="divide-y divide-black/6">
        {errors.map((error) => {
          const detailLabel = metadataLabel(error);

          return (
            <article key={error.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(180px,1fr)_minmax(0,2fr)] lg:items-start lg:gap-4">
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex-shrink-0">{errorTypeIcon(error.error_type)}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{error.file_name}</p>
                    <p className="mt-1 truncate text-xs text-black/38" title={error.file_path}>
                      {error.file_path}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/55">
                  {errorTypeLabel(error.error_type)}
                </span>
                {detailLabel ? (
                  <span className="text-xs text-black/42">{detailLabel}</span>
                ) : null}
              </div>
              <div>
                <p className="text-sm leading-6 text-black/62">{error.reason}</p>
              </div>
            </article>
          );
        })}
      </div>
      </div>
      {canLoadMore && onLoadMore ? (
        <div className="flex justify-center">
          <Button className="h-10 min-w-40" disabled={isLoadingMore} onClick={onLoadMore} type="button" variant="secondary">
            {isLoadingMore ? "Loading..." : "Load more files"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
