"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import get_settings
from app.db.models import import_models


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    import_models()
    media_root = settings.resolved_media_root()
    media_root.mkdir(parents=True, exist_ok=True)

    application = FastAPI(title=settings.app_name)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.include_router(api_router, prefix=settings.api_prefix)
    application.mount("/media", StaticFiles(directory=media_root), name="media")

    @application.get("/health")
    def healthcheck() -> dict[str, str]:
        """Return a simple health payload for local development."""
        return {"status": "ok"}

    return application


app = create_app()
