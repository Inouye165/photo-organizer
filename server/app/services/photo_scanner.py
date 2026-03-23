"""Filesystem scan service for indexing original images and creating variants."""

from __future__ import annotations

import hashlib
import logging
import mimetypes
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from pillow_heif import register_heif_opener
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models.photo import Photo
from app.models.scan_error import ScanError
from app.models.scan_run import ScanRun
from app.services.media_variants import VariantService

logger = logging.getLogger(__name__)

register_heif_opener()

SUPPORTED_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".bmp",
    ".tiff",
    ".heic",
    ".heif",
}
VIDEO_EXTENSIONS = {
    ".3gp",
    ".avi",
    ".m4v",
    ".mkv",
    ".mov",
    ".mp4",
    ".mpeg",
    ".mpg",
    ".mts",
    ".m2ts",
    ".qt",
    ".webm",
    ".wmv",
}
EXIF_DATE_TAGS = (36867, 36868, 306)
PHOTOGRAPHIC_EXIF_TAGS = (271, 272, 33437, 34855, 37386, 42035, 42036)
HASH_CHUNK_SIZE = 1024 * 1024
MIN_PHOTO_EDGE = 160
MAX_ANALYSIS_PIXELS = 60_000
MIN_COLOR_VARIANCE = 900.0
MIN_UNIQUE_COLOR_RATIO = 0.12


@dataclass(frozen=True)
class PhotoFilters:
    """Date filter options for photo listing."""

    date_from: date | None = None
    date_to: date | None = None


@dataclass(frozen=True)
class RejectionResult:
    """Explains why an image was rejected by validation."""

    error_type: str
    reason: str


def is_supported_file(file_path: Path) -> bool:
    """Return whether the file has a supported image extension."""
    suffix = file_path.suffix.lower()
    if suffix in VIDEO_EXTENSIONS or suffix not in SUPPORTED_EXTENSIONS:
        return False

    mime_type = mimetypes.guess_type(file_path.name)[0]
    if mime_type is None:
        return True

    if mime_type.startswith("video/"):
        return False
    return mime_type.startswith("image/") or suffix in {".heic", ".heif"}


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


