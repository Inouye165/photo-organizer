import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    startScanRun: vi.fn(),
  };
});

const mockedApi = vi.mocked(api);

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
  it("renders a loading state while gallery data is pending", () => {
    mockedApi.getLatestScanRun.mockReturnValue(new Promise(() => undefined));
    mockedApi.getPhotos.mockReturnValue(new Promise(() => undefined));
    mockedApi.getPhoto.mockResolvedValue({
      id: 1,
      file_name: "beach.jpg",
      extension: ".jpg",
      mime_type: "image/jpeg",
      file_size_bytes: 1024,
      width: 1200,
      height: 800,
      captured_at: null,
      file_modified_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      thumbnail_url: "/media/photos/1/thumbnail.webp",
      display_url: "/media/photos/1/display_webp.webp",
      original_path: "photos/beach.jpg",
      file_created_at: null,
      content_hash: null,
      updated_at: new Date().toISOString(),
      variants: [],
    });

    renderDashboard();

    expect(screen.getByText("Loading your real library...")).toBeInTheDocument();
  });

  it("renders an empty state when the backend returns no photos", async () => {
    mockedApi.getLatestScanRun.mockResolvedValue({ scan_run: null });
    mockedApi.getPhotos.mockResolvedValue({ items: [], total: 0, page: 1, page_size: 24 });
    mockedApi.getPhoto.mockRejectedValue(new Error("No detail"));

    renderDashboard();

    expect(await screen.findByText("No photos matched this view.")).toBeInTheDocument();
  });

  it("renders a successful gallery state with real API data", async () => {
    mockedApi.getLatestScanRun.mockResolvedValue({
      scan_run: {
        id: 3,
        status: "completed",
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        roots_json: ["fixtures"],
        files_seen: 4,
        photos_indexed: 2,
        errors_count: 0,
        notes: null,
      },
    });
    mockedApi.getPhotos.mockResolvedValue({
      items: [
        {
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
        },
      ],
      total: 1,
      page: 1,
      page_size: 24,
    });
    mockedApi.getPhoto.mockResolvedValue({
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
      original_path: "photos/beach.jpg",
      file_created_at: null,
      content_hash: null,
      updated_at: new Date().toISOString(),
      variants: [],
    });

    renderDashboard();

    expect(await screen.findByText("beach.jpg")).toBeInTheDocument();
    expect(screen.getByText("Real indexed photos")).toBeInTheDocument();
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

