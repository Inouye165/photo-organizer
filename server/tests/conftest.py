"""Shared pytest fixtures for backend integration tests."""

from __future__ import annotations

import json
import shutil
from collections.abc import Iterator
from pathlib import Path

import numpy as np
import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from PIL import Image

from alembic import command
from app.core.config import get_settings
from app.db.session import get_engine, get_session_factory
from app.main import create_app


def reset_caches() -> None:
    """Clear cached settings and database factories between tests."""
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def create_photo_like_fixture(path: Path, width: int, height: int, seed: int) -> None:
    """Write deterministic photo-like pixel data with EXIF metadata."""
    rng = np.random.default_rng(seed)
    x_gradient = np.linspace(0, 255, width, dtype=np.float32)
    y_gradient = np.linspace(0, 255, height, dtype=np.float32)[:, None]
    noise = rng.normal(loc=0.0, scale=28.0, size=(height, width, 3)).astype(np.float32)

    photo_array = np.zeros((height, width, 3), dtype=np.float32)
    photo_array[..., 0] = x_gradient
    photo_array[..., 1] = y_gradient
    photo_array[..., 2] = (x_gradient[None, :] * 0.45) + (y_gradient * 0.55)
    photo_array += noise

    image = Image.fromarray(np.clip(photo_array, 0, 255).astype(np.uint8), mode="RGB")
    exif = Image.Exif()
    exif[271] = "TestCamera"
    exif[272] = "TestModel"
    image.save(path, exif=exif)


@pytest.fixture(name="prepared_scan_root")
def prepared_scan_root_fixture(tmp_path: Path) -> Path:
    """Copy the fixture scan root into a test-local directory."""
    source_root = Path(__file__).parent / "fixtures" / "scan_root"
    target_root = tmp_path / "scan_root"
    shutil.copytree(source_root, target_root)
    (target_root / "nested" / "mountain.png").unlink(missing_ok=True)
    create_photo_like_fixture(target_root / "beach.jpg", width=1200, height=800, seed=11)
    create_photo_like_fixture(
        target_root / "nested" / "mountain.jpg",
        width=900,
        height=1200,
        seed=29,
    )
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
    monkeypatch.setenv("PHOTO_ORGANIZER_SCAN_MAX_PHOTOS", "500")
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
