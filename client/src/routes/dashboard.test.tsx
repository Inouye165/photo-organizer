import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DateRangeFilter } from "@/components/date-range-filter";
import { DashboardPage } from "@/routes/dashboard";
import * as api from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    getLatestScanRun: vi.fn(),
    getDiscoveryPlan: vi.fn(),
    getPhoto: vi.fn(),
    getPhotos: vi.fn(),
    resetScanState: vi.fn(),
    getScanErrors: vi.fn(),
    getScanRuns: vi.fn(),
    startScanRun: vi.fn(),
  };
});

const mockedApi = vi.mocked(api);

const basePhoto = {
  id: 1,
  file_name: "beach.jpg",
  extension: ".jpg",
  mime_type: "image/jpeg",
  file_size_bytes: 4096,
  width: 1200,
  height: 800,
  captured_at: new Date("2024-01-05").toISOString(),
  file_modified_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  classification_label: "likely_photo",
  thumbnail_url: "/media/photos/1/thumbnail.webp",
  display_url: "/media/photos/1/display_webp.webp",
};

const secondPhoto = {
  ...basePhoto,
  id: 2,
  file_name: "mountain.png",
  extension: ".png",
  captured_at: new Date("2024-02-18").toISOString(),
  thumbnail_url: "/media/photos/2/thumbnail.webp",
  display_url: "/media/photos/2/display_webp.webp",
};

function createPhotoResponse(items = [basePhoto], total = items.length) {
  return {
    items,
    total,
    page: 1,
    page_size: 24,
  };
}

function createPhotoDetail() {
  return {
    ...basePhoto,
    original_path: "photos/beach.jpg",
    latest_scan_run_id: 3,
    file_created_at: null,
    content_hash: null,
    classification_details: {
      score: 0.88,
      reasons: ["Camera EXIF metadata is present."],
    },
    updated_at: new Date().toISOString(),
    variants: [],
  };
}

