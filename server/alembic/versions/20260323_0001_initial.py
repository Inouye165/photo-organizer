"""Initial schema for photos, variants, and scan runs."""

# pylint: disable=invalid-name

from __future__ import annotations

from importlib import import_module
from typing import Any

import sqlalchemy as sa

operations: Any = import_module("alembic.op")

revision = "20260323_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the initial application schema."""
    operations.create_table(
        "photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("original_path", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(length=512), nullable=False),
        sa.Column("extension", sa.String(length=32), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("file_modified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("file_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("content_hash", sa.String(length=128), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("original_path"),
    )
    operations.create_index("ix_photos_captured_at", "photos", ["captured_at"], unique=False)

    operations.create_table(
        "scan_runs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=64), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("roots_json", sa.JSON(), nullable=False),
        sa.Column("files_seen", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("photos_indexed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("errors_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    operations.create_table(
        "photo_variants",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("photo_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=64), nullable=False),
        sa.Column("relative_path", sa.String(length=1024), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("photo_id", "kind", name="uq_photo_variant_kind"),
    )


def downgrade() -> None:
    """Drop the initial application schema."""
    operations.drop_table("photo_variants")
    operations.drop_table("scan_runs")
    operations.drop_index("ix_photos_captured_at", table_name="photos")
    operations.drop_table("photos")
