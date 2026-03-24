import { Images } from "lucide-react";

import type { PhotoSummary } from "@/lib/api";

import { ModalShell } from "@/components/modal-shell";
import { PhotoCard } from "@/components/photo-card";
import { Button } from "@/components/ui/button";

type PhotoCollectionModalProps = {
  count: number;
  description: string;
  emptyMessage: string;
  emptyTitle: string;
  errorMessage: string | null;
  eyebrow: string;
  isError: boolean;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onSelectPhoto: (photoId: number) => void;
  photos: PhotoSummary[];
  title: string;
};

export function PhotoCollectionModal({
  count,
  description,
  emptyMessage,
  emptyTitle,
  errorMessage,
  eyebrow,
  isError,
  isLoading,
  isOpen,
  onClose,
  onRetry,
  onSelectPhoto,
  photos,
  title,
}: PhotoCollectionModalProps) {
  return (
    <ModalShell
      countLabel={`${count} ${count === 1 ? "photo" : "photos"}`}
      description={description}
      eyebrow={eyebrow}
      isOpen={isOpen}
      onClose={onClose}
      title={title}
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="overflow-hidden rounded-[24px] border border-black/10 bg-white/70 p-3">
              <div className="aspect-[4/3] animate-pulse rounded-[18px] bg-black/8" />
              <div className="mt-3 h-4 w-3/4 animate-pulse rounded-full bg-black/8" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded-full bg-black/8" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-[24px] border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold text-red-800">Failed to load photos.</p>
          <p className="mt-1 leading-6">{errorMessage ?? "The request did not complete."}</p>
          <div className="mt-3">
            <Button onClick={onRetry} type="button" variant="secondary">
              Retry request
            </Button>
          </div>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-[24px] border border-dashed border-black/10 bg-white/55 p-6 text-center">
          <Images size={28} className="text-black/20" />
          <p className="text-lg font-semibold text-ink">{emptyTitle}</p>
          <p className="max-w-xl text-sm leading-6 text-black/55">{emptyMessage}</p>
        </div>
      ) : (
        <section aria-label={title} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => (
            <PhotoCard key={photo.id} onSelect={onSelectPhoto} photo={photo} />
          ))}
        </section>
      )}
    </ModalShell>
  );
}
