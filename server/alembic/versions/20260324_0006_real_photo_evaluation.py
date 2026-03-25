"""Add real-photo classification and evaluation run counters."""

# pylint: disable=invalid-name

from __future__ import annotations

from importlib import import_module
from typing import Any

import sqlalchemy as sa

operations: Any = import_module("alembic.op")

revision = "20260324_0006"
down_revision = "20260324_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Persist run-mode summaries and accepted-photo classification details."""
    operations.add_column(
        "photos",
        sa.Column(
            "classification_label",
            sa.String(length=32),
            nullable=False,
            server_default="likely_photo",
        ),
    )
    operations.add_column(
        "photos",
        sa.Column("classification_details", sa.JSON(), nullable=True),
    )

    operations.add_column(
        "scan_runs",
        sa.Column("mode", sa.String(length=32), nullable=False, server_default="full"),
    )
    operations.add_column(
        "scan_runs",
        sa.Column("candidate_images_evaluated", sa.Integer(), nullable=False, server_default="0"),
    )
    operations.add_column(
        "scan_runs",
        sa.Column("likely_photos_accepted", sa.Integer(), nullable=False, server_default="0"),
    )
    operations.add_column(
        "scan_runs",
        sa.Column("likely_graphics_rejected", sa.Integer(), nullable=False, server_default="0"),
    )
    operations.add_column(
        "scan_runs",
        sa.Column("unreadable_failed_count", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    """Remove real-photo classification and evaluation run counters."""
    operations.drop_column("scan_runs", "unreadable_failed_count")
    operations.drop_column("scan_runs", "likely_graphics_rejected")
    operations.drop_column("scan_runs", "likely_photos_accepted")
    operations.drop_column("scan_runs", "candidate_images_evaluated")
    operations.drop_column("scan_runs", "mode")
    operations.drop_column("photos", "classification_details")
    operations.drop_column("photos", "classification_label")