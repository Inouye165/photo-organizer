"""Bootstrap the backend for end-to-end tests with migrations applied."""

from __future__ import annotations

import os
import shutil
from pathlib import Path

import uvicorn
from alembic import command
from alembic.config import Config


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


def main() -> None:
    """Prepare the database schema and start the API server."""
    database_url = os.environ["PHOTO_ORGANIZER_DATABASE_URL"]
    media_root = os.environ["PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT"]
    should_reset = os.environ.get("PHOTO_ORGANIZER_RESET_STATE") == "1"

    if should_reset:
        reset_sqlite_state(database_url=database_url, media_root=media_root)

    alembic_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(alembic_config, "head")

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
