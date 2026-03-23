"""Scan error listing endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.functions import count

from app.db.session import get_db_session
from app.models.scan_error import ScanError
from app.schemas.scan_error import ScanErrorListResponse, ScanErrorRead

router = APIRouter()


@router.get("", response_model=ScanErrorListResponse)
def list_scan_errors(
    scan_run_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    session: Session = Depends(get_db_session),
) -> ScanErrorListResponse:
    """Return a paginated list of scan errors, optionally filtered by scan run."""
    query = select(ScanError)
    count_query = select(count(ScanError.id))

    if scan_run_id is not None:
        query = query.where(ScanError.scan_run_id == scan_run_id)
        count_query = count_query.where(ScanError.scan_run_id == scan_run_id)

    total = session.scalar(count_query) or 0
    errors = session.scalars(
        query.order_by(desc(ScanError.created_at), desc(ScanError.id))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    return ScanErrorListResponse(
        items=[ScanErrorRead.model_validate(e, from_attributes=True) for e in errors],
        total=total,
        page=page,
        page_size=page_size,
    )
