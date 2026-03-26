"""Track managed original copies for accepted photos."""

# pylint: disable=invalid-name

from __future__ import annotations

from importlib import import_module
from typing import Any

import sqlalchemy as sa

operations: Any = import_module("alembic.op")

revision = "20260325_0007"
down_revision = "20260324_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add explicit storage fields for copied managed originals."""
    operations.add_column(
        "photos",
        sa.Column("managed_original_relative_path", sa.String(length=1024), nullable=True),
    )
    operations.add_column(
        "photos",
        sa.Column("managed_original_file_size_bytes", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    """Remove managed-original storage tracking columns."""
    operations.drop_column("photos", "managed_original_file_size_bytes")
    operations.drop_column("photos", "managed_original_relative_path")
