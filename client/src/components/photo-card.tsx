import { format } from "date-fns";

import type { PhotoSummary } from "@/lib/api";
import { resolveApiAssetUrl } from "@/lib/api";

type PhotoCardProps = {
  photo: PhotoSummary;
  onSelect: (photoId: number) => void;
};

export function PhotoCard({ photo, onSelect }: PhotoCardProps) {
  const thumbnailUrl = resolveApiAssetUrl(photo.thumbnail_url);

  return (
    <button
      className="group flex overflow-hidden rounded-[28px] border border-black/10 bg-white/80 text-left shadow-panel transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/30"
      onClick={() => onSelect(photo.id)}
      type="button"
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-mist/60">
        {thumbnailUrl ? (
          <img
            alt={photo.file_name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            src={thumbnailUrl}
          />
        ) : null}
      </div>
      <div className="flex w-full flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-ink">{photo.file_name}</p>
          <span className="rounded-full bg-black/5 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-black/50">
            {photo.extension.replace(".", "")}
          </span>
        </div>
        <p className="text-sm text-black/55">
          {photo.captured_at ? format(new Date(photo.captured_at), "PPP") : "No date available"}
        </p>
      </div>
    </button>
  );
}
