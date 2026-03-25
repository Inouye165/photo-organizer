export type ScanError = {
  id: number;
  scan_run_id: number;
  file_path: string;
  file_name: string;
  error_type: string;
  reason: string;
  diagnostic_metadata: Record<string, unknown> | null;
  created_at: string;
};

export type ScanErrorListResponse = {
  items: ScanError[];
  total: number;
  page: number;
  page_size: number;
};

export type ScanErrorListParams = {
  scan_run_id?: number;
  page?: number;
  page_size?: number;
};

export type ScanRun = {
  id: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  roots_json: string[];
  mode: string;
  files_seen: number;
  candidate_images_evaluated: number;
  photos_indexed: number;
  likely_photos_accepted: number;
  likely_graphics_rejected: number;
  unreadable_failed_count: number;
  errors_count: number;
  notes: string | null;
};

export type DiscoveryTier = {
  name: string;
  description: string;
  paths: string[];
};

export type DiscoveryPlan = {
  mode: string;
  ordered_roots: string[];
  tiers: DiscoveryTier[];
  excluded_path_categories: string[];
};

export type DiscoveryPlanResponse = {
  plan: DiscoveryPlan;
};

export type LatestScanRunResponse = {
  scan_run: ScanRun | null;
};

export type ScanRunListResponse = {
  items: ScanRun[];
  total: number;
  page: number;
  page_size: number;
};

export type ScanRunListParams = {
  page?: number;
  page_size?: number;
};

export type StartScanRunRequest = {
  mode?: "full" | "evaluation";
};

export type ResetIndexStateResponse = {
  photos_deleted: number;
  variants_deleted: number;
  scan_run_photos_deleted: number;
  scan_errors_deleted: number;
  scan_runs_deleted: number;
  media_files_deleted: number;
};

export type PhotoVariant = {
  id: number;
  kind: "thumbnail" | "display_webp";
  relative_path: string;
  width: number;
  height: number;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  url: string;
};

export type PhotoSummary = {
  id: number;
  file_name: string;
  extension: string;
  mime_type: string;
  file_size_bytes: number;
  width: number;
  height: number;
  captured_at: string | null;
  file_modified_at: string;
  created_at: string;
  classification_label: string;
  thumbnail_url: string | null;
  display_url: string | null;
};

export type PhotoDetail = PhotoSummary & {
  original_path: string;
  latest_scan_run_id: number | null;
  file_created_at: string | null;
  content_hash: string | null;
  classification_details: Record<string, unknown> | null;
  updated_at: string;
  variants: PhotoVariant[];
};

export type PhotoListResponse = {
  items: PhotoSummary[];
  total: number;
  page: number;
  page_size: number;
};

export type PhotoListParams = {
  page?: number;
  page_size?: number;
  date_from?: string;
  date_to?: string;
  scan_run_id?: number;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

function toApiUrl(pathname: string) {
  return new URL(pathname, apiBaseUrl).toString();
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function resolveApiAssetUrl(pathname: string | null) {
  if (!pathname) {
    return null;
  }
  if (pathname.startsWith("http://") || pathname.startsWith("https://")) {
    return pathname;
  }
  return toApiUrl(pathname);
}

export async function getLatestScanRun() {
  const response = await fetch(toApiUrl("/api/scan-runs/latest"));
  return readJson<LatestScanRunResponse>(response);
}

export async function getDiscoveryPlan() {
  const response = await fetch(toApiUrl("/api/scan-runs/discovery-plan"));
  return readJson<DiscoveryPlanResponse>(response);
}

export async function startScanRun(request: StartScanRunRequest = {}) {
  const response = await fetch(toApiUrl("/api/scan-runs"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode: request.mode ?? "full" }),
  });
  return readJson<ScanRun>(response);
}

export async function resetScanState() {
  const response = await fetch(toApiUrl("/api/scan-runs/reset"), {
    method: "POST",
  });
  return readJson<ResetIndexStateResponse>(response);
}

export async function getScanRuns(params: ScanRunListParams) {
  const url = new URL(toApiUrl("/api/scan-runs"));
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("page_size", String(params.page_size ?? 8));
  const response = await fetch(url);
  return readJson<ScanRunListResponse>(response);
}

export async function getPhotos(params: PhotoListParams) {
  const url = new URL(toApiUrl("/api/photos"));
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("page_size", String(params.page_size ?? 24));
  if (params.date_from) {
    url.searchParams.set("date_from", params.date_from);
  }
  if (params.date_to) {
    url.searchParams.set("date_to", params.date_to);
  }
  if (params.scan_run_id != null) {
    url.searchParams.set("scan_run_id", String(params.scan_run_id));
  }
  const response = await fetch(url);
  return readJson<PhotoListResponse>(response);
}

export async function getPhoto(photoId: number) {
  const response = await fetch(toApiUrl(`/api/photos/${photoId}`));
  return readJson<PhotoDetail>(response);
}

export async function getScanErrors(params: ScanErrorListParams) {
  const url = new URL(toApiUrl("/api/scan-errors"));
  url.searchParams.set("page", String(params.page ?? 1));
  url.searchParams.set("page_size", String(params.page_size ?? 50));
  if (params.scan_run_id != null) {
    url.searchParams.set("scan_run_id", String(params.scan_run_id));
  }
  const response = await fetch(url);
  return readJson<ScanErrorListResponse>(response);
}
