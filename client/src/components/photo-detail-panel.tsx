import { format } from "date-fns";
import { X } from "lucide-react";

import type { PhotoDetail } from "@/lib/api";
import { resolveApiAssetUrl } from "@/lib/api";

import { Button } from "@/components/ui/button";

type PhotoDetailPanelProps = {
  photo: PhotoDetail | null;
  isOpen: boolean;
  onClose: () => void;
};

function metadataValue(value: string | null) {
  return value && value.length > 0 ? value : "Unavailable";
}

function classificationReasons(photo: PhotoDetail) {
  const details = photo.classification_details;
  if (!details || !Array.isArray(details.reasons)) {
    return [];
  }
  return details.reasons.filter((value): value is string => typeof value === "string");
}

export function PhotoDetailPanel({ photo, isOpen, onClose }: PhotoDetailPanelProps) {
  if (!isOpen || !photo) {
    return null;
  }

  const displayUrl = resolveApiAssetUrl(photo.display_url ?? photo.thumbnail_url);
  const reasons = classificationReasons(photo);
  const score = typeof photo.classification_details?.score === "number"
    ? photo.classification_details.score
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/25 p-0 backdrop-blur-sm lg:items-stretch lg:justify-end">
      <button aria-label="Close detail panel" className="hidden flex-1 lg:block" onClick={onClose} type="button" />
      <aside className="max-h-[92vh] w-full overflow-auto rounded-t-[32px] bg-[#fffdf9] p-5 shadow-2xl lg:max-h-none lg:w-[440px] lg:rounded-none lg:rounded-l-[32px] lg:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-black/45">Photo detail</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{photo.file_name}</h2>
          </div>
          <Button aria-label="Close detail panel" onClick={onClose} type="button" variant="ghost">
            <X size={18} />
          </Button>
        </div>
        {displayUrl ? (
          <img alt={photo.file_name} className="mt-5 w-full rounded-[24px] border border-black/10 bg-mist/50 object-cover" src={displayUrl} />
        ) : null}
        <dl className="mt-6 grid gap-4 text-sm text-black/65">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">Captured</dt>
            <dd className="mt-1 text-base text-ink">
              {photo.captured_at ? format(new Date(photo.captured_at), "PPP p") : "Unavailable"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">Dimensions</dt>
            <dd className="mt-1 text-base text-ink">{photo.width} × {photo.height}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">Original path</dt>
            <dd className="mt-1 break-all text-base text-ink">{metadataValue(photo.original_path)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">Latest scan run</dt>
            <dd className="mt-1 text-base text-ink">{photo.latest_scan_run_id != null ? `Run #${photo.latest_scan_run_id}` : "Unavailable"}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">Classification</dt>
            <dd className="mt-1 text-base text-ink">
              {photo.classification_label.replaceAll("_", " ")}
              {score != null ? ` (${Math.round(score * 100)}% confidence)` : ""}
            </dd>
          </div>
          {reasons.length > 0 ? (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/40">Why it was accepted</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-black/5 px-3 py-1 text-sm text-black/65">
                    {reason}
                  </span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>
      </aside>
    </div>
  );
}
