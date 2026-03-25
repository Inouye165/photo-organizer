"""Bootstrap the backend for local development with migrations applied."""

from __future__ import annotations

import logging
import sys
from pathlib import Path

import uvicorn
from alembic.config import Config
from alembic.util.exc import CommandError
from sqlalchemy.exc import SQLAlchemyError

from alembic import command

logger = logging.getLogger("start_local_server")


def main() -> None:
    """Apply migrations and start the local API server."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")

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

    uvicorn.run(
        "app.main:create_app",
        factory=True,
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[str(server_dir / "app")],
    )


if __name__ == "__main__":
    main()