function configureDashboardMocks() {
  mockedApi.getDiscoveryPlan.mockResolvedValue({
    plan: {
      mode: "machine",
      ordered_roots: ["C:/", "D:/"],
      tiers: [
        {
          name: "Tier 1",
          description: "Obvious photo folders and import locations visited first.",
          paths: ["C:/Users/test/Pictures", "D:/DCIM"],
        },
        {
          name: "Tier 2",
          description: "Common user-content folders that still often contain photos.",
          paths: ["C:/Users/test/Desktop"],
        },
        {
          name: "Tier 3",
          description: "Remaining accessible machine roots scanned after higher-probability areas.",
          paths: ["C:/", "D:/"],
        },
      ],
      excluded_path_categories: [
        "managed generated media",
        "project and dependency artifacts",
        "system directories",
      ],
    },
  });
  const recentRun = {
    id: 2,
    status: "completed",
    started_at: new Date("2024-02-10T12:00:00.000Z").toISOString(),
    finished_at: new Date("2024-02-10T12:02:00.000Z").toISOString(),
    roots_json: ["fixtures"],
    mode: "full",
    files_seen: 2,
    candidate_images_evaluated: 2,
    photos_indexed: 1,
    likely_photos_accepted: 1,
    likely_graphics_rejected: 0,
    unreadable_failed_count: 0,
    errors_count: 0,
    diagnostics: {
      outcome_counts: {
        accepted_photos: 1,
        candidate_images_evaluated: 2,
        duplicate_files: 0,
        excluded_path_skips: 4,
        rejected_likely_graphics: 0,
        unreadable_files: 0,
        unsupported_files: 1,
      },
      excluded_path_counts: {
        "project and dependency artifacts": 2,
        "temp and cache directories": 2,
      },
      sample_paths: {
        accepted_photos: ["C:/Users/test/Pictures/beach.jpg"],
        duplicates: [],
        excluded_paths: ["C:/repo/node_modules"],
        rejected_graphics: [],
        unreadable_files: [],
        unsupported_files: ["C:/repo/client/public/logo.png"],
      },
    },
    notes: null,
  };

  mockedApi.getLatestScanRun.mockResolvedValue({
    scan_run: {
      id: 3,
      status: "completed_with_errors",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      roots_json: ["fixtures"],
      mode: "evaluation",
      files_seen: 4,
      candidate_images_evaluated: 4,
      photos_indexed: 2,
      likely_photos_accepted: 2,
      likely_graphics_rejected: 1,
      unreadable_failed_count: 1,
      errors_count: 1,
      diagnostics: {
        outcome_counts: {
          accepted_photos: 2,
          candidate_images_evaluated: 4,
          duplicate_files: 0,
          excluded_path_skips: 18,
          rejected_likely_graphics: 1,
          unreadable_files: 1,
          unsupported_files: 6,
        },
        excluded_path_counts: {
          "project and dependency artifacts": 8,
          "temp and cache directories": 6,
          "test and sample directories": 4,
        },
        sample_paths: {
          accepted_photos: ["C:/Users/test/Pictures/beach.jpg"],
          duplicates: [],
          excluded_paths: ["C:/repo/node_modules", "C:/repo/test-results"],
          rejected_graphics: ["C:/repo/client/public/logo.jpg"],
          unreadable_files: ["C:/repo/fixtures/broken.jpg"],
          unsupported_files: ["C:/repo/client/public/logo.png"],
        },
      },
      notes: "broken.jpg: corrupt image",
    },
  });
  mockedApi.getScanRuns.mockResolvedValue({
    items: [
      {
        id: 3,
        status: "completed_with_errors",
        started_at: new Date("2024-02-20T10:00:00.000Z").toISOString(),
        finished_at: new Date("2024-02-20T10:03:00.000Z").toISOString(),
        roots_json: ["fixtures"],
        mode: "evaluation",
        files_seen: 4,
        candidate_images_evaluated: 4,
        photos_indexed: 2,
        likely_photos_accepted: 2,
        likely_graphics_rejected: 1,
        unreadable_failed_count: 1,
        errors_count: 1,
        diagnostics: {
          outcome_counts: {
            accepted_photos: 2,
            candidate_images_evaluated: 4,
            duplicate_files: 0,
            excluded_path_skips: 18,
            rejected_likely_graphics: 1,
            unreadable_files: 1,
            unsupported_files: 6,
          },
          excluded_path_counts: {
            "project and dependency artifacts": 8,
            "temp and cache directories": 6,
          },
          sample_paths: {
            accepted_photos: ["C:/Users/test/Pictures/beach.jpg"],
            duplicates: [],
            excluded_paths: ["C:/repo/node_modules"],
            rejected_graphics: ["C:/repo/client/public/logo.jpg"],
            unreadable_files: ["C:/repo/fixtures/broken.jpg"],
            unsupported_files: ["C:/repo/client/public/logo.png"],
          },
        },
        notes: "broken.jpg: corrupt image",
      },
      recentRun,
    ],
    total: 2,
    page: 1,
    page_size: 6,
  });
  mockedApi.resetScanState.mockResolvedValue({
    photos_deleted: 2,
    variants_deleted: 4,
    scan_run_photos_deleted: 2,
    scan_errors_deleted: 1,
    scan_runs_deleted: 2,
    media_files_deleted: 4,
  });
  mockedApi.startScanRun.mockResolvedValue({
    id: 4,
    status: "completed",
    started_at: new Date("2024-02-20T10:05:00.000Z").toISOString(),
    finished_at: new Date("2024-02-20T10:07:00.000Z").toISOString(),
    roots_json: ["fixtures"],
    mode: "evaluation",
    files_seen: 6,
    candidate_images_evaluated: 6,
    photos_indexed: 3,
    likely_photos_accepted: 3,
    likely_graphics_rejected: 2,
    unreadable_failed_count: 1,
    errors_count: 3,
    diagnostics: {
      outcome_counts: {
        accepted_photos: 3,
        candidate_images_evaluated: 6,
        duplicate_files: 1,
        excluded_path_skips: 11,
        rejected_likely_graphics: 2,
        unreadable_files: 1,
        unsupported_files: 4,
      },
      excluded_path_counts: {
        "project and dependency artifacts": 5,
        "system directories": 3,
      },
      sample_paths: {
        accepted_photos: ["C:/Users/test/Pictures/beach.jpg"],
        duplicates: ["C:/Users/test/Pictures/beach-copy.jpg"],
        excluded_paths: ["C:/repo/node_modules"],
        rejected_graphics: ["C:/repo/client/public/logo.jpg"],
        unreadable_files: ["C:/repo/fixtures/broken.jpg"],
        unsupported_files: ["C:/repo/client/public/logo.png"],
      },
    },
    notes: null,
  });
  mockedApi.getPhoto.mockResolvedValue(createPhotoDetail());
  mockedApi.getScanErrors.mockResolvedValue({
    items: [
      {
        id: 7,
        scan_run_id: 3,
        file_path: "fixtures/broken.jpg",
        file_name: "broken.jpg",
        error_type: "corrupt",
        reason: "cannot identify image file",
        diagnostic_metadata: {
          processing_stage: "file_processing",
          exception_class: "UnidentifiedImageError",
        },
        created_at: new Date().toISOString(),
      },
    ],
    total: 1,
    page: 1,
    page_size: 50,
  });
  mockedApi.getPhotos.mockImplementation(async (params) => {
    if (params.scan_run_id === 3) {
      return createPhotoResponse([basePhoto, secondPhoto], 2);
    }
    if (params.date_from || params.date_to) {
      return createPhotoResponse([secondPhoto], 1);
    }
    return createPhotoResponse([basePhoto, secondPhoto], 2);
  });
}

