import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, FileWarning, ShieldX } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getScanErrors } from "@/lib/api";

const pageSize = 50;

function errorTypeLabel(errorType: string) {
  const labels: Record<string, string> = {
    corrupt: "Corrupt file",
    rejected: "Not a photo",
    permission: "Permission denied",
    duplicate: "Duplicate content",
    missing_root: "Missing folder",
  };
  return labels[errorType] ?? errorType;
}

function errorTypeIcon(errorType: string) {
  switch (errorType) {
    case "corrupt":
      return <FileWarning size={16} className="text-red-500" />;
    case "rejected":
      return <ShieldX size={16} className="text-amber-500" />;
    case "permission":
      return <ShieldX size={16} className="text-red-500" />;
    case "duplicate":
      return <AlertTriangle size={16} className="text-blue-500" />;
    default:
      return <AlertTriangle size={16} className="text-gray-500" />;
  }
}

export function RejectedFilesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page") ?? "1");
  const scanRunId = searchParams.get("scanRunId");

  const errorsQuery = useQuery({
    queryKey: ["scan-errors", { scanRunId, page: currentPage }],
    queryFn: () =>
      getScanErrors({
        scan_run_id: scanRunId ? Number(scanRunId) : undefined,
        page: currentPage,
        page_size: pageSize,
      }),
  });

  const totalPages = Math.max(
    1,
    Math.ceil((errorsQuery.data?.total ?? 0) / pageSize),
  );

  function goToPage(page: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  return (
    <AppShell>
      <div className="flex items-center gap-3">
        <Link to="/">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft size={16} />
            Back to gallery
          </Button>
        </Link>
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden bg-[#fffdf9]/88">
        <div className="flex items-center justify-between gap-4 border-b border-black/8 pb-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">
              Scan issues
            </p>
            <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-ink">
              <FileWarning size={18} />
              Rejected &amp; failed files
            </h2>
          </div>
          <p className="rounded-full bg-black/5 px-3 py-1 text-sm text-black/55">
            {errorsQuery.data?.total ?? 0} total
          </p>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto">
          {errorsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-2xl bg-black/5"
                />
              ))}
            </div>
          ) : errorsQuery.isError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load scan errors.{" "}
              <button
                className="underline"
                onClick={() => void errorsQuery.refetch()}
                type="button"
              >
                Retry
              </button>
            </div>
          ) : errorsQuery.data && errorsQuery.data.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <AlertTriangle size={32} className="text-black/20" />
              <p className="text-lg font-semibold text-ink">No rejected files</p>
              <p className="text-sm text-black/55">
                All scanned files were successfully indexed or no scan has been
                run yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-black/6">
              {errorsQuery.data?.items.map((error) => (
                <div
                  key={error.id}
                  className="flex items-start gap-3 py-3 first:pt-0"
                >
                  <div className="mt-0.5 flex-shrink-0">
                    {errorTypeIcon(error.error_type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-ink">
                        {error.file_name}
                      </p>
                      <span className="flex-shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-black/50">
                        {errorTypeLabel(error.error_type)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-black/55">
                      {error.reason}
                    </p>
                    <p
                      className="mt-0.5 truncate text-xs text-black/35"
                      title={error.file_path}
                    >
                      {error.file_path}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-2 border-t border-black/8 pt-3">
            <Button
              disabled={currentPage <= 1}
              onClick={() => goToPage(currentPage - 1)}
              variant="ghost"
            >
              Previous
            </Button>
            <span className="text-sm text-black/55">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              disabled={currentPage >= totalPages}
              onClick={() => goToPage(currentPage + 1)}
              variant="ghost"
            >
              Next
            </Button>
          </div>
        ) : null}
      </Card>
    </AppShell>
  );
}
