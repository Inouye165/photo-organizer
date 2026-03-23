"""Helpers for importing ORM models for metadata registration."""


def import_models() -> None:
    """Import ORM model modules so Alembic can discover metadata."""
    from app.models import photo, photo_variant, scan_run  # noqa: F401
