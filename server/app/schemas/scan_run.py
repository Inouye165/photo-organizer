"""Scan run API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class DiscoveryTierRead(BaseModel):
    """One discovery traversal tier exposed for diagnostics."""

    name: str
    description: str
    paths: list[str]


class DiscoveryPlanRead(BaseModel):
    """Resolved discovery strategy used for broad or configured scans."""

    mode: str
    ordered_roots: list[str]
    tiers: list[DiscoveryTierRead]
    excluded_path_categories: list[str]


class ScanRunRead(BaseModel):
    """Serialized representation of a scan run."""

    id: int
    status: str
    started_at: datetime
    finished_at: datetime | None
    roots_json: list[str]
    mode: str
    files_seen: int
    candidate_images_evaluated: int
    photos_indexed: int
    likely_photos_accepted: int
    likely_graphics_rejected: int
    unreadable_failed_count: int
    errors_count: int
    notes: str | None


class ScanRunCreateRequest(BaseModel):
    """Request payload for starting a scan run."""

    mode: Literal["full", "evaluation"] = "full"


class LatestScanRunResponse(BaseModel):
    """Response payload for the latest scan run endpoint."""

    scan_run: ScanRunRead | None


class ScanRunListResponse(BaseModel):
    """Paginated list of scan runs."""

    items: list[ScanRunRead]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)


class ResetIndexStateResponse(BaseModel):
    """Summary of what was cleared by a fresh-run reset."""

    photos_deleted: int
    variants_deleted: int
    scan_run_photos_deleted: int
    scan_errors_deleted: int
    scan_runs_deleted: int
    media_files_deleted: int


class DiscoveryPlanResponse(BaseModel):
    """Response payload for the discovery plan endpoint."""

    plan: DiscoveryPlanRead
