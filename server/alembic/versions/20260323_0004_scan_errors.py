"""Add scan_errors table for tracking rejected and failed files."""

# pylint: disable=invalid-name

from __future__ import annotations

from importlib import import_module
from typing import Any

import sqlalchemy as sa

operations: Any = import_module("alembic.op")

revision = "20260323_0004"
down_revision = "20260323_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create the scan_errors table."""
    operations.create_table(
        "scan_errors",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scan_run_id", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_name", sa.String(length=512), nullable=False),
        sa.Column("error_type", sa.String(length=64), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["scan_run_id"],
            ["scan_runs.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    operations.create_index(
        "ix_scan_errors_scan_run_id",
        "scan_errors",
        ["scan_run_id"],
        unique=False,
    )


def downgrade() -> None:
    """Drop the scan_errors table."""
    operations.drop_index(
        "ix_scan_errors_scan_run_id",
        table_name="scan_errors",
    )
    operations.drop_table("scan_errors")
