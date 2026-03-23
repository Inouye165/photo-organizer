"""Helpers for importing ORM models for metadata registration."""

from importlib import import_module


def import_models() -> None:
    """Import ORM model modules so Alembic can discover metadata."""
    import_module("app.models.photo")
    import_module("app.models.photo_variant")
    import_module("app.models.scan_run")
    import_module("app.models.scan_error")
