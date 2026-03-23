"""Scan run endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db_session
from app.models.scan_run import ScanRun
from app.schemas.scan_run import LatestScanRunResponse, ScanRunRead
from app.services.photo_scanner import PhotoScannerService

router = APIRouter()


@router.post("", response_model=ScanRunRead)
def create_scan_run(session: Session = Depends(get_db_session)) -> ScanRunRead:
    """Start a synchronous scan across configured roots and return its result."""
    settings = get_settings()
    if not settings.resolved_scan_roots():
        raise HTTPException(status_code=400, detail="No scan roots configured")
    scan_run = PhotoScannerService(settings).scan(session=session)
    return ScanRunRead.model_validate(scan_run, from_attributes=True)


@router.get("/latest", response_model=LatestScanRunResponse)
def get_latest_scan_run(session: Session = Depends(get_db_session)) -> LatestScanRunResponse:
    """Return the latest completed or failed scan run, if present."""
    latest_scan_run = session.scalar(select(ScanRun).order_by(desc(ScanRun.started_at)).limit(1))
    if latest_scan_run is None:
        return LatestScanRunResponse(scan_run=None)
    return LatestScanRunResponse(
        scan_run=ScanRunRead.model_validate(latest_scan_run, from_attributes=True)
    )
