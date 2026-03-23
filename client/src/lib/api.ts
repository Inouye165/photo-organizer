export type ScanRun = {
  id: number;
  status: string;
  started_at: string;
  finished_at: string | null;
  roots_json: string[];
  files_seen: number;
  photos_indexed: number;
  errors_count: number;
  notes: string | null;
};

export type LatestScanRunResponse = {
  scan_run: ScanRun | null;
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
  thumbnail_url: string | null;
  display_url: string | null;
};

export type PhotoDetail = PhotoSummary & {
  original_path: string;
  file_created_at: string | null;
  content_hash: string | null;
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

export async function startScanRun() {
  const response = await fetch(toApiUrl("/api/scan-runs"), {
    method: "POST",
  });
  return readJson<ScanRun>(response);
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
  const response = await fetch(url);
  return readJson<PhotoListResponse>(response);
}

export async function getPhoto(photoId: number) {
  const response = await fetch(toApiUrl(`/api/photos/${photoId}`));
  return readJson<PhotoDetail>(response);
}