def calculate_file_hash(file_path: Path) -> str:
    """Calculate a stable SHA-256 hash for one file without loading it into memory."""
    digest = hashlib.sha256()
    with file_path.open("rb") as source_file:
        for chunk in iter(lambda: source_file.read(HASH_CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def has_photographic_exif(image: Image.Image) -> bool:
    """Return whether the image contains common photographic camera metadata."""
    exif = image.getexif()
    return any(exif.get(tag) for tag in PHOTOGRAPHIC_EXIF_TAGS)


def validate_photo(image: Image.Image) -> RejectionResult | None:
    """Validate the image is a real photograph.

    Returns None if accepted, or a RejectionResult explaining the rejection.
    """
    if getattr(image, "is_animated", False) or getattr(image, "n_frames", 1) > 1:
        return RejectionResult("rejected", "Animated image or multi-frame file")

    normalized_image = ImageOps.exif_transpose(image)
    width, height = normalized_image.size
    if min(width, height) < MIN_PHOTO_EDGE:
        return RejectionResult(
            "rejected",
            f"Too small ({width}x{height}px, minimum edge is {MIN_PHOTO_EDGE}px)",
        )

    if has_photographic_exif(normalized_image):
        return None

    analysis_image = normalized_image.convert("RGB")
    pixel_array = np.asarray(analysis_image, dtype=np.uint8)
    if pixel_array.ndim != 3:
        return RejectionResult("rejected", "Non-RGB image data")

    flat_pixels = pixel_array.reshape(-1, 3)
    if flat_pixels.size == 0:
        return RejectionResult("rejected", "Empty image data")

    if flat_pixels.shape[0] > MAX_ANALYSIS_PIXELS:
        step = max(1, flat_pixels.shape[0] // MAX_ANALYSIS_PIXELS)
        flat_pixels = flat_pixels[::step]

    unique_colors = np.unique(flat_pixels, axis=0).shape[0]
    unique_color_ratio = unique_colors / flat_pixels.shape[0]
    channel_variance = float(
        np.mean(np.var(flat_pixels.astype(np.float32), axis=0))
    )

    if channel_variance < MIN_COLOR_VARIANCE:
        return RejectionResult(
            "rejected",
            f"Low color variance ({channel_variance:.0f}), "
            "likely a screenshot or graphic",
        )
    if unique_color_ratio < MIN_UNIQUE_COLOR_RATIO:
        return RejectionResult(
            "rejected",
            f"Low unique color ratio ({unique_color_ratio:.1%}), "
            "likely a logo or clipart",
        )
    return None


def looks_like_static_photo(image: Image.Image) -> bool:
    """Reject screenshots, clipart, logos, and animated images."""
    return validate_photo(image) is None


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
        max_photos = self.settings.scan_max_photos
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
                if max_photos > 0 and scan_run.photos_indexed >= max_photos:
                    break
                if not root.exists() or not root.is_dir():
                    scan_run.errors_count += 1
                    msg = f"Missing scan root: {root.as_posix()}"
                    error_notes.append(msg)
                    _record_error(
                        session, scan_run, root.as_posix(), root.name,
                        "missing_root", msg,
                    )
                    continue
                for file_path in self._walk_root(root):
                    if max_photos > 0 and scan_run.photos_indexed >= max_photos:
                        break
                    scan_run.files_seen += 1
                    if not is_supported_file(file_path):
                        continue
                    try:
                        with session.begin_nested():
                            photo = self._index_file(
                                session=session,
                                file_path=file_path,
                                scan_run=scan_run,
                            )
                        if photo is not None:
                            scan_run.photos_indexed += 1
                    except (OSError, UnidentifiedImageError, ValueError) as exc:
                        scan_run.errors_count += 1
                        msg = f"{file_path.name}: {exc}"
                        error_notes.append(msg)
                        logger.warning("Scan error for %s: %s", file_path, exc)
                        if isinstance(exc, UnidentifiedImageError):
                            error_type = "corrupt"
                        elif isinstance(exc, OSError):
                            error_type = "permission"
                        else:
                            error_type = "corrupt"
                        _record_error(
                            session, scan_run,
                            file_path.as_posix(), file_path.name,
                            error_type, str(exc),
                        )

            scan_run.status = (
                "completed_with_errors" if scan_run.errors_count else "completed"
            )
            if max_photos > 0 and scan_run.photos_indexed >= max_photos:
                limit_note = (
                    f"Scan cap reached after indexing {max_photos} photos."
                )
                error_notes.append(limit_note)
        except SQLAlchemyError as exc:
            logger.exception("Fatal database error during scan")
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

    def _index_file(self, session: Session, file_path: Path, scan_run: ScanRun) -> Photo | None:
        """Insert or update one supported image file in the database."""
        resolved_path = file_path.resolve(strict=True)
        stat_result = resolved_path.stat()
        modified_at = datetime.fromtimestamp(stat_result.st_mtime, tz=UTC)
        created_at = datetime.fromtimestamp(stat_result.st_ctime, tz=UTC)
        content_hash = calculate_file_hash(resolved_path)
        existing_photo = session.scalar(
            select(Photo).where(Photo.original_path == resolved_path.as_posix())
        )
        duplicate_photo = session.scalar(select(Photo).where(Photo.content_hash == content_hash))

        if duplicate_photo is not None and (
            existing_photo is None or duplicate_photo.id != existing_photo.id
        ):
            _record_error(
                session, scan_run,
                resolved_path.as_posix(), resolved_path.name,
                "duplicate",
                f"Duplicate content (matches {duplicate_photo.file_name})",
            )
            return None

        with Image.open(resolved_path) as image:
            normalized_image = ImageOps.exif_transpose(image)
            rejection = validate_photo(normalized_image)
            if rejection is not None:
                scan_run.errors_count += 1
                _record_error(
                    session, scan_run,
                    resolved_path.as_posix(), resolved_path.name,
                    rejection.error_type, rejection.reason,
                )
                return None
            width, height = normalized_image.size
            captured_at = extract_captured_at(image=normalized_image, fallback=modified_at)

        mime_type = mimetypes.guess_type(resolved_path.name)[0] or "application/octet-stream"
        photo = existing_photo
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
        photo.content_hash = content_hash

        session.flush()
        self.variant_service.ensure_variants(
            session=session,
            photo=photo,
            source_path=resolved_path,
        )
        session.flush()
        return photo


def _record_error(
    session: Session,
    scan_run: ScanRun,
    file_path: str,
    file_name: str,
    error_type: str,
    reason: str,
) -> None:
    """Persist a scan error record for later review."""
    session.add(
        ScanError(
            scan_run_id=scan_run.id,
            file_path=file_path,
            file_name=file_name,
            error_type=error_type,
            reason=reason,
        )
    )
    session.flush()


def count_photos(session: Session, filters: PhotoFilters) -> int:
    """Count photos matching the provided filters."""
    query = select(Photo.id)
    start, end = build_date_range(filters)
    if start is not None:
        query = query.where(Photo.captured_at >= start)
    if end is not None:
        query = query.where(Photo.captured_at <= end)
    return len(session.scalars(query).all())
