"""Alembic environment configuration."""

from __future__ import annotations

from importlib import import_module
from logging.config import fileConfig
from typing import Any

from sqlalchemy import engine_from_config, pool

from app.core.config import get_settings
from app.db.base import Base
from app.db.models import import_models

migration_context: Any = import_module("alembic.context")
config: Any = migration_context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

import_models()
target_metadata = Base.metadata


def get_url() -> str:
    """Resolve the database URL from application settings."""
    return get_settings().database_url


def run_migrations_offline() -> None:
    """Run migrations in offline mode."""
    migration_context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with migration_context.begin_transaction():
        migration_context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in online mode."""
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        migration_context.configure(connection=connection, target_metadata=target_metadata)

        with migration_context.begin_transaction():
            migration_context.run_migrations()


if migration_context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
