export const galleryThumbnailSizes = ["large", "medium", "small"] as const;

export type GalleryThumbnailSize = (typeof galleryThumbnailSizes)[number];

const galleryMinCardWidths: Record<GalleryThumbnailSize, number> = {
  large: 320,
  medium: 236,
  small: 172,
};

export function getGalleryMinCardWidth(size: GalleryThumbnailSize) {
  return galleryMinCardWidths[size];
}

export function getGalleryColumnCount(
  containerWidth: number,
  size: GalleryThumbnailSize,
  gapPx: number,
) {
  const minCardWidth = getGalleryMinCardWidth(size);
  return Math.max(Math.floor((Math.max(containerWidth, minCardWidth) + gapPx) / (minCardWidth + gapPx)), 1);
}