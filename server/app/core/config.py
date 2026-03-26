"""Application settings loaded from environment variables."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, cast

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.services.discovery_strategy import build_discovery_plan

DEFAULT_DATABASE_URL = "sqlite:///./photo-organizer.db"


class Settings(BaseSettings):
    """Runtime configuration for the API and scanning services."""

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_prefix="PHOTO_ORGANIZER_",
        extra="ignore",
    )

    app_name: str = "Photo Organizer"
    api_prefix: str = "/api"
    database_url: str = Field(default=DEFAULT_DATABASE_URL)
    scan_roots: list[Path] = Field(default_factory=list)
    scan_max_photos: int = 500
    generated_media_root: Path = Field(default=Path("./generated-media"))
    cors_origins: list[str] = Field(default_factory=list)
    thumbnail_size: int = 360
    display_max_edge: int = 1600

    @field_validator("database_url", mode="before")
    @classmethod
    def parse_database_url(cls, value: Any) -> str:
        """Normalize blank database URLs to the development-safe default."""
        if value in (None, ""):
            return DEFAULT_DATABASE_URL
        return str(value).strip() or DEFAULT_DATABASE_URL

    @field_validator("scan_roots", mode="before")
    @classmethod
    def parse_scan_roots(cls, value: Any) -> Any:
        """Allow scan roots to be configured as JSON or a comma-separated string."""
        if value in (None, ""):
            return []
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                return [Path(item) for item in json.loads(stripped)]
            return [Path(item.strip()) for item in stripped.split(",") if item.strip()]
        return value

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: Any) -> Any:
        """Allow CORS origins to be configured as JSON or a comma-separated string."""
        if value in (None, ""):
            return []
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                return json.loads(stripped)
            return [item.strip() for item in stripped.split(",") if item.strip()]
        return value

    @field_validator("generated_media_root", mode="before")
    @classmethod
    def parse_media_root(cls, value: Any) -> Path:
        """Coerce the generated media path to a Path."""
        return Path(value)

    def resolved_scan_roots(self) -> list[Path]:
        """Return configured roots or the default machine-wide discovery roots."""
        self_any = cast(Any, self)
        configured_roots = list(cast(list[Any], self_any.scan_roots))
        plan = build_discovery_plan([Path(str(root)) for root in configured_roots])
        return list(plan.ordered_roots)

    def resolved_media_root(self) -> Path:
        """Return the generated media root as an absolute path."""
        self_any = cast(Any, self)
        media_root = cast(Path, self_any.generated_media_root)
        return Path(str(media_root)).expanduser().resolve()


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