function renderDashboard(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <DashboardPage />,
      },
    ],
    { initialEntries },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
  vi.resetAllMocks();
});

describe("DashboardPage", () => {
  it("renders the compact product header copy", async () => {
    mockedApi.getLatestScanRun.mockResolvedValue({ scan_run: null });
    mockedApi.getDiscoveryPlan.mockResolvedValue({
      plan: { mode: "configured", ordered_roots: [], tiers: [], excluded_path_categories: [] },
    });
    mockedApi.getScanRuns.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 6 });
    mockedApi.getPhotos.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 });
    mockedApi.getScanErrors.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    mockedApi.resetScanState.mockResolvedValue({ photos_deleted: 0, variants_deleted: 0, scan_run_photos_deleted: 0, scan_errors_deleted: 0, scan_runs_deleted: 0, media_files_deleted: 0 });
    mockedApi.getPhoto.mockRejectedValue(new Error("No detail"));

    renderDashboard();

    expect(await screen.findByText("Photo Organizer")).toBeInTheDocument();
    expect(
      screen.getByText("Scan selected folders, index your photos, and browse them by date."),
    ).toBeInTheDocument();
  });

  it("renders the main controls row", async () => {
    mockedApi.getLatestScanRun.mockResolvedValue({ scan_run: null });
    mockedApi.getDiscoveryPlan.mockResolvedValue({
      plan: { mode: "configured", ordered_roots: [], tiers: [], excluded_path_categories: [] },
    });
    mockedApi.getScanRuns.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 6 });
    mockedApi.getPhotos.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 });
    mockedApi.getScanErrors.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    mockedApi.resetScanState.mockResolvedValue({ photos_deleted: 0, variants_deleted: 0, scan_run_photos_deleted: 0, scan_errors_deleted: 0, scan_runs_deleted: 0, media_files_deleted: 0 });
    mockedApi.getPhoto.mockRejectedValue(new Error("No detail"));

    renderDashboard();

    expect(await screen.findByTestId("controls-row")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "New Scan" })).toBeInTheDocument();
    const feedbackPanel = screen.getByTestId("scan-feedback-panel");
    expect(feedbackPanel).toBeInTheDocument();
    expect(within(feedbackPanel).getAllByText("Ready to scan").length).toBeGreaterThan(0);
    expect(within(feedbackPanel).getByText("Scanning...")).toBeInTheDocument();
    expect(within(feedbackPanel).getByText("Complete")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run full library scan" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear indexed data" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start fresh evaluation" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date from")).toBeInTheDocument();
    expect(screen.getByLabelText("Date to")).toBeInTheDocument();
  });

  it("renders a loading state while gallery data is pending", () => {
    mockedApi.getLatestScanRun.mockReturnValue(new Promise(() => undefined));
    mockedApi.getDiscoveryPlan.mockReturnValue(new Promise(() => undefined));
    mockedApi.getScanRuns.mockReturnValue(new Promise(() => undefined));
    mockedApi.getPhotos.mockReturnValue(new Promise(() => undefined));
    mockedApi.getScanErrors.mockReturnValue(new Promise(() => undefined));
    mockedApi.resetScanState.mockResolvedValue({ photos_deleted: 0, variants_deleted: 0, scan_run_photos_deleted: 0, scan_errors_deleted: 0, scan_runs_deleted: 0, media_files_deleted: 0 });
    mockedApi.getPhoto.mockResolvedValue(createPhotoDetail());

    renderDashboard();

    expect(screen.getByText("Loading photos...")).toBeInTheDocument();
  });

  it("renders an empty state when the backend returns no photos", async () => {
    mockedApi.getLatestScanRun.mockResolvedValue({ scan_run: null });
    mockedApi.getDiscoveryPlan.mockResolvedValue({
      plan: { mode: "configured", ordered_roots: [], tiers: [], excluded_path_categories: [] },
    });
    mockedApi.getScanRuns.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 6 });
    mockedApi.getPhotos.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 });
    mockedApi.getScanErrors.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    mockedApi.resetScanState.mockResolvedValue({ photos_deleted: 0, variants_deleted: 0, scan_run_photos_deleted: 0, scan_errors_deleted: 0, scan_runs_deleted: 0, media_files_deleted: 0 });
    mockedApi.getPhoto.mockRejectedValue(new Error("No detail"));

    renderDashboard();

    expect(await screen.findByText("No photos matched this view.")).toBeInTheDocument();
  });

  it("renders a successful gallery state with real API data", async () => {
    configureDashboardMocks();

    renderDashboard();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getAllByText("Indexed library").length).toBeGreaterThan(0);
    expect(screen.getByText("Scan history")).toBeInTheDocument();
    expect(screen.getByText("Run #3")).toBeInTheDocument();
    expect(screen.getByText("evaluation")).toBeInTheDocument();
    expect(screen.getAllByText(/Excluded paths 18/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Top excluded categories")).toBeInTheDocument();
    expect(screen.getByTestId("discovery-plan-card")).toBeInTheDocument();
    expect(screen.getByText("Priority-first traversal with explainable exclusions.")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-performance-monitor")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Large icons" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Medium icons" })).toHaveAttribute("aria-pressed", "true");
  });

  it("persists the selected gallery icon size", async () => {
    configureDashboardMocks();

    renderDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Small icons" }));

    expect(screen.getByRole("button", { name: "Small icons" })).toHaveAttribute("aria-pressed", "true");
    expect(window.localStorage.getItem("photo-organizer.gallery-thumbnail-size")).toBe("small");
  });

  it("renders the all-photos overlay from route state", async () => {
    configureDashboardMocks();

    renderDashboard(["/?panel=all"]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Indexed library")).toBeInTheDocument();
    expect(await within(dialog).findByText("beach.jpg")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getPhotos).toHaveBeenCalledWith({ page: 1, page_size: 60 });
    });
  });

  it("renders a selected run photo overlay with real query context", async () => {
    configureDashboardMocks();

    renderDashboard(["/?dateFrom=2024-02-01&dateTo=2024-02-29&panel=run-photos&runId=3"]);

    const latestRunDialog = await screen.findByRole("dialog");
    expect(within(latestRunDialog).getByText("Run #3 accepted likely photos")).toBeInTheDocument();
    expect(await within(latestRunDialog).findByText("mountain.png")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.getPhotos).toHaveBeenCalledWith({ page: 1, page_size: 60, scan_run_id: 3 });
    });
  });

  it("renders a selected run error overlay with real query context", async () => {
    configureDashboardMocks();

    renderDashboard(["/?dateFrom=2024-02-01&dateTo=2024-02-29&panel=run-errors&runId=3"]);

    const errorDialog = await screen.findByRole("dialog");
    expect(within(errorDialog).getByText("Run #3 failed and rejected files")).toBeInTheDocument();
    expect(await within(errorDialog).findByText("broken.jpg")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getScanErrors).toHaveBeenCalledWith({ scan_run_id: 3, page: 1, page_size: 60 });
    });
  });

  it("renders a historical run photo overlay from route state", async () => {
    configureDashboardMocks();

    renderDashboard(["/?panel=run-photos&runId=2"]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Run #2 accepted likely photos")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.getPhotos).toHaveBeenCalledWith({ page: 1, page_size: 60, scan_run_id: 2 });
    });
  });

  it("renders the date-filtered overlay using the active date search params", async () => {
    configureDashboardMocks();

    renderDashboard(["/?dateFrom=2024-02-01&dateTo=2024-02-29&panel=filtered"]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Filtered library photos")).toBeInTheDocument();
    expect(await within(dialog).findByText("mountain.png")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getPhotos).toHaveBeenCalledWith({
        page: 1,
        page_size: 60,
        date_from: "2024-02-01",
        date_to: "2024-02-29",
      });
    });
  });

  it("submits selected dates through the filter contract", async () => {
    const onApply = vi.fn();
    const onClear = vi.fn();

    render(
      <DateRangeFilter
        initialDateFrom=""
        initialDateTo=""
        onApply={onApply}
        onClear={onClear}
      />,
    );

    fireEvent.change(screen.getByLabelText("Date from"), { target: { value: "2024-01-01" } });
    fireEvent.change(screen.getByLabelText("Date to"), { target: { value: "2024-01-31" } });
    fireEvent.submit(screen.getByRole("button", { name: "Apply filters" }).closest("form")!);

    expect(onApply).toHaveBeenCalledWith({ dateFrom: "2024-01-01", dateTo: "2024-01-31" });
    expect(onClear).not.toHaveBeenCalled();
  });

  it("confirms and starts a fresh evaluation run", async () => {
    configureDashboardMocks();

    renderDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Start fresh evaluation" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Start a genuinely fresh evaluation run")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear state and start evaluation" }));

    await waitFor(() => {
      expect(mockedApi.resetScanState).toHaveBeenCalledTimes(1);
      expect(mockedApi.startScanRun).toHaveBeenCalledWith({ mode: "evaluation" });
    });
  });

  it("clears indexed data without automatically starting a new scan", async () => {
    configureDashboardMocks();

    renderDashboard();

    fireEvent.click(await screen.findByRole("button", { name: "Clear indexed data" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Clear indexed data and generated copies")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Clear indexed data" }));

    await waitFor(() => {
      expect(mockedApi.resetScanState).toHaveBeenCalledTimes(1);
      expect(mockedApi.startScanRun).not.toHaveBeenCalled();
    });
  });
});

