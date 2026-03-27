"""Filesystem scan service for indexing originals and creating managed assets."""

from __future__ import annotations

import hashlib
import logging
import mimetypes
import os
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, date, datetime, time
from pathlib import Path
from typing import Any

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
from app.services.discovery_strategy import (
    build_discovery_plan,
    classify_directory_exclusion,
    classify_relative_path_exclusion,
    looks_like_project_workspace,
    sort_candidate_directories,
)
from app.services.media_variants import VariantService
from app.services.photo_classifier import PhotoClassification, classify_image

logger = logging.getLogger(__name__)

register_heif_opener()

CAMERA_IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
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
HASH_CHUNK_SIZE = 1024 * 1024
EVALUATION_TARGET_PHOTOS = 20
EVALUATION_MAX_CANDIDATE_IMAGES = 2000
EXCLUDED_GENERATED_FILE_NAMES = {"display_webp.webp", "thumbnail.webp"}
RECOVERABLE_SCAN_EXCEPTIONS = (
    OSError,
    RuntimeError,
    UnidentifiedImageError,
    ValueError,
)
MAX_DIAGNOSTIC_SAMPLE_PATHS = 5


@dataclass(frozen=True)
class PhotoFilters:
    """Date filter options for photo listing."""

    date_from: date | None = None
    date_to: date | None = None
    scan_run_id: int | None = None


@dataclass(frozen=True)
class ScanErrorDetails:
    """Captures the persisted fields for one scan error entry."""

    file_path: str
    file_name: str
    error_type: str
    reason: str
    diagnostic_metadata: dict[str, Any] | None = None


@dataclass
class ScanDiagnosticsTracker:
    """Mutable summary of scan outcomes and representative sample paths."""

    outcome_counts: dict[str, int]
    excluded_path_counts: dict[str, int]
    sample_paths: dict[str, list[str]]

    @classmethod
    def empty(cls) -> ScanDiagnosticsTracker:
        """Create an empty diagnostics tracker for a new scan run."""
        return cls(
            outcome_counts={
                "files_seen": 0,
                "excluded_path_skips": 0,
                "unsupported_files": 0,
                "candidate_images_evaluated": 0,
                "accepted_photos": 0,
                "rejected_likely_graphics": 0,
                "duplicate_files": 0,
                "unreadable_files": 0,
                "missing_roots": 0,
            },
            excluded_path_counts={},
            sample_paths={
                "accepted_photos": [],
                "duplicates": [],
                "excluded_paths": [],
                "rejected_graphics": [],
                "unreadable_files": [],
                "unsupported_files": [],
            },
        )

    def increment(self, key: str, amount: int = 1) -> None:
        """Increment one named outcome counter."""
        self.outcome_counts[key] = self.outcome_counts.get(key, 0) + amount

    def note_sample(self, bucket: str, path: Path) -> None:
        """Store a small representative sample of paths for one bucket."""
        samples = self.sample_paths.setdefault(bucket, [])
        normalized_path = path.as_posix()
        if normalized_path in samples or len(samples) >= MAX_DIAGNOSTIC_SAMPLE_PATHS:
            return
        samples.append(normalized_path)

    def note_excluded_path(self, category: str, path: Path) -> None:
        """Track one excluded path and its category for later review."""
        self.increment("excluded_path_skips")
        self.excluded_path_counts[category] = self.excluded_path_counts.get(category, 0) + 1
        self.note_sample("excluded_paths", path)

    def serialize(self) -> dict[str, Any]:
        """Convert the tracker into a JSON-serializable payload."""
        return {
            "outcome_counts": dict(sorted(self.outcome_counts.items())),
            "excluded_path_counts": dict(sorted(self.excluded_path_counts.items())),
            "sample_paths": self.sample_paths,
        }


def is_supported_file(file_path: Path) -> bool:
    """Return whether the file is a camera-native image worth evaluating."""
    suffix = file_path.suffix.lower()
    if suffix in VIDEO_EXTENSIONS or suffix not in CAMERA_IMAGE_EXTENSIONS:
        return False

    mime_type = mimetypes.guess_type(file_path.name)[0]
    if mime_type is None:
        return True

    if mime_type.startswith("video/"):
        return False
    return mime_type in {"image/jpeg", "image/heic", "image/heif"} or suffix in {
        ".heic",
        ".heif",
    }


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


