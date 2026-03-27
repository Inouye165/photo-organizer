"""Store structured scan diagnostics on scan runs."""

# pylint: disable=invalid-name

from __future__ import annotations

from importlib import import_module
from typing import Any

import sqlalchemy as sa

operations: Any = import_module("alembic.op")

revision = "20260326_0008"
down_revision = "20260325_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add the scan-run diagnostics JSON column."""
    operations.add_column("scan_runs", sa.Column("diagnostics", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Remove the scan-run diagnostics JSON column."""
    operations.drop_column("scan_runs", "diagnostics")