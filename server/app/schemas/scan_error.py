"""Scan error API schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ScanErrorRead(BaseModel):
    """Serialized representation of a single scan error."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    scan_run_id: int
    file_path: str
    file_name: str
    error_type: str
    reason: str
    diagnostic_metadata: dict[str, Any] | None
    created_at: datetime


class ScanErrorListResponse(BaseModel):
    """Paginated list of scan errors."""

    items: list[ScanErrorRead]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)
