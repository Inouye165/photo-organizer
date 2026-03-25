"""Database engine and session factory helpers."""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    """Create and cache the SQLAlchemy engine."""
    settings = get_settings()
    database_url = str(settings.model_dump().get("database_url", ""))
    is_sqlite = database_url.startswith("sqlite")
    connect_args: dict[str, Any] = {"check_same_thread": False} if is_sqlite else {}
    engine_options: dict[str, Any] = {
        "future": True,
        "connect_args": connect_args,
    }
    if not is_sqlite:
        engine_options.update(
            pool_pre_ping=True,
            pool_recycle=1800,
            pool_use_lifo=True,
        )
    return create_engine(database_url, **engine_options)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    """Create and cache the SQLAlchemy session factory."""
    return sessionmaker(
        bind=get_engine(),
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )


def get_db_session() -> Iterator[Session]:
    """Yield a database session for a request."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()
