import type { ScanRun } from "@/lib/api";

export const scanOutcomeDefinitions = [
  { key: "accepted_photos", label: "Accepted" },
  { key: "rejected_likely_graphics", label: "Rejected graphics" },
  { key: "unsupported_files", label: "Unsupported files" },
  { key: "excluded_path_skips", label: "Excluded paths" },
  { key: "duplicate_files", label: "Duplicates" },
  { key: "unreadable_files", label: "Unreadable" },
] as const;

export type ScanOutcomeKey = (typeof scanOutcomeDefinitions)[number]["key"];

type ScanOutcomeFallbacks = Partial<Record<ScanOutcomeKey, keyof ScanRun>>;

const outcomeFallbacks: ScanOutcomeFallbacks = {
  accepted_photos: "likely_photos_accepted",
  rejected_likely_graphics: "likely_graphics_rejected",
  unreadable_files: "unreadable_failed_count",
};

export function getOutcomeCount(scanRun: ScanRun | null | undefined, key: ScanOutcomeKey) {
  const diagnosticsValue = scanRun?.diagnostics?.outcome_counts?.[key];
  if (typeof diagnosticsValue === "number") {
    return diagnosticsValue;
  }

  const fallbackKey = outcomeFallbacks[key];
  if (fallbackKey != null) {
    const fallbackValue = scanRun?.[fallbackKey];
    if (typeof fallbackValue === "number") {
      return fallbackValue;
    }
  }
  return 0;
}

export function getTopExcludedCategories(scanRun: ScanRun | null | undefined, limit = 3) {
  const counts = scanRun?.diagnostics?.excluded_path_counts ?? {};
  return Object.entries(counts)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] > 0)
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit);
}

export function getDiagnosticSamplePaths(scanRun: ScanRun | null | undefined, key: string) {
  const value = scanRun?.diagnostics?.sample_paths?.[key];
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}