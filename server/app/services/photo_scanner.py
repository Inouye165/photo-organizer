"""Filesystem scan service for indexing original images and creating variants."""

from __future__ import annotations

import hashlib
import logging
import mimetypes
import os
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from pathlib import Path
from typing import Any

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
from app.models.scan_run_photo import ScanRunPhoto
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
RGB_CHANNEL_COUNT = 3
RECOVERABLE_SCAN_EXCEPTIONS = (
    OSError,
    RuntimeError,
    UnidentifiedImageError,
    ValueError,
)


@dataclass(frozen=True)
class PhotoFilters:
    """Date filter options for photo listing."""

    date_from: date | None = None
    date_to: date | None = None
    scan_run_id: int | None = None


@dataclass(frozen=True)
class RejectionResult:
    """Explains why an image was rejected by validation."""

    error_type: str
    reason: str


@dataclass(frozen=True)
class ScanErrorDetails:
    """Captures the persisted fields for one scan error entry."""

    file_path: str
    file_name: str
    error_type: str
    reason: str
    diagnostic_metadata: dict[str, Any] | None = None


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


def apply_photo_filters(query: Any, filters: PhotoFilters) -> Any:
    """Apply photo list filters to a SQLAlchemy select query."""
    if filters.scan_run_id is not None:
        query = query.join(ScanRunPhoto, ScanRunPhoto.photo_id == Photo.id).where(
            ScanRunPhoto.scan_run_id == filters.scan_run_id
        )

    start, end = build_date_range(filters)
    if start is not None:
        query = query.where(Photo.captured_at >= start)
    if end is not None:
        query = query.where(Photo.captured_at <= end)
    return query


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
    size_rejection = _validate_dimensions(width=width, height=height)
    if size_rejection is not None:
        return size_rejection

    if has_photographic_exif(normalized_image):
        return None

    return _validate_pixel_distribution(normalized_image)


def _validate_dimensions(width: int, height: int) -> RejectionResult | None:
    """Reject images smaller than the minimum supported photo edge."""
    if min(width, height) < MIN_PHOTO_EDGE:
        return RejectionResult(
            "rejected",
            f"Too small ({width}x{height}px, minimum edge is {MIN_PHOTO_EDGE}px)",
        )
    return None


