"""Backend integration tests for scan execution and media generation."""

from __future__ import annotations

import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.db.session import get_session_factory
from app.models.photo import Photo


def test_scan_indexes_supported_files_and_creates_variants(client) -> None:
    """A scan indexes supported images and generates both required variants."""
    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["files_seen"] == 4
    assert payload["photos_indexed"] == 2
    assert payload["errors_count"] == 1

    photos_response = client.get("/api/photos", params={"page": 1, "page_size": 10})
    assert photos_response.status_code == 200
    photos_payload = photos_response.json()
    assert photos_payload["total"] == 2
    assert len(photos_payload["items"]) == 2
    assert all(item["thumbnail_url"] for item in photos_payload["items"])
    assert all(item["display_url"] for item in photos_payload["items"])

    with get_session_factory()() as session:
        photos = session.scalars(select(Photo)).all()
        assert len(photos) == 2
        media_root = get_settings().resolved_media_root()
        for photo in photos:
            variants = {variant.kind: variant for variant in photo.variants}
            assert set(variants) == {"thumbnail", "display_webp"}
            for variant in variants.values():
                variant_path = media_root / variant.relative_path
                assert variant_path.exists()


def test_date_range_filter_returns_matching_photos_only(client, prepared_scan_root: Path) -> None:
    """Date filtering uses the indexed capture timestamps from the filesystem."""
    january_photo = prepared_scan_root / "beach.jpg"
    february_photo = prepared_scan_root / "nested" / "mountain.png"
    january_timestamp = datetime(2024, 1, 5, 12, 0, tzinfo=UTC).timestamp()
    february_timestamp = datetime(2024, 2, 20, 12, 0, tzinfo=UTC).timestamp()
    os.utime(january_photo, (january_timestamp, january_timestamp))
    os.utime(february_photo, (february_timestamp, february_timestamp))

    client.post("/api/scan-runs")

    filtered_response = client.get(
        "/api/photos",
        params={
            "page": 1,
            "page_size": 10,
            "date_from": "2024-02-01",
            "date_to": "2024-02-29",
        },
    )
    assert filtered_response.status_code == 200
    payload = filtered_response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["file_name"] == "mountain.png"


def test_scan_survives_corrupt_files_without_aborting(client) -> None:
    """A corrupt image increments errors without aborting the full scan."""
    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["status"] == "completed_with_errors"
    assert payload["errors_count"] == 1
    assert "broken.jpg" in (payload["notes"] or "")


def test_latest_scan_run_returns_null_before_first_scan(client) -> None:
    """The latest scan endpoint returns null when no scan has been executed yet."""
    response = client.get("/api/scan-runs/latest")
    assert response.status_code == 200
    assert response.json() == {"scan_run": None}