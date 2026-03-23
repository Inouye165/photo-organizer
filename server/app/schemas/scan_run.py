"""Scan run API schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ScanRunRead(BaseModel):
    """Serialized representation of a scan run."""

    id: int
    status: str
    started_at: datetime
    finished_at: datetime | None
    roots_json: list[str]
    files_seen: int
    photos_indexed: int
    errors_count: int
    notes: str | None


class LatestScanRunResponse(BaseModel):
    """Response payload for the latest scan run endpoint."""

    scan_run: ScanRunRead | None
