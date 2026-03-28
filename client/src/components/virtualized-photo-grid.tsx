import { useEffect, useRef, useState } from "react";

import { useVirtualizer } from "@tanstack/react-virtual";

import type { PhotoSummary } from "@/lib/api";

import { PhotoCard } from "@/components/photo-card";

const gridGapPx = 12;
const virtualizedRowsAhead = 6;
const fallbackRowCount = 6;

type VirtualizedPhotoGridProps = {
  ariaLabel: string;
  photos: PhotoSummary[];
  onSelectPhoto: (photoId: number) => void;
  scrollElement: HTMLDivElement | null;
};

function getColumnCount(viewportWidth: number) {
  if (viewportWidth >= 1280) {
    return 3;
  }

  if (viewportWidth >= 640) {
    return 2;
  }

  return 1;
}

export function VirtualizedPhotoGrid({
  ariaLabel,
  photos,
  onSelectPhoto,
  scrollElement,
}: VirtualizedPhotoGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window === "undefined" ? 1280 : window.innerWidth,
  );
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function handleResize() {
      setViewportWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container == null) {
      return undefined;
    }

    const observedContainer = container;

    function updateContainerWidth() {
      setContainerWidth(observedContainer.clientWidth);
    }

    updateContainerWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateContainerWidth();
    });
    resizeObserver.observe(observedContainer);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const columnCount = getColumnCount(viewportWidth);
  const cardWidth = containerWidth > 0
    ? Math.max((containerWidth - (gridGapPx * (columnCount - 1))) / columnCount, 0)
    : 280;
  const rowHeight = Math.ceil(cardWidth * 0.75);
  const rowSize = rowHeight + gridGapPx;
  const rowCount = Math.ceil(photos.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    estimateSize: () => rowSize,
    getScrollElement: () => scrollElement,
    overscan: virtualizedRowsAhead,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [columnCount, rowSize, photos.length, rowVirtualizer]);

  const hasActiveScrollElement = scrollElement != null && containerWidth > 0;
  const virtualRows = hasActiveScrollElement
    ? rowVirtualizer.getVirtualItems()
    : Array.from({ length: Math.min(rowCount, fallbackRowCount) }, (_, index) => ({
      index,
      key: index,
      start: index * rowSize,
    }));
  const totalHeight = Math.max(rowCount * rowSize - gridGapPx, 0);

  return (
    <div ref={containerRef}>
      <section aria-label={ariaLabel} className="relative" style={{ height: totalHeight }}>
        {virtualRows.map((virtualRow) => {
          const startIndex = virtualRow.index * columnCount;
          const rowPhotos = photos.slice(startIndex, startIndex + columnCount);

          return (
            <div
              key={virtualRow.key}
              className="absolute left-0 top-0 grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                transform: `translateY(${virtualRow.start}px)`,
                width: "100%",
                willChange: 'transform',
                contain: 'layout style',
              }}
            >
              {rowPhotos.map((photo) => (
                <PhotoCard imageLoading="eager" key={photo.id} onSelect={onSelectPhoto} photo={photo} />
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
