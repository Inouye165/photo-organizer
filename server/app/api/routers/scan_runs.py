"""Scan run endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.functions import count

from app.core.config import get_settings
from app.db.session import get_db_session
from app.models.scan_run import ScanRun
from app.schemas.scan_run import (
    DiscoveryPlanRead,
    DiscoveryPlanResponse,
    LatestScanRunResponse,
    ResetIndexStateResponse,
    ScanRunCreateRequest,
    ScanRunListResponse,
    ScanRunRead,
)
from app.services.discovery_strategy import build_discovery_plan
from app.services.index_reset import reset_indexed_state
from app.services.photo_scanner import PhotoScannerService

router = APIRouter()


@router.post("", response_model=ScanRunRead)
def create_scan_run(
    request: ScanRunCreateRequest = Body(default_factory=ScanRunCreateRequest),
    session: Session = Depends(get_db_session),
) -> ScanRunRead:
    """Start a synchronous scan across configured roots and return its result."""
    settings = get_settings()
    if not settings.resolved_scan_roots():
        raise HTTPException(status_code=400, detail="No accessible scan roots found")
    scan_run = PhotoScannerService(settings).scan(session=session, mode=request.mode)
    return ScanRunRead.model_validate(scan_run, from_attributes=True)


@router.get("/discovery-plan", response_model=DiscoveryPlanResponse)
def get_discovery_plan() -> DiscoveryPlanResponse:
    """Return the resolved discovery plan that will drive upcoming scans."""
    settings = get_settings()
    plan = build_discovery_plan(settings.scan_roots)
    return DiscoveryPlanResponse(
        plan=DiscoveryPlanRead(
            mode=plan.mode,
            ordered_roots=[root.as_posix() for root in plan.ordered_roots],
            tiers=[
                {
                    "name": tier.name,
                    "description": tier.description,
                    "paths": list(tier.paths),
                }
                for tier in plan.tiers
            ],
            excluded_path_categories=list(plan.excluded_path_categories),
        )
    )


@router.post("/reset", response_model=ResetIndexStateResponse)
def reset_scan_state(session: Session = Depends(get_db_session)) -> ResetIndexStateResponse:
    """Clear app-managed indexed state for a genuinely fresh evaluation run."""
    summary = reset_indexed_state(session=session, settings=get_settings())
    return ResetIndexStateResponse(**summary.__dict__)


@router.get("/latest", response_model=LatestScanRunResponse)
def get_latest_scan_run(session: Session = Depends(get_db_session)) -> LatestScanRunResponse:
    """Return the latest completed or failed scan run, if present."""
    latest_scan_run = session.scalar(select(ScanRun).order_by(desc(ScanRun.started_at)).limit(1))
    if latest_scan_run is None:
        return LatestScanRunResponse(scan_run=None)
    return LatestScanRunResponse(
        scan_run=ScanRunRead.model_validate(latest_scan_run, from_attributes=True)
    )


@router.get("", response_model=ScanRunListResponse)
def list_scan_runs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=8, ge=1, le=100),
    session: Session = Depends(get_db_session),
) -> ScanRunListResponse:
    """Return recent scan runs ordered from newest to oldest."""
    total = session.scalar(select(count(ScanRun.id))) or 0
    scan_runs = session.scalars(
        select(ScanRun)
        .order_by(desc(ScanRun.started_at), desc(ScanRun.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    items = [
        ScanRunRead.model_validate(scan_run, from_attributes=True)
        for scan_run in scan_runs
    ]
    return ScanRunListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
