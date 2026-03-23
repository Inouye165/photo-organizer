"""Add a unique index for photo content hashes."""

# pylint: disable=invalid-name

from __future__ import annotations

from importlib import import_module
from typing import Any

operations: Any = import_module("alembic.op")

revision = "20260323_0003"
down_revision = "20260323_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Prevent exact duplicate photos from being persisted by content hash."""
    with operations.batch_alter_table("photos") as batch_op:
        batch_op.create_index("ux_photos_content_hash", ["content_hash"], unique=True)


def downgrade() -> None:
    """Remove the unique content hash index."""
    with operations.batch_alter_table("photos") as batch_op:
        batch_op.drop_index("ux_photos_content_hash")
