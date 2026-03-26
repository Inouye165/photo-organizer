"""Bootstrap the backend for local development with migrations applied."""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

import uvicorn
from alembic.config import Config
from alembic.util.exc import CommandError
from sqlalchemy.exc import SQLAlchemyError

from alembic import command

logger = logging.getLogger("start_local_server")


def should_enable_reload() -> bool:
    """Return whether uvicorn reload should be enabled for this launch mode."""
    configured = os.environ.get("PHOTO_ORGANIZER_BACKEND_RELOAD")
    if configured is not None:
        return configured.strip().lower() not in {"0", "false", "no", "off"}

    return os.environ.get("PHOTO_ORGANIZER_MANAGED_START") != "1"


def main() -> None:
    """Apply migrations and start the local API server."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
    reload_enabled = should_enable_reload()

    server_dir = Path(__file__).resolve().parents[1]
    alembic_ini = server_dir / "alembic.ini"
    if not alembic_ini.exists():
        logger.error("alembic.ini not found at %s", alembic_ini)
        sys.exit(1)

    try:
        alembic_config = Config(str(alembic_ini))
        command.upgrade(alembic_config, "head")
    except (CommandError, OSError, SQLAlchemyError):
        logger.exception("Database migration failed")
        sys.exit(1)

    try:
        uvicorn.run(
            "app.main:create_app",
            factory=True,
            host="127.0.0.1",
            port=8000,
            reload=reload_enabled,
            reload_dirs=[str(server_dir / "app")] if reload_enabled else None,
        )
    except SystemExit as error:
        if error.code not in (0, None):
            logger.exception("Uvicorn exited unexpectedly")
        raise


if __name__ == "__main__":
    main()
