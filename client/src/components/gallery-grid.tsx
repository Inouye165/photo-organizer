import type { PhotoSummary } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PhotoCard } from "@/components/photo-card";

type GalleryGridProps = {
  photos: PhotoSummary[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  onRetry: () => void;
  onSelectPhoto: (photoId: number) => void;
};

export function GalleryGrid({
  photos,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  onSelectPhoto,
}: GalleryGridProps) {
  if (isLoading) {
    return (
      <Card>
        <h2 className="text-2xl font-semibold text-ink">Loading your real library...</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[28px] border border-black/10 bg-white/70 p-3">
              <div className="aspect-[4/3] animate-pulse rounded-[20px] bg-black/8" />
              <div className="mt-4 h-4 w-3/4 animate-pulse rounded-full bg-black/8" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-black/8" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-ink">The gallery could not load.</h2>
        <p className="max-w-2xl text-sm leading-6 text-black/60">{errorMessage}</p>
        <div>
          <Button onClick={onRetry} variant="secondary">
            Retry request
          </Button>
        </div>
      </Card>
    );
  }

  if (photos.length === 0) {
    return (
      <Card className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold text-ink">No photos matched this view.</h2>
        <p className="max-w-2xl text-sm leading-6 text-black/60">
          Run a scan or widen the date window to populate the gallery with indexed originals.
        </p>
      </Card>
    );
  }

  return (
    <section aria-label="Gallery" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {photos.map((photo) => (
        <PhotoCard key={photo.id} onSelect={onSelectPhoto} photo={photo} />
      ))}
    </section>
  );
}
