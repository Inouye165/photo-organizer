"""Scan run ORM model."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScanRun(Base):
    """Represents one attempt to scan configured roots."""

    __tablename__ = "scan_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(64), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    roots_json: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    mode: Mapped[str] = mapped_column(String(32), default="full", nullable=False)
    files_seen: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    candidate_images_evaluated: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    photos_indexed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    likely_photos_accepted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    likely_graphics_rejected: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unreadable_failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    errors_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