def _validate_pixel_distribution(image: Image.Image) -> RejectionResult | None:
    """Reject non-photographic images based on pixel distribution heuristics."""
    analysis_image = image.convert("RGB")
    pixel_array = np.asarray(analysis_image, dtype=np.uint8)
    if pixel_array.ndim != RGB_CHANNEL_COUNT:
        return RejectionResult("rejected", "Non-RGB image data")

    flat_pixels = pixel_array.reshape(-1, RGB_CHANNEL_COUNT)
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
            self._scan_roots(
                session=session,
                scan_run=scan_run,
                roots=roots,
                error_notes=error_notes,
            )
            self._finalize_scan_run(scan_run=scan_run, error_notes=error_notes)
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

    def _scan_roots(
        self,
        session: Session,
        scan_run: ScanRun,
        roots: list[Path],
        error_notes: list[str],
    ) -> None:
        """Walk configured roots until the scan completes or reaches its cap."""
        for root in roots:
            if self._scan_cap_reached(scan_run):
                break
            if not root.exists() or not root.is_dir():
                self._record_missing_root(
                    session=session,
                    scan_run=scan_run,
                    root=root,
                    error_notes=error_notes,
                )
                continue
            self._scan_root(
                session=session,
                scan_run=scan_run,
                root=root,
                error_notes=error_notes,
            )

    def _scan_root(
        self,
        session: Session,
        scan_run: ScanRun,
        root: Path,
        error_notes: list[str],
    ) -> None:
        """Scan one filesystem root for supported image files."""
        for file_path in self._walk_root(root):
            if self._scan_cap_reached(scan_run):
                break
            self._process_candidate(
                session=session,
                scan_run=scan_run,
                file_path=file_path,
                error_notes=error_notes,
            )

    def _process_candidate(
        self,
        session: Session,
        scan_run: ScanRun,
        file_path: Path,
        error_notes: list[str],
    ) -> None:
        """Attempt to index one discovered file and persist any scan errors."""
        scan_run.files_seen += 1
        if not is_supported_file(file_path):
            return

        try:
            with session.begin_nested():
                photo = self._index_file(
                    session=session,
                    file_path=file_path,
                    scan_run=scan_run,
                )
                if photo is not None:
                    self._record_indexed_photo(
                        session=session,
                        scan_run=scan_run,
                        photo=photo,
                    )
                    scan_run.photos_indexed += 1
        except RECOVERABLE_SCAN_EXCEPTIONS as exc:
            self._record_scan_exception(
                session=session,
                scan_run=scan_run,
                file_path=file_path,
                error_notes=error_notes,
                exc=exc,
            )

    def _record_missing_root(
        self,
        session: Session,
        scan_run: ScanRun,
        root: Path,
        error_notes: list[str],
    ) -> None:
        """Persist a scan error when a configured root is missing."""
        scan_run.errors_count += 1
        reason = f"Missing scan root: {root.as_posix()}"
        error_notes.append(reason)
        _record_error(
            session=session,
            scan_run=scan_run,
            error=ScanErrorDetails(
                file_path=root.as_posix(),
                file_name=root.name,
                error_type="missing_root",
                reason=reason,
                diagnostic_metadata={
                    "processing_stage": "scan_root_validation",
                    "path_exists": False,
                },
            ),
        )

    def _record_scan_exception(
        self,
        session: Session,
        scan_run: ScanRun,
        file_path: Path,
        error_notes: list[str],
        exc: Exception,
    ) -> None:
        """Persist a scan error when reading or parsing a file fails."""
        scan_run.errors_count += 1
        error_notes.append(f"{file_path.name}: {exc}")
        logger.warning("Scan error for %s: %s", file_path, exc)
        _record_error(
            session=session,
            scan_run=scan_run,
            error=ScanErrorDetails(
                file_path=file_path.as_posix(),
                file_name=file_path.name,
                error_type=self._classify_scan_exception(exc),
                reason=str(exc),
                diagnostic_metadata=self._build_file_diagnostics(
                    file_path=file_path,
                    processing_stage="file_processing",
                    exception=exc,
                ),
            ),
        )

    def _record_indexed_photo(
        self,
        session: Session,
        scan_run: ScanRun,
        photo: Photo,
    ) -> None:
        """Persist the successful scan-run-to-photo association once per run."""
        existing_link = session.get(
            ScanRunPhoto,
            {"scan_run_id": scan_run.id, "photo_id": photo.id},
        )
        if existing_link is None:
            session.add(ScanRunPhoto(scan_run_id=scan_run.id, photo_id=photo.id))
            session.flush()

    def _finalize_scan_run(self, scan_run: ScanRun, error_notes: list[str]) -> None:
        """Apply final status and notes once scanning finishes."""
        scan_run.status = "completed_with_errors" if scan_run.errors_count else "completed"
        if self._scan_cap_reached(scan_run):
            error_notes.append(
                f"Scan cap reached after indexing {self.settings.scan_max_photos} photos."
            )

    def _scan_cap_reached(self, scan_run: ScanRun) -> bool:
        """Return whether the configured scan cap has been reached."""
        max_photos = self.settings.scan_max_photos
        return max_photos > 0 and scan_run.photos_indexed >= max_photos

    def _classify_scan_exception(
        self,
        exc: Exception,
    ) -> str:
        """Map low-level image processing exceptions to persisted error types."""
        if isinstance(exc, UnidentifiedImageError):
            return "corrupt"
        if isinstance(exc, PermissionError):
            return "permission"
        if isinstance(exc, OSError) and not isinstance(exc, UnidentifiedImageError):
            return "file_io"
        if isinstance(exc, ValueError):
            return "invalid_metadata"
        return "processing_error"

    def _build_file_diagnostics(
        self,
        file_path: Path,
        processing_stage: str,
        *,
        exception: Exception | None = None,
        extra: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Collect structured diagnostics that are safe to persist as JSON."""
        diagnostics: dict[str, Any] = {
            "processing_stage": processing_stage,
            "extension": file_path.suffix.lower() or None,
            "mime_type_guess": mimetypes.guess_type(file_path.name)[0],
            "path_exists": file_path.exists(),
        }
        try:
            stat_result = file_path.stat()
        except OSError as stat_error:
            diagnostics["stat_error"] = str(stat_error)
        else:
            diagnostics["file_size_bytes"] = stat_result.st_size
            diagnostics["file_modified_at"] = datetime.fromtimestamp(
                stat_result.st_mtime,
                tz=UTC,
            ).isoformat()

        if exception is not None:
            diagnostics["exception_class"] = type(exception).__name__
        if extra:
            diagnostics.update(extra)
        return diagnostics

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
            scan_run.errors_count += 1
            _record_error(
                session=session,
                scan_run=scan_run,
                error=ScanErrorDetails(
                    file_path=resolved_path.as_posix(),
                    file_name=resolved_path.name,
                    error_type="duplicate",
                    reason=f"Duplicate content (matches {duplicate_photo.file_name})",
                    diagnostic_metadata=self._build_file_diagnostics(
                        file_path=resolved_path,
                        processing_stage="duplicate_check",
                        extra={
                            "content_hash": content_hash,
                            "duplicate_photo_id": duplicate_photo.id,
                            "duplicate_file_name": duplicate_photo.file_name,
                        },
                    ),
                ),
            )
            return None

        with Image.open(resolved_path) as image:
            normalized_image = ImageOps.exif_transpose(image)
            rejection = validate_photo(normalized_image)
            if rejection is not None:
                scan_run.errors_count += 1
                _record_error(
                    session=session,
                    scan_run=scan_run,
                    error=ScanErrorDetails(
                        file_path=resolved_path.as_posix(),
                        file_name=resolved_path.name,
                        error_type=rejection.error_type,
                        reason=rejection.reason,
                        diagnostic_metadata=self._build_file_diagnostics(
                            file_path=resolved_path,
                            processing_stage="photo_validation",
                            extra={
                                "width": normalized_image.width,
                                "height": normalized_image.height,
                                "content_hash": content_hash,
                            },
                        ),
                    ),
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
    error: ScanErrorDetails,
) -> None:
    """Persist a scan error record for later review."""
    session.add(
        ScanError(
            scan_run_id=scan_run.id,
            file_path=error.file_path,
            file_name=error.file_name,
            error_type=error.error_type,
            reason=error.reason,
            diagnostic_metadata=error.diagnostic_metadata,
        )
    )
    session.flush()


def count_photos(session: Session, filters: PhotoFilters) -> int:
    """Count photos matching the provided filters."""
    query = apply_photo_filters(select(Photo.id).distinct(), filters)
    return len(session.scalars(query).all())
