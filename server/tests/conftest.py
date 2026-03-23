"""Shared pytest fixtures for backend integration tests."""

from __future__ import annotations

import json
import shutil
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient

from alembic import command
from app.core.config import get_settings
from app.db.session import get_engine, get_session_factory
from app.main import create_app


def reset_caches() -> None:
    """Clear cached settings and database factories between tests."""
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.fixture
def prepared_scan_root(tmp_path: Path) -> Path:
    """Copy the fixture scan root into a test-local directory."""
    source_root = Path(__file__).parent / "fixtures" / "scan_root"
    target_root = tmp_path / "scan_root"
    shutil.copytree(source_root, target_root)
    return target_root


@pytest.fixture
def client(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    prepared_scan_root: Path,
) -> Iterator[TestClient]:
    """Create a configured test client backed by a migrated SQLite database."""
    database_path = tmp_path / "test.db"
    media_root = tmp_path / "generated-media"
    alembic_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))

    monkeypatch.setenv("PHOTO_ORGANIZER_DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    monkeypatch.setenv(
        "PHOTO_ORGANIZER_SCAN_ROOTS",
        json.dumps([prepared_scan_root.as_posix()]),
    )
    monkeypatch.setenv("PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT", str(media_root))
    monkeypatch.setenv("PHOTO_ORGANIZER_CORS_ORIGINS", json.dumps(["http://localhost:5173"]))

    reset_caches()
    command.upgrade(alembic_config, "head")
    test_client = TestClient(create_app())
    try:
        yield test_client
    finally:
        test_client.close()
        engine = get_engine()
        engine.dispose()
        reset_caches()
