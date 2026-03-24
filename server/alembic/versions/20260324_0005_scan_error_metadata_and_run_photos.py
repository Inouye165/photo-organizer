"""Add scan error metadata and durable scan run photo associations."""

# pylint: disable=invalid-name

from __future__ import annotations

from importlib import import_module
from typing import Any

import sqlalchemy as sa

operations: Any = import_module("alembic.op")

revision = "20260324_0005"
down_revision = "20260323_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add diagnostic metadata and scan run photo associations."""
    operations.add_column(
        "scan_errors",
        sa.Column("diagnostic_metadata", sa.JSON(), nullable=True),
    )

    operations.create_table(
        "scan_run_photos",
        sa.Column("scan_run_id", sa.Integer(), nullable=False),
        sa.Column("photo_id", sa.Integer(), nullable=False),
        sa.Column(
            "indexed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scan_run_id"], ["scan_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("scan_run_id", "photo_id", name="pk_scan_run_photos"),
    )
    operations.create_index(
        "ix_scan_run_photos_photo_id",
        "scan_run_photos",
        ["photo_id"],
        unique=False,
    )
    operations.create_index(
        "ix_scan_run_photos_indexed_at",
        "scan_run_photos",
        ["indexed_at"],
        unique=False,
    )


def downgrade() -> None:
    """Remove diagnostic metadata and scan run photo associations."""
    operations.drop_index("ix_scan_run_photos_indexed_at", table_name="scan_run_photos")
    operations.drop_index("ix_scan_run_photos_photo_id", table_name="scan_run_photos")
    operations.drop_table("scan_run_photos")
    operations.drop_column("scan_errors", "diagnostic_metadata")
