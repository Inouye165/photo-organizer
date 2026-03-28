"""FastAPI application entry point."""

from __future__ import annotations

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.api.router import api_router
from app.core.config import get_settings
from app.db.models import import_models


class MediaCacheMiddleware(BaseHTTPMiddleware):
    """Add Cache-Control headers to /media responses."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Set long-lived cache headers for immutable media assets."""
        response = await call_next(request)
        if request.url.path.startswith("/media/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()
    import_models()
    media_root = settings.resolved_media_root()
    media_root.mkdir(parents=True, exist_ok=True)

    application = FastAPI(title=settings.app_name)
    application.add_middleware(MediaCacheMiddleware)
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
