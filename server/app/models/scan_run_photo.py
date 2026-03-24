"""Association ORM model for photos successfully indexed during a scan run."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, PrimaryKeyConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScanRunPhoto(Base):
    """Represents one photo successfully indexed during one scan run."""

    __tablename__ = "scan_run_photos"
    __table_args__ = (
        PrimaryKeyConstraint("scan_run_id", "photo_id", name="pk_scan_run_photos"),
    )

    scan_run_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("scan_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    photo_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
    )
    indexed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )
