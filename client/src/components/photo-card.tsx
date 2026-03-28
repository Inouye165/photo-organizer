import { memo, useCallback } from "react";
import { format } from "date-fns";

import type { PhotoSummary } from "@/lib/api";
import { resolveApiAssetUrl } from "@/lib/api";

type PhotoCardProps = {
  imageFetchPriority?: "auto" | "high" | "low";
  imageLoading?: "eager" | "lazy";
  photo: PhotoSummary;
  onSelect: (photoId: number) => void;
};

export const PhotoCard = memo(function PhotoCard({
  imageFetchPriority = "auto",
  imageLoading = "lazy",
  photo,
  onSelect,
}: PhotoCardProps) {
  const thumbnailUrl = resolveApiAssetUrl(photo.thumbnail_url);

  const handleClick = useCallback(() => {
    onSelect(photo.id);
  }, [onSelect, photo.id]);

  return (
    <button
      className="relative aspect-[4/3] overflow-hidden rounded-[24px] border border-black/10 bg-white/80 text-left shadow-panel transition-[border-color,background-color] duration-150 hover:border-black/15 hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay/30"
      onClick={handleClick}
      style={{ contain: 'layout style paint', contentVisibility: 'auto', containIntrinsicSize: 'auto 300px' }}
      type="button"
    >
      <div className="h-full w-full overflow-hidden bg-mist/60">
        {thumbnailUrl ? (
          <img
            alt={photo.file_name}
            className="h-full w-full object-cover"
            decoding="async"
            draggable={false}
            fetchPriority={imageFetchPriority}
            height={photo.height}
            loading={imageLoading}
            src={thumbnailUrl}
            width={photo.width}
          />
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/78 via-black/45 to-transparent px-3 pb-3 pt-10 text-white">
        <div className="flex items-center justify-between gap-3">
          <p className="truncate text-sm font-semibold text-white">{photo.file_name}</p>
          <span className="rounded-full bg-white/20 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-white/78">
            {photo.extension.replace(".", "")}
          </span>
        </div>
        <p className="mt-1 text-sm text-white/78">
          {photo.captured_at ? format(new Date(photo.captured_at), "PPP") : "No date available"}
        </p>
      </div>
    </button>
  );
});
