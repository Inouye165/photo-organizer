import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileWarning } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { AppShell } from "@/components/app-shell";
import { ScanErrorTable } from "@/components/scan-error-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getScanErrors } from "@/lib/api";

const pageSize = 50;

function buildScanErrorParams(page: number, pageSizeValue: number, scanRunId?: number) {
  return {
    page,
    page_size: pageSizeValue,
    ...(scanRunId != null ? { scan_run_id: scanRunId } : {}),
  };
}

export function RejectedFilesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get("page") ?? "1");
  const scanRunId = searchParams.get("scanRunId");

  const errorsQuery = useQuery({
    queryKey: ["scan-errors", { scanRunId, page: currentPage }],
    queryFn: () =>
      getScanErrors(buildScanErrorParams(currentPage, pageSize, scanRunId ? Number(scanRunId) : undefined)),
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
          <ScanErrorTable
            emptyMessage="All scanned files were successfully indexed or no scan has been run yet."
            emptyTitle="No rejected files"
            errorMessage={errorsQuery.error instanceof Error ? errorsQuery.error.message : null}
            errors={errorsQuery.data?.items ?? []}
            isError={errorsQuery.isError}
            isLoading={errorsQuery.isLoading}
            onRetry={() => void errorsQuery.refetch()}
          />
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
