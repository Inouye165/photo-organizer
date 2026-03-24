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
    getPhoto: vi.fn(),
    getPhotos: vi.fn(),
    getScanErrors: vi.fn(),
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
    file_created_at: null,
    content_hash: null,
    updated_at: new Date().toISOString(),
    variants: [],
  };
}

function configureDashboardMocks() {
  mockedApi.getLatestScanRun.mockResolvedValue({
    scan_run: {
      id: 3,
      status: "completed_with_errors",
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      roots_json: ["fixtures"],
      files_seen: 4,
      photos_indexed: 2,
      errors_count: 1,
      notes: "broken.jpg: corrupt image",
    },
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
  vi.resetAllMocks();
});

describe("DashboardPage", () => {
  it("renders the compact product header copy", async () => {
    mockedApi.getLatestScanRun.mockResolvedValue({ scan_run: null });
    mockedApi.getPhotos.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 });
    mockedApi.getScanErrors.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    mockedApi.getPhoto.mockRejectedValue(new Error("No detail"));

    renderDashboard();

    expect(await screen.findByText("Photo Organizer")).toBeInTheDocument();
    expect(
      screen.getByText("Scan selected folders, index your photos, and browse them by date."),
    ).toBeInTheDocument();
  });

  it("renders the main controls row", async () => {
    mockedApi.getLatestScanRun.mockResolvedValue({ scan_run: null });
    mockedApi.getPhotos.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 });
    mockedApi.getScanErrors.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    mockedApi.getPhoto.mockRejectedValue(new Error("No detail"));

    renderDashboard();

    expect(await screen.findByTestId("controls-row")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run scan" })).toBeInTheDocument();
    expect(screen.getByLabelText("Date from")).toBeInTheDocument();
    expect(screen.getByLabelText("Date to")).toBeInTheDocument();
  });

  it("renders a loading state while gallery data is pending", () => {
    mockedApi.getLatestScanRun.mockReturnValue(new Promise(() => undefined));
    mockedApi.getPhotos.mockReturnValue(new Promise(() => undefined));
    mockedApi.getScanErrors.mockReturnValue(new Promise(() => undefined));
    mockedApi.getPhoto.mockResolvedValue(createPhotoDetail());

    renderDashboard();

    expect(screen.getByText("Loading photos...")).toBeInTheDocument();
  });

  it("renders an empty state when the backend returns no photos", async () => {
    mockedApi.getLatestScanRun.mockResolvedValue({ scan_run: null });
    mockedApi.getPhotos.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 });
    mockedApi.getScanErrors.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 });
    mockedApi.getPhoto.mockRejectedValue(new Error("No detail"));

    renderDashboard();

    expect(await screen.findByText("No photos matched this view.")).toBeInTheDocument();
  });

  it("renders a successful gallery state with real API data", async () => {
    configureDashboardMocks();

    renderDashboard();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getByText("Indexed photos")).toBeInTheDocument();
  });

  it("renders the all-photos overlay from route state", async () => {
    configureDashboardMocks();

    renderDashboard(["/?panel=all"]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("All indexed photos")).toBeInTheDocument();
    expect(await within(dialog).findByText("beach.jpg")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getPhotos).toHaveBeenCalledWith({ page: 1, page_size: 60 });
    });
  });

  it("renders the latest-run overlay with real query context", async () => {
    configureDashboardMocks();

    renderDashboard(["/?dateFrom=2024-02-01&dateTo=2024-02-29&panel=latest-run"]);

    const latestRunDialog = await screen.findByRole("dialog");
    expect(within(latestRunDialog).getByText("Latest run successful photos")).toBeInTheDocument();
    expect(await within(latestRunDialog).findByText("mountain.png")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockedApi.getPhotos).toHaveBeenCalledWith({ page: 1, page_size: 60, scan_run_id: 3 });
    });
  });

  it("renders the latest-scan error overlay with real query context", async () => {
    configureDashboardMocks();

    renderDashboard(["/?dateFrom=2024-02-01&dateTo=2024-02-29&panel=errors"]);

    const errorDialog = await screen.findByRole("dialog");
    expect(within(errorDialog).getByText("Failed and rejected files")).toBeInTheDocument();
    expect(await within(errorDialog).findByText("broken.jpg")).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApi.getScanErrors).toHaveBeenCalledWith({ scan_run_id: 3, page: 1, page_size: 60 });
    });
  });

  it("renders the date-filtered overlay using the active date search params", async () => {
    configureDashboardMocks();

    renderDashboard(["/?dateFrom=2024-02-01&dateTo=2024-02-29&panel=filtered"]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Date-filtered photos")).toBeInTheDocument();
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
});

