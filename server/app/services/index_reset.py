"""Reset app-managed indexed state without touching original source files."""

from __future__ import annotations

import shutil
from dataclasses import dataclass

from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.functions import count

from app.core.config import Settings
from app.models.photo import Photo
from app.models.photo_variant import PhotoVariant
from app.models.scan_error import ScanError
from app.models.scan_run import ScanRun
from app.models.scan_run_photo import ScanRunPhoto


@dataclass(frozen=True)
class ResetIndexStateSummary:
    """Counts describing the app-managed data removed during a reset."""

    photos_deleted: int
    variants_deleted: int
    scan_run_photos_deleted: int
    scan_errors_deleted: int
    scan_runs_deleted: int
    media_files_deleted: int


def reset_indexed_state(session: Session, settings: Settings) -> ResetIndexStateSummary:
    """Delete app-managed indexing records and generated browser media only."""
    summary = ResetIndexStateSummary(
        photos_deleted=session.scalar(select(count(Photo.id))) or 0,
        variants_deleted=session.scalar(select(count(PhotoVariant.id))) or 0,
        scan_run_photos_deleted=session.scalar(select(count()).select_from(ScanRunPhoto)) or 0,
        scan_errors_deleted=session.scalar(select(count(ScanError.id))) or 0,
        scan_runs_deleted=session.scalar(select(count(ScanRun.id))) or 0,
        media_files_deleted=_count_media_files(settings.resolved_media_root()),
    )

    session.execute(delete(ScanRunPhoto))
    session.execute(delete(PhotoVariant))
    session.execute(delete(ScanError))
    session.execute(delete(Photo))
    session.execute(delete(ScanRun))
    session.commit()

    _clear_media_root(settings.resolved_media_root())
    return summary


def _count_media_files(media_root) -> int:
    if not media_root.exists():
        return 0
    return sum(1 for path in media_root.rglob("*") if path.is_file())


def _clear_media_root(media_root) -> None:
    media_root.mkdir(parents=True, exist_ok=True)
    for child in media_root.iterdir():
        if child.is_dir():
            shutil.rmtree(child)
        else:
            child.unlink()