"""Bootstrap the backend for local development with migrations applied."""

from __future__ import annotations

from pathlib import Path

import uvicorn
from alembic.config import Config

from alembic import command


def main() -> None:
    """Apply migrations and start the local API server."""
    alembic_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(alembic_config, "head")
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000)


if __name__ == "__main__":
    main()