class PhotoScannerService:
    """Scan configured roots, upsert photos, and generate media variants."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.variant_service = VariantService(
            media_root=settings.resolved_media_root(),
            thumbnail_size=settings.thumbnail_size,
            display_max_edge=settings.display_max_edge,
        )

    def scan(self, session: Session, *, mode: str = "full") -> ScanRun:
        """Run a synchronous filesystem scan across the configured roots."""
        discovery_plan = build_discovery_plan(self.settings.scan_roots)
        roots = list(discovery_plan.ordered_roots)
        diagnostics = ScanDiagnosticsTracker.empty()
        self.variant_service.media_root.mkdir(parents=True, exist_ok=True)

        scan_run = ScanRun(
            status="running",
            started_at=datetime.now(UTC),
            finished_at=None,
            roots_json=[root.as_posix() for root in roots],
            mode=mode,
            files_seen=0,
            candidate_images_evaluated=0,
            photos_indexed=0,
            likely_photos_accepted=0,
            likely_graphics_rejected=0,
            unreadable_failed_count=0,
            errors_count=0,
            diagnostics=diagnostics.serialize(),
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
                diagnostics=diagnostics,
                error_notes=error_notes,
            )
            self._finalize_scan_run(
                scan_run=scan_run,
                diagnostics=diagnostics,
                error_notes=error_notes,
            )
        except SQLAlchemyError as exc:
            logger.exception("Fatal database error during scan")
            session.rollback()
            failed_run = ScanRun(
                status="failed",
                started_at=scan_run.started_at,
                finished_at=datetime.now(UTC),
                roots_json=scan_run.roots_json,
                mode=scan_run.mode,
                files_seen=scan_run.files_seen,
                candidate_images_evaluated=scan_run.candidate_images_evaluated,
                photos_indexed=scan_run.photos_indexed,
                likely_photos_accepted=scan_run.likely_photos_accepted,
                likely_graphics_rejected=scan_run.likely_graphics_rejected,
                unreadable_failed_count=scan_run.unreadable_failed_count,
                errors_count=scan_run.errors_count + 1,
                diagnostics=diagnostics.serialize(),
                notes=str(exc),
            )
            session.add(failed_run)
            session.commit()
            session.refresh(failed_run)
            return failed_run

        scan_run.finished_at = datetime.now(UTC)
        scan_run.diagnostics = diagnostics.serialize()
        scan_run.notes = "\n".join(error_notes[:20]) if error_notes else None
        session.commit()
        session.refresh(scan_run)
        return scan_run

    def _scan_roots(
        self,
        session: Session,
        scan_run: ScanRun,
        roots: list[Path],
        diagnostics: ScanDiagnosticsTracker,
        error_notes: list[str],
    ) -> None:
        """Walk configured roots until the scan completes or reaches its cap."""
        for root in roots:
            if self._scan_stop_reached(scan_run):
                break
            if not root.exists() or not root.is_dir():
                self._record_missing_root(
                    session=session,
                    scan_run=scan_run,
                    root=root,
                    diagnostics=diagnostics,
                    error_notes=error_notes,
                )
                continue
            self._scan_root(
                session=session,
                scan_run=scan_run,
                root=root,
                diagnostics=diagnostics,
                error_notes=error_notes,
            )

    def _scan_root(
        self,
        session: Session,
        scan_run: ScanRun,
        root: Path,
        diagnostics: ScanDiagnosticsTracker,
        error_notes: list[str],
    ) -> None:
        """Scan one filesystem root for supported image files."""
        for file_path in self._walk_root(root, diagnostics=diagnostics):
            if self._scan_stop_reached(scan_run):
                break
            self._process_candidate(
                session=session,
                scan_run=scan_run,
                file_path=file_path,
                diagnostics=diagnostics,
                error_notes=error_notes,
            )

    def _process_candidate(
        self,
        session: Session,
        scan_run: ScanRun,
        file_path: Path,
        diagnostics: ScanDiagnosticsTracker,
        error_notes: list[str],
    ) -> None:
        """Attempt to index one discovered file and persist any scan errors."""
        scan_run.files_seen += 1
        diagnostics.increment("files_seen")
        if not is_supported_file(file_path):
            diagnostics.increment("unsupported_files")
            diagnostics.note_sample("unsupported_files", file_path)
            return
        scan_run.candidate_images_evaluated += 1
        diagnostics.increment("candidate_images_evaluated")

        try:
            with session.begin_nested():
                photo = self._index_file(
                    session=session,
                    file_path=file_path,
                    scan_run=scan_run,
                    diagnostics=diagnostics,
                )
                if photo is not None:
                    self._record_indexed_photo(
                        session=session,
                        scan_run=scan_run,
                        photo=photo,
                    )
                    scan_run.likely_photos_accepted += 1
                    scan_run.photos_indexed += 1
                    diagnostics.increment("accepted_photos")
                    diagnostics.note_sample("accepted_photos", file_path)
        except RECOVERABLE_SCAN_EXCEPTIONS as exc:
            self._record_scan_exception(
                session=session,
                scan_run=scan_run,
                file_path=file_path,
                diagnostics=diagnostics,
                error_notes=error_notes,
                exc=exc,
            )

    def iter_discovered_files(self, root: Path) -> Iterator[Path]:
        """Yield discovered files for one root using the scanner's traversal rules."""
        return self._walk_root(root, diagnostics=None)

    def _record_missing_root(
        self,
        session: Session,
        scan_run: ScanRun,
        root: Path,
        diagnostics: ScanDiagnosticsTracker,
        error_notes: list[str],
    ) -> None:
        """Persist a scan error when a configured root is missing."""
        scan_run.errors_count += 1
        diagnostics.increment("missing_roots")
        diagnostics.note_sample("unreadable_files", root)
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

    def _record_scan_exception(  # noqa: PLR0913
        self,
        session: Session,
        scan_run: ScanRun,
        file_path: Path,
        diagnostics: ScanDiagnosticsTracker,
        error_notes: list[str],
        exc: Exception,
    ) -> None:
        """Persist a scan error when reading or parsing a file fails."""
        scan_run.errors_count += 1
        scan_run.unreadable_failed_count += 1
        diagnostics.increment("unreadable_files")
        diagnostics.note_sample("unreadable_files", file_path)
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

    def _finalize_scan_run(
        self,
        scan_run: ScanRun,
        diagnostics: ScanDiagnosticsTracker,
        error_notes: list[str],
    ) -> None:
        """Apply final status and notes once scanning finishes."""
        scan_run.status = "completed_with_errors" if scan_run.errors_count else "completed"
        scan_run.diagnostics = diagnostics.serialize()
        stop_reason = self._stop_reason(scan_run)
        if stop_reason is not None:
            error_notes.append(stop_reason)

    def _scan_stop_reached(self, scan_run: ScanRun) -> bool:
        """Return whether the current scan mode has reached its stop condition."""
        if scan_run.mode == "evaluation":
            return (
                scan_run.likely_photos_accepted >= EVALUATION_TARGET_PHOTOS
                or scan_run.candidate_images_evaluated >= EVALUATION_MAX_CANDIDATE_IMAGES
            )

        max_photos = self.settings.scan_max_photos
        return max_photos > 0 and scan_run.photos_indexed >= max_photos

    def _stop_reason(self, scan_run: ScanRun) -> str | None:
        """Return a human-readable stop reason when the run ended due to a cap."""
        if scan_run.mode == "evaluation":
            if scan_run.likely_photos_accepted >= EVALUATION_TARGET_PHOTOS:
                return (
                    "Evaluation target reached after accepting "
                    f"{EVALUATION_TARGET_PHOTOS} likely photos."
                )
            if scan_run.candidate_images_evaluated >= EVALUATION_MAX_CANDIDATE_IMAGES:
                return (
                    "Evaluation candidate limit reached after checking "
                    f"{EVALUATION_MAX_CANDIDATE_IMAGES} candidate images."
                )
            return None

        max_photos = self.settings.scan_max_photos
        if max_photos > 0 and scan_run.photos_indexed >= max_photos:
            return f"Scan cap reached after indexing {max_photos} photos."
        return None

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

    def _walk_root(
        self,
        root: Path,
        *,
        diagnostics: ScanDiagnosticsTracker | None,
    ) -> Iterator[Path]:
        """Safely traverse one configured root without following symlinked directories."""
        root_is_project_workspace = self._looks_like_project_workspace(root)
        home_path = Path.home().expanduser().resolve()
        for current_path, dir_names, file_names in os.walk(root, followlinks=False):
            current_dir = Path(current_path)
            candidate_dirs = [
                current_dir / name
                for name in dir_names
                if self._should_descend_into(
                    root=root,
                    candidate_dir=current_dir / name,
                    diagnostics=diagnostics,
                    root_is_project_workspace=root_is_project_workspace,
                )
            ]
            dir_names[:] = [
                candidate.name
                for candidate in sort_candidate_directories(candidate_dirs, home_path=home_path)
            ]
            for file_name in sorted(file_names):
                candidate = current_dir / file_name
                if candidate.is_symlink():
                    continue
                if self._is_excluded_file(
                    root=root,
                    file_path=candidate,
                    diagnostics=diagnostics,
                    root_is_project_workspace=root_is_project_workspace,
                ):
                    continue
                yield candidate

    def _should_descend_into(
        self,
        *,
        root: Path,
        candidate_dir: Path,
        diagnostics: ScanDiagnosticsTracker | None,
        root_is_project_workspace: bool,
    ) -> bool:
        """Return whether the scanner should recurse into a discovered directory."""
        if candidate_dir.is_symlink():
            return False

        category = classify_directory_exclusion(
            candidate_dir,
            root=root,
            root_is_project_workspace=root_is_project_workspace,
        )
        if category is not None:
            if diagnostics is not None:
                diagnostics.note_excluded_path(category, candidate_dir)
            return False
        if self._is_within_managed_media_root(candidate_dir):
            if diagnostics is not None:
                diagnostics.note_excluded_path("managed generated media", candidate_dir)
            return False
        return True

    def _is_excluded_file(
        self,
        *,
        root: Path,
        file_path: Path,
        diagnostics: ScanDiagnosticsTracker | None,
        root_is_project_workspace: bool,
    ) -> bool:
        """Return whether a discovered file should be skipped before classification."""
        if self._is_within_managed_media_root(file_path):
            if diagnostics is not None:
                diagnostics.note_excluded_path("managed generated media", file_path)
            return True

        try:
            relative_parts = tuple(part.lower() for part in file_path.relative_to(root).parts)
        except ValueError:
            relative_parts = tuple(part.lower() for part in file_path.parts)

        if file_path.name.lower() in EXCLUDED_GENERATED_FILE_NAMES and any(
            part == "photos" for part in relative_parts
        ):
            if diagnostics is not None:
                diagnostics.note_excluded_path("managed generated media", file_path)
            return True

        category = classify_relative_path_exclusion(
            relative_parts,
            root_is_project_workspace=root_is_project_workspace,
        )
        if category is not None and diagnostics is not None:
            diagnostics.note_excluded_path(category, file_path)
        return category is not None

    def _is_within_managed_media_root(self, path: Path) -> bool:
        """Return whether a path points at or below the managed variant media root."""
        try:
            resolved_path = path.resolve(strict=False)
        except OSError:
            return False

        media_root = self.variant_service.media_root.resolve(strict=False)
        return resolved_path == media_root or resolved_path.is_relative_to(media_root)

    def _looks_like_project_workspace(self, path: Path) -> bool:
        """Return whether a directory looks like an application/project workspace."""
        return looks_like_project_workspace(path)

    def _index_file(
        self,
        session: Session,
        file_path: Path,
        scan_run: ScanRun,
        diagnostics: ScanDiagnosticsTracker,
    ) -> Photo | None:
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
            diagnostics.increment("duplicate_files")
            diagnostics.note_sample("duplicates", resolved_path)
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
            classification = classify_image(normalized_image, source_path=resolved_path)
            if classification.label != "likely_photo":
                scan_run.likely_graphics_rejected += 1
                scan_run.errors_count += 1
                diagnostics.increment("rejected_likely_graphics")
                diagnostics.note_sample("rejected_graphics", resolved_path)
                _record_error(
                    session=session,
                    scan_run=scan_run,
                    error=ScanErrorDetails(
                        file_path=resolved_path.as_posix(),
                        file_name=resolved_path.name,
                        error_type="likely_graphic",
                        reason=classification.reasons[0],
                        diagnostic_metadata=self._build_file_diagnostics(
                            file_path=resolved_path,
                            processing_stage="photo_validation",
                            extra={
                                "width": normalized_image.width,
                                "height": normalized_image.height,
                                "content_hash": content_hash,
                                "classification": _serialize_classification(classification),
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

        prior_content_hash = photo.content_hash
        prior_extension = photo.extension

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
        photo.classification_label = classification.label
        photo.classification_details = _serialize_classification(classification)

        session.flush()
        managed_original = self.variant_service.ensure_managed_original(
            photo=photo,
            source_path=resolved_path,
            force_refresh=(
                prior_content_hash != content_hash
                or prior_extension != photo.extension
                or photo.managed_original_relative_path is None
            ),
        )
        self.variant_service.ensure_variants(
            session=session,
            photo=photo,
            source_path=managed_original.absolute_path,
            force_refresh=managed_original.copied,
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


def _serialize_classification(classification: PhotoClassification) -> dict[str, Any]:
    """Convert a classifier result into a compact JSON-serializable payload."""
    return {
        "label": classification.label,
        "score": classification.score,
        "reasons": classification.reasons,
        **classification.diagnostics,
    }
