"""Photo API schemas."""

from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class PhotoVariantRead(BaseModel):
    """Serialized representation of a generated photo variant."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: str
    relative_path: str
    width: int
    height: int
    mime_type: str
    file_size_bytes: int
    created_at: datetime
    url: str


class PhotoListItem(BaseModel):
    """Serialized representation of a photo in the gallery."""

    id: int
    file_name: str
    extension: str
    mime_type: str
    file_size_bytes: int
    width: int
    height: int
    captured_at: datetime | None
    file_modified_at: datetime
    created_at: datetime
    thumbnail_url: str | None = None
    display_url: str | None = None


class PhotoDetail(PhotoListItem):
    """Detailed representation of a single photo."""

    original_path: str
    file_created_at: datetime | None
    content_hash: str | None
    updated_at: datetime
    variants: list[PhotoVariantRead]


class PhotoListResponse(BaseModel):
    """Paginated photo list response."""

    items: list[PhotoListItem]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=200)


class PhotoListQuery(BaseModel):
    """Validated query parameters for listing photos."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=24, ge=1, le=200)
    date_from: date | None = None
    date_to: date | None = None
    scan_run_id: int | None = Field(default=None, ge=1)
