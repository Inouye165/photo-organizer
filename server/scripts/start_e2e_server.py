"""Bootstrap the backend for end-to-end tests with migrations applied."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path

import numpy as np
import uvicorn
from alembic.config import Config
from PIL import Image

from alembic import command


def reset_sqlite_state(database_url: str, media_root: str) -> None:
    """Remove previous SQLite and generated-media state when requested."""
    if not database_url.startswith("sqlite:///"):
        return

    database_path = Path(database_url.removeprefix("sqlite:///"))
    if database_path.exists():
        database_path.unlink()

    media_path = Path(media_root)
    if media_path.exists():
        shutil.rmtree(media_path)


def create_photo_like_fixture(path: Path, width: int, height: int, seed: int) -> None:
    """Write deterministic photo-like pixel data for E2E scan roots."""
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


def prepare_demo_scan_root() -> None:
    """Overwrite the bundled E2E fixture images with photo-like data."""
    raw_roots = os.environ.get("PHOTO_ORGANIZER_SCAN_ROOTS", "")
    scan_root = Path(json.loads(raw_roots)[0])
    (scan_root / "nested" / "mountain.png").unlink(missing_ok=True)
    create_photo_like_fixture(scan_root / "beach.jpg", width=1200, height=800, seed=11)
    create_photo_like_fixture(
        scan_root / "nested" / "mountain.jpg",
        width=900,
        height=1200,
        seed=29,
    )


def main() -> None:
    """Prepare the database schema and start the API server."""
    database_url = os.environ["PHOTO_ORGANIZER_DATABASE_URL"]
    media_root = os.environ["PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT"]
    should_reset = os.environ.get("PHOTO_ORGANIZER_RESET_STATE") == "1"
    should_prepare_scan_root = os.environ.get("PHOTO_ORGANIZER_PREPARE_DEMO_SCAN_ROOT") == "1"
    port = int(os.environ.get("PHOTO_ORGANIZER_PORT", "8001"))

    if should_reset:
        reset_sqlite_state(database_url=database_url, media_root=media_root)

    if should_prepare_scan_root:
        prepare_demo_scan_root()

    alembic_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(alembic_config, "head")

    uvicorn.run("app.main:app", host="127.0.0.1", port=port)


if __name__ == "__main__":
    main()
