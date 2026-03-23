"""Photo listing and detail endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db_session
from app.models.photo import Photo
from app.schemas.photo import (
    PhotoDetail,
    PhotoListItem,
    PhotoListQuery,
    PhotoListResponse,
    PhotoVariantRead,
)
from app.services.photo_scanner import PhotoFilters, build_date_range, count_photos

router = APIRouter()


def build_variant_url(relative_path: str) -> str:
    """Build a public URL for a generated variant."""
    return f"/media/{relative_path}"


def serialize_photo(photo: Photo) -> PhotoListItem:
    """Serialize a photo into its gallery representation."""
    variants = {variant.kind: variant for variant in photo.variants}
    thumbnail = variants.get("thumbnail")
    display = variants.get("display_webp")
    return PhotoListItem(
        id=photo.id,
        file_name=photo.file_name,
        extension=photo.extension,
        mime_type=photo.mime_type,
        file_size_bytes=photo.file_size_bytes,
        width=photo.width,
        height=photo.height,
        captured_at=photo.captured_at,
        file_modified_at=photo.file_modified_at,
        created_at=photo.created_at,
        thumbnail_url=build_variant_url(thumbnail.relative_path) if thumbnail else None,
        display_url=build_variant_url(display.relative_path) if display else None,
    )


def serialize_photo_detail(photo: Photo) -> PhotoDetail:
    """Serialize a photo into its detail representation."""
    base = serialize_photo(photo)
    variants = [
        PhotoVariantRead(
            id=variant.id,
            kind=variant.kind,
            relative_path=variant.relative_path,
            width=variant.width,
            height=variant.height,
            mime_type=variant.mime_type,
            file_size_bytes=variant.file_size_bytes,
            created_at=variant.created_at,
            url=build_variant_url(variant.relative_path),
        )
        for variant in sorted(photo.variants, key=lambda item: item.kind)
    ]
    return PhotoDetail(
        **base.model_dump(),
        original_path=photo.original_path,
        file_created_at=photo.file_created_at,
        content_hash=photo.content_hash,
        updated_at=photo.updated_at,
        variants=variants,
    )


@router.get("", response_model=PhotoListResponse)
def list_photos(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=200),
    date_from: str | None = Query(default=None),
    date_to: str | None = Query(default=None),
    session: Session = Depends(get_db_session),
) -> PhotoListResponse:
    """Return a paginated gallery response filtered by capture date."""
    query_params = PhotoListQuery.model_validate(
        {"page": page, "page_size": page_size, "date_from": date_from, "date_to": date_to}
    )
    filters = PhotoFilters(date_from=query_params.date_from, date_to=query_params.date_to)
    query = select(Photo).options(selectinload(Photo.variants))
    start, end = build_date_range(filters)
    if start is not None:
        query = query.where(Photo.captured_at >= start)
    if end is not None:
        query = query.where(Photo.captured_at <= end)
    query = query.order_by(desc(Photo.captured_at), desc(Photo.id))
    query = query.offset((query_params.page - 1) * query_params.page_size)
    query = query.limit(query_params.page_size)
    photos = session.scalars(query).all()
    return PhotoListResponse(
        items=[serialize_photo(photo) for photo in photos],
        total=count_photos(session=session, filters=filters),
        page=query_params.page,
        page_size=query_params.page_size,
    )


@router.get("/{photo_id}", response_model=PhotoDetail)
def get_photo(photo_id: int, session: Session = Depends(get_db_session)) -> PhotoDetail:
    """Return one indexed photo with all generated variants."""
    photo = session.scalar(
        select(Photo).options(selectinload(Photo.variants)).where(Photo.id == photo_id)
    )
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    return serialize_photo_detail(photo)
