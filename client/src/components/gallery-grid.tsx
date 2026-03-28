import { getGalleryMinCardWidth, type GalleryThumbnailSize } from "@/lib/gallery-layout";
import type { PhotoSummary } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { PhotoCard } from "@/components/photo-card";

type GalleryGridProps = {
  photos: PhotoSummary[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onSelectPhoto: (photoId: number) => void;
  thumbnailSize: GalleryThumbnailSize;
};

export function GalleryGrid({
  photos,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onSelectPhoto,
  thumbnailSize,
}: GalleryGridProps) {
  const minCardWidth = getGalleryMinCardWidth(thumbnailSize);
  const gridStyle = {
    contain: "layout style",
    gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`,
  } satisfies React.CSSProperties;

  if (isLoading) {
    return (
      <div className="h-full">
        <h2 className="text-lg font-semibold text-ink">Loading photos...</h2>
        <div className="mt-4 grid gap-3" style={gridStyle}>
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[24px] border border-black/10 bg-white/70 p-3">
              <div className="aspect-[4/3] animate-pulse rounded-[18px] bg-black/8" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-black/8" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-black/8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col justify-center gap-3 rounded-[24px] border border-black/10 bg-white/65 p-5">
        <h2 className="text-xl font-semibold text-ink">The gallery could not load.</h2>
        <p className="max-w-2xl text-sm leading-6 text-black/60">{errorMessage}</p>
        <div>
          <Button onClick={onRetry} variant="secondary">
            Retry request
          </Button>
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center gap-3 rounded-[24px] border border-black/10 bg-white/65 p-5">
        <h2 className="text-xl font-semibold text-ink">No photos matched this view.</h2>
        <p className="max-w-2xl text-sm leading-6 text-black/60">
          Run a scan or widen the date window to populate the gallery with indexed originals.
        </p>
      </div>
    );
  }

  return (
    <section aria-label="Gallery" className="grid gap-3" style={gridStyle}>
      {photos.map((photo) => (
        <PhotoCard key={photo.id} onSelect={onSelectPhoto} photo={photo} />
      ))}
    </section>
  );
}
