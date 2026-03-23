"""Top-level API router registration."""

from fastapi import APIRouter

from app.api.routers.photos import router as photos_router
from app.api.routers.scan_runs import router as scan_runs_router

api_router = APIRouter()
api_router.include_router(scan_runs_router, prefix="/scan-runs", tags=["scan-runs"])
api_router.include_router(photos_router, prefix="/photos", tags=["photos"])
