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
      className="group relative aspect-[4/3] overflow-hidden rounded-[24px] border border-black/10 bg-white/80 text-left shadow-panel transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/30"
      onClick={() => onSelect(photo.id)}
      type="button"
    >
      <div className="h-full w-full overflow-hidden bg-mist/60">
        {thumbnailUrl ? (
          <img
            alt={photo.file_name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
            src={thumbnailUrl}
          />
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 via-black/45 to-transparent px-3 pb-3 pt-10 text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-white">{photo.file_name}</p>
          <span className="rounded-full bg-white/12 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-white/78 backdrop-blur-sm">
            {photo.extension.replace(".", "")}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/78">
          {photo.captured_at ? format(new Date(photo.captured_at), "PPP") : "No date available"}
        </p>
      </div>
    </button>
  );
}
