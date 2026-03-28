import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type GalleryPerformanceMonitorProps = {
  className?: string;
};

type TimedSample = {
  timestamp: number;
  duration: number;
};

type ResourceSample = TimedSample & {
  transferSize: number;
};

type PerformanceSnapshot = {
  averageFrameMs: number;
  worstFrameMs: number;
  slowFrames: number;
  longTasks: number;
  mediaRequests: number;
  mediaTransferKb: number;
  status: "steady" | "watching" | "busy";
};

const sampleWindowMs = 15000;
const updateIntervalMs = 1000;

const emptySnapshot: PerformanceSnapshot = {
  averageFrameMs: 16,
  worstFrameMs: 16,
  slowFrames: 0,
  longTasks: 0,
  mediaRequests: 0,
  mediaTransferKb: 0,
  status: "steady",
};

function summarizePerformance(
  frameSamples: TimedSample[],
  longTaskSamples: TimedSample[],
  mediaSamples: ResourceSample[],
): PerformanceSnapshot {
  const averageFrameMs = frameSamples.length > 0
    ? frameSamples.reduce((total, sample) => total + sample.duration, 0) / frameSamples.length
    : emptySnapshot.averageFrameMs;
  const worstFrameMs = frameSamples.reduce((worst, sample) => Math.max(worst, sample.duration), 0);
  const slowFrames = frameSamples.filter((sample) => sample.duration > 22).length;
  const longTasks = longTaskSamples.length;
  const mediaRequests = mediaSamples.length;
  const mediaTransferKb = mediaSamples.reduce((total, sample) => total + sample.transferSize, 0) / 1024;
  const status = longTasks > 0 || worstFrameMs > 120
    ? "busy"
    : slowFrames > 6 || averageFrameMs > 20
      ? "watching"
      : "steady";

  return {
    averageFrameMs,
    worstFrameMs,
    slowFrames,
    longTasks,
    mediaRequests,
    mediaTransferKb,
    status,
  };
}

function statusClasses(status: PerformanceSnapshot["status"]) {
  if (status === "busy") {
    return "bg-red-100 text-red-700";
  }

  if (status === "watching") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function statusLabel(status: PerformanceSnapshot["status"]) {
  if (status === "busy") {
    return "Busy";
  }

  if (status === "watching") {
    return "Watching";
  }

  return "Steady";
}

export function GalleryPerformanceMonitor({ className }: GalleryPerformanceMonitorProps) {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot>(emptySnapshot);

  useEffect(() => {
    if (typeof window === "undefined" || typeof performance === "undefined") {
      return undefined;
    }

    const frameSamples: TimedSample[] = [];
    const longTaskSamples: TimedSample[] = [];
    const mediaSamples: ResourceSample[] = [];
    const observers: PerformanceObserver[] = [];

    function pruneSamples(now: number) {
      const cutoff = now - sampleWindowMs;

      while (frameSamples.length > 0) {
        const sample = frameSamples[0];
        if (!sample || sample.timestamp >= cutoff) {
          break;
        }
        frameSamples.shift();
      }

      while (longTaskSamples.length > 0) {
        const sample = longTaskSamples[0];
        if (!sample || sample.timestamp >= cutoff) {
          break;
        }
        longTaskSamples.shift();
      }

      while (mediaSamples.length > 0) {
        const sample = mediaSamples[0];
        if (!sample || sample.timestamp >= cutoff) {
          break;
        }
        mediaSamples.shift();
      }
    }

    let animationFrameId = 0;
    let previousFrameTime = performance.now();

    function trackFrames(now: number) {
      frameSamples.push({ timestamp: now, duration: now - previousFrameTime });
      previousFrameTime = now;
      pruneSamples(now);
      animationFrameId = window.requestAnimationFrame(trackFrames);
    }

    animationFrameId = window.requestAnimationFrame(trackFrames);

    if (typeof PerformanceObserver !== "undefined") {
      try {
        const longTaskObserver = new PerformanceObserver((entryList) => {
          const now = performance.now();

          entryList.getEntries().forEach((entry) => {
            longTaskSamples.push({ timestamp: now, duration: entry.duration });
          });

          pruneSamples(now);
        });
        longTaskObserver.observe({ type: "longtask", buffered: true });
        observers.push(longTaskObserver);
      } catch {
        void 0;
      }

      try {
        const resourceObserver = new PerformanceObserver((entryList) => {
          entryList.getEntries().forEach((entry) => {
            const resourceEntry = entry as PerformanceResourceTiming;
            if (resourceEntry.initiatorType !== "img" || !resourceEntry.name.includes("/media/")) {
              return;
            }

            mediaSamples.push({
              timestamp: resourceEntry.responseEnd || performance.now(),
              duration: resourceEntry.duration,
              transferSize: resourceEntry.transferSize,
            });
          });

          pruneSamples(performance.now());
        });
        resourceObserver.observe({ type: "resource", buffered: true });
        observers.push(resourceObserver);
      } catch {
        void 0;
      }
    }

    const intervalId = window.setInterval(() => {
      const now = performance.now();
      pruneSamples(now);
      setSnapshot(summarizePerformance(frameSamples, longTaskSamples, mediaSamples));
    }, updateIntervalMs);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearInterval(intervalId);
      observers.forEach((observer) => {
        observer.disconnect();
      });
    };
  }, []);

  return (
    <div className={cn("mt-3 flex flex-wrap items-center gap-2 rounded-[20px] border border-black/8 bg-black/[0.03] px-3 py-2", className)} data-testid="gallery-performance-monitor">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-black/45">Responsiveness monitor</p>
      <span className={cn("rounded-full px-2 py-1 text-xs font-semibold", statusClasses(snapshot.status))}>
        {statusLabel(snapshot.status)}
      </span>
      <span className="rounded-full bg-white/80 px-2 py-1 text-xs text-black/60">
        Avg frame {snapshot.averageFrameMs.toFixed(1)} ms
      </span>
      <span className="rounded-full bg-white/80 px-2 py-1 text-xs text-black/60">
        Worst frame {snapshot.worstFrameMs.toFixed(0)} ms
      </span>
      <span className="rounded-full bg-white/80 px-2 py-1 text-xs text-black/60">
        Slow frames {snapshot.slowFrames}
      </span>
      <span className="rounded-full bg-white/80 px-2 py-1 text-xs text-black/60">
        Long tasks {snapshot.longTasks}
      </span>
      <span className="rounded-full bg-white/80 px-2 py-1 text-xs text-black/60">
        Media {snapshot.mediaRequests} req / {snapshot.mediaTransferKb.toFixed(0)} KB
      </span>
    </div>
  );
}