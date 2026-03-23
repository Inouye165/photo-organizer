"""Add a check constraint for allowed photo variant kinds."""

# pylint: disable=invalid-name

from __future__ import annotations

from importlib import import_module
from typing import Any

operations: Any = import_module("alembic.op")

revision = "20260323_0002"
down_revision = "20260323_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Limit photo variant kinds to the supported Phase 1 values."""
    with operations.batch_alter_table("photo_variants") as batch_op:
        batch_op.create_check_constraint(
            "ck_photo_variants_kind",
            "kind IN ('thumbnail', 'display_webp')",
        )


def downgrade() -> None:
    """Remove the photo variant kind check constraint."""
    with operations.batch_alter_table("photo_variants") as batch_op:
        batch_op.drop_constraint("ck_photo_variants_kind", type_="check")
