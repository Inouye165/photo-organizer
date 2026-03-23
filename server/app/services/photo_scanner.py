"""Filesystem scan service for indexing original images and creating variants."""

from __future__ import annotations

import mimetypes
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from pathlib import Path

from PIL import Image, UnidentifiedImageError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.photo import Photo
from app.models.scan_run import ScanRun
from app.services.media_variants import VariantService

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".tiff"}
EXIF_DATE_TAGS = (36867, 36868, 306)


@dataclass(frozen=True)
class PhotoFilters:
    """Date filter options for photo listing."""

    date_from: date | None = None
    date_to: date | None = None


def is_supported_file(file_path: Path) -> bool:
    """Return whether the file has a supported image extension."""
    return file_path.suffix.lower() in SUPPORTED_EXTENSIONS


def build_date_range(filters: PhotoFilters) -> tuple[datetime | None, datetime | None]:
    """Build inclusive UTC datetimes for date filtering."""
    start = (
        datetime.combine(filters.date_from, time.min, tzinfo=UTC)
        if filters.date_from is not None
        else None
    )
    end = (
        datetime.combine(filters.date_to, time.max, tzinfo=UTC)
        if filters.date_to is not None
        else None
    )
    return start, end


def extract_captured_at(image: Image.Image, fallback: datetime) -> datetime:
    """Extract the best available capture datetime from EXIF metadata."""
    exif = image.getexif()
    for tag in EXIF_DATE_TAGS:
        value = exif.get(tag)
        if not value:
            continue
        try:
            naive_value = datetime.strptime(str(value), "%Y:%m:%d %H:%M:%S")
            return naive_value.replace(tzinfo=UTC)
        except ValueError:
            continue
    return fallback


class PhotoScannerService:
    """Scan configured roots, upsert photos, and generate media variants."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.variant_service = VariantService(
            media_root=settings.resolved_media_root(),
            thumbnail_size=settings.thumbnail_size,
            display_max_edge=settings.display_max_edge,
        )

    def scan(self, session: Session) -> ScanRun:
        """Run a synchronous filesystem scan across the configured roots."""
        roots = self.settings.resolved_scan_roots()
        self.variant_service.media_root.mkdir(parents=True, exist_ok=True)

        scan_run = ScanRun(
            status="running",
            started_at=datetime.now(UTC),
            finished_at=None,
            roots_json=[root.as_posix() for root in roots],
            files_seen=0,
            photos_indexed=0,
            errors_count=0,
            notes=None,
        )
        session.add(scan_run)
        session.flush()

        error_notes: list[str] = []
        try:
            for root in roots:
                if not root.exists() or not root.is_dir():
                    scan_run.errors_count += 1
                    error_notes.append(f"Missing scan root: {root.as_posix()}")
                    continue
                for file_path in self._walk_root(root):
                    scan_run.files_seen += 1
                    if not is_supported_file(file_path):
                        continue
                    try:
                        with session.begin_nested():
                            self._index_file(session=session, file_path=file_path)
                        scan_run.photos_indexed += 1
                    except (OSError, UnidentifiedImageError, ValueError) as exc:
                        scan_run.errors_count += 1
                        error_notes.append(f"{file_path.name}: {exc}")

            scan_run.status = "completed_with_errors" if scan_run.errors_count else "completed"
        except Exception as exc:
            session.rollback()
            failed_run = ScanRun(
                status="failed",
                started_at=scan_run.started_at,
                finished_at=datetime.now(UTC),
                roots_json=scan_run.roots_json,
                files_seen=scan_run.files_seen,
                photos_indexed=scan_run.photos_indexed,
                errors_count=scan_run.errors_count + 1,
                notes=str(exc),
            )
            session.add(failed_run)
            session.commit()
            session.refresh(failed_run)
            return failed_run

        scan_run.finished_at = datetime.now(UTC)
        scan_run.notes = "\n".join(error_notes[:20]) if error_notes else None
        session.commit()
        session.refresh(scan_run)
        return scan_run

    def _walk_root(self, root: Path) -> list[Path]:
        """Safely traverse one configured root without following symlinked directories."""
        discovered: list[Path] = []
        for current_path, dir_names, file_names in os.walk(root, followlinks=False):
            current_dir = Path(current_path)
            dir_names[:] = [
                name for name in sorted(dir_names) if not (current_dir / name).is_symlink()
            ]
            for file_name in sorted(file_names):
                candidate = current_dir / file_name
                if candidate.is_symlink():
                    continue
                discovered.append(candidate)
        return discovered

    def _index_file(self, session: Session, file_path: Path) -> Photo:
        """Insert or update one supported image file in the database."""
        resolved_path = file_path.resolve(strict=True)
        stat_result = resolved_path.stat()
        modified_at = datetime.fromtimestamp(stat_result.st_mtime, tz=UTC)
        created_at = datetime.fromtimestamp(stat_result.st_ctime, tz=UTC)

        with Image.open(resolved_path) as image:
            width, height = image.size
            captured_at = extract_captured_at(image=image, fallback=modified_at)

        mime_type = mimetypes.guess_type(resolved_path.name)[0] or "application/octet-stream"
        photo = session.scalar(select(Photo).where(Photo.original_path == resolved_path.as_posix()))
        if photo is None:
            photo = Photo(original_path=resolved_path.as_posix())
            session.add(photo)

        photo.file_name = resolved_path.name
        photo.extension = resolved_path.suffix.lower()
        photo.mime_type = mime_type
        photo.file_size_bytes = stat_result.st_size
        photo.width = width
        photo.height = height
        photo.captured_at = captured_at
        photo.file_modified_at = modified_at
        photo.file_created_at = created_at
        photo.content_hash = None

        session.flush()
        self.variant_service.ensure_variants(
            session=session,
            photo=photo,
            source_path=resolved_path,
        )
        session.flush()
        return photo


def count_photos(session: Session, filters: PhotoFilters) -> int:
    """Count photos matching the provided filters."""
    query = select(func.count()).select_from(Photo)
    start, end = build_date_range(filters)
    if start is not None:
        query = query.where(Photo.captured_at >= start)
    if end is not None:
        query = query.where(Photo.captured_at <= end)
    return int(session.scalar(query) or 0)
