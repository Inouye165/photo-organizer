"""Photo ORM model."""

from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, BigInteger, DateTime, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.photo_variant import PhotoVariant


class Photo(Base):
    """Represents an indexed original image file."""

    __tablename__ = "photos"
    __table_args__ = (Index("ux_photos_content_hash", "content_hash", unique=True),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    original_path: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    file_name: Mapped[str] = mapped_column(String(512), nullable=False)
    extension: Mapped[str] = mapped_column(String(32), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    file_modified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    file_created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    content_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    classification_label: Mapped[str] = mapped_column(
        String(32),
        default="likely_photo",
        nullable=False,
    )
    classification_details: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        onupdate=text("CURRENT_TIMESTAMP"),
    )

    variants: Mapped[list[PhotoVariant]] = relationship(
        back_populates="photo",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
