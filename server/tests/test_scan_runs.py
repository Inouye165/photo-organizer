"""Backend integration tests for scan execution and media generation."""

from __future__ import annotations

import os
import shutil
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from pillow_heif import register_heif_opener
from sqlalchemy import select

from app.core.config import Settings, get_settings
from app.db.session import get_session_factory
from app.models.photo import Photo
from app.services.media_variants import VariantService
from app.services.photo_scanner import PhotoScannerService

register_heif_opener()


def create_graphic_image(path: Path) -> None:
    """Create a simple low-color graphic that should fail photographic heuristics."""
    image = Image.new("RGB", (500, 500), "white")
    drawing = ImageDraw.Draw(image)
    drawing.rectangle((90, 90, 410, 410), fill="black")
    image.save(path)


def create_heic_photo(path: Path, captured_at: datetime) -> None:
    """Create a HEIC image with photographic EXIF metadata for ingestion tests."""
    pixel_data = np.random.default_rng(7).integers(0, 256, size=(480, 640, 3), dtype=np.uint8)
    image = Image.fromarray(pixel_data, mode="RGB")
    exif = Image.Exif()
    exif[271] = "Apple"
    exif[272] = "iPhone 15 Pro"
    exif[33437] = (18, 10)
    exif[34855] = 125
    exif[36867] = captured_at.strftime("%Y:%m:%d %H:%M:%S")
    image.save(path, format="HEIF", exif=exif)


def create_photo_series(root: Path, count: int) -> None:
    """Create multiple deterministic photo-like files to exercise scan caps."""
    for index in range(count):
        pixel_data = np.random.default_rng(index + 101).integers(
            0,
            256,
            size=(240, 320, 3),
            dtype=np.uint8,
        )
        image = Image.fromarray(pixel_data, mode="RGB")
        exif = Image.Exif()
        exif[271] = "BulkCamera"
        exif[272] = f"Model-{index}"
        image.save(root / f"bulk-{index:02d}.jpg", exif=exif)


def test_scan_indexes_supported_files_and_creates_variants(client) -> None:
    """A scan indexes supported images and generates both required variants."""
    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["mode"] == "full"
    assert payload["candidate_images_evaluated"] == 3
    assert payload["likely_photos_accepted"] == 2
    assert payload["likely_graphics_rejected"] == 0
    assert payload["unreadable_failed_count"] == 1
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
            assert photo.classification_label == "likely_photo"
            assert photo.classification_details is not None
            assert photo.classification_details["label"] == "likely_photo"
            variants = {variant.kind: variant for variant in photo.variants}
            assert set(variants) == {"thumbnail", "display_webp"}
            for variant in variants.values():
                variant_path = media_root / variant.relative_path
                assert variant_path.exists()
                with Image.open(variant_path) as variant_image:
                    assert dict(variant_image.getexif()) == {}
                    assert "exif" not in variant_image.info
                    assert "xmp" not in variant_image.info
                    assert "xml" not in variant_image.info


def test_date_range_filter_returns_matching_photos_only(client, prepared_scan_root: Path) -> None:
    """Date filtering uses the indexed capture timestamps from the filesystem."""
    january_photo = prepared_scan_root / "beach.jpg"
    february_photo = prepared_scan_root / "nested" / "mountain.jpg"
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
    assert payload["items"][0]["file_name"] == "mountain.jpg"


def test_scan_survives_corrupt_files_without_aborting(client) -> None:
    """A corrupt image increments errors without aborting the full scan."""
    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["status"] == "completed_with_errors"
    assert payload["errors_count"] == 1
    assert "broken.jpg" in (payload["notes"] or "")


def test_scan_skips_duplicate_content_hashes(client, prepared_scan_root: Path) -> None:
    """Duplicate file content is skipped even when the duplicate path differs."""
    shutil.copy2(prepared_scan_root / "beach.jpg", prepared_scan_root / "beach-copy.jpg")

    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["files_seen"] == 5
    assert payload["photos_indexed"] == 2
    assert payload["errors_count"] == 2

    with get_session_factory()() as session:
        photos = session.scalars(select(Photo).order_by(Photo.file_name)).all()
        photo_names = {photo.file_name for photo in photos}
        assert "mountain.jpg" in photo_names
        assert {"beach.jpg", "beach-copy.jpg"} & photo_names
        assert all(photo.content_hash is not None for photo in photos)
        assert len({photo.content_hash for photo in photos}) == 2


def test_scan_skips_videos_and_non_photographic_graphics(
    client,
    prepared_scan_root: Path,
) -> None:
    """Video files are ignored and non-photographic JPEGs are rejected from the library."""
    create_graphic_image(prepared_scan_root / "poster.jpg")
    create_graphic_image(prepared_scan_root / "logo.png")
    (prepared_scan_root / "clip.mp4").write_bytes(b"not-a-real-video")

    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["files_seen"] == 7
    assert payload["photos_indexed"] == 2
    assert payload["errors_count"] == 2

    photos_response = client.get("/api/photos", params={"page": 1, "page_size": 20})
    assert photos_response.status_code == 200
    items = photos_response.json()["items"]
    assert {item["file_name"] for item in items} == {"beach.jpg", "mountain.jpg"}

    errors_response = client.get("/api/scan-errors", params={"scan_run_id": payload["id"]})
    assert errors_response.status_code == 200
    error_items = errors_response.json()["items"]
    error_names = {e["file_name"] for e in error_items}
    assert "poster.jpg" in error_names
    assert "logo.png" not in error_names
    assert "broken.jpg" in error_names
    poster_error = next(item for item in error_items if item["file_name"] == "poster.jpg")
    assert poster_error["error_type"] == "likely_graphic"
    assert poster_error["diagnostic_metadata"]["classification"]["label"] == "likely_graphic"


def test_walk_root_excludes_managed_media_and_project_asset_directories(tmp_path: Path) -> None:
    """Directory traversal skips managed media roots and obvious project artifact folders."""
    scan_root = tmp_path / "scan-root"
    managed_media_root = scan_root / "generated-media"
    vacation_dir = scan_root / "vacation"
    vacation_dir.mkdir(parents=True)
    create_photo_series(vacation_dir, count=1)

    excluded_paths = [
        scan_root / ".git" / "hooks",
        scan_root / "node_modules" / "demo-package",
        scan_root / "dist",
        scan_root / "client" / "public",
        managed_media_root / "photos" / "1",
    ]
    for directory in excluded_paths:
        directory.mkdir(parents=True, exist_ok=True)
        create_photo_series(directory, count=1)

    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        scan_roots=[scan_root],
        generated_media_root=managed_media_root,
    )
    service = PhotoScannerService(settings)

    discovered_paths = {
        path.relative_to(scan_root).as_posix()
        for path in service.iter_discovered_files(scan_root)
    }
    assert discovered_paths == {"vacation/bulk-00.jpg"}


def test_walk_root_excludes_system_temp_and_sample_directories(tmp_path: Path) -> None:
    """Broad discovery skips obvious system, temp, and sample noise directories early."""
    scan_root = tmp_path / "scan-root"
    accepted_dir = scan_root / "Users" / "demo" / "Pictures"
    accepted_dir.mkdir(parents=True)
    create_photo_series(accepted_dir, count=1)

    excluded_dirs = [
        scan_root / "Windows" / "Web",
        scan_root / "Program Files" / "PhotoApp",
        scan_root / "temp" / "imports",
        scan_root / "samples" / "assets",
    ]
    for directory in excluded_dirs:
        directory.mkdir(parents=True, exist_ok=True)
        create_photo_series(directory, count=1)

    settings = Settings(
        database_url=f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
        scan_roots=[scan_root],
        generated_media_root=tmp_path / "generated-media",
    )
    service = PhotoScannerService(settings)

    discovered_paths = {
        path.relative_to(scan_root).as_posix()
        for path in service.iter_discovered_files(scan_root)
    }
    assert discovered_paths == {"Users/demo/Pictures/bulk-00.jpg"}


def test_scan_indexes_heic_photos_with_variants(client, prepared_scan_root: Path) -> None:
    """HEIC images with photographic EXIF metadata are indexed and get WebP variants."""
    heic_captured_at = datetime(2024, 3, 14, 9, 26, 53, tzinfo=UTC)
    heic_path = prepared_scan_root / "iphone-shot.HEIC"
    create_heic_photo(heic_path, captured_at=heic_captured_at)

    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["files_seen"] == 5
    assert payload["photos_indexed"] == 3
    assert payload["errors_count"] == 1

    with get_session_factory()() as session:
        heic_photo = session.scalar(select(Photo).where(Photo.file_name == "iphone-shot.HEIC"))
        assert heic_photo is not None
        assert heic_photo.extension == ".heic"
        assert heic_photo.content_hash is not None
        assert heic_photo.captured_at is not None
        assert heic_photo.captured_at.replace(tzinfo=UTC) == heic_captured_at
        variants = {variant.kind: variant for variant in heic_photo.variants}
        assert set(variants) == {"thumbnail", "display_webp"}

        media_root = get_settings().resolved_media_root()
        for variant in variants.values():
            assert (media_root / variant.relative_path).exists()


def test_latest_scan_run_returns_null_before_first_scan(client) -> None:
    """The latest scan endpoint returns null when no scan has been executed yet."""
    response = client.get("/api/scan-runs/latest")
    assert response.status_code == 200
    assert response.json() == {"scan_run": None}


def test_discovery_plan_endpoint_exposes_broad_machine_strategy(client) -> None:
    """The discovery plan endpoint exposes the active traversal tiers and exclusions."""
    response = client.get("/api/scan-runs/discovery-plan")
    assert response.status_code == 200
    payload = response.json()["plan"]
    assert payload["mode"] == "configured"
    assert len(payload["ordered_roots"]) == 1
    assert payload["tiers"][0]["name"] == "Configured roots"
    assert "system directories" in payload["excluded_path_categories"]


def test_scan_stops_after_configured_photo_cap(
    client,
    monkeypatch,
    prepared_scan_root: Path,
) -> None:
    """The configured scan cap stops indexing after the accepted-photo limit."""
    create_photo_series(prepared_scan_root, count=25)
    monkeypatch.setenv("PHOTO_ORGANIZER_SCAN_MAX_PHOTOS", "20")
    get_settings.cache_clear()

    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["photos_indexed"] == 20
    assert "Scan cap reached after indexing 20 photos." in (payload["notes"] or "")

    photos_response = client.get("/api/photos", params={"page": 1, "page_size": 30})
    assert photos_response.status_code == 200
    photos_payload = photos_response.json()
    assert photos_payload["total"] == 20


def test_scan_errors_are_persisted_and_queryable(client) -> None:
    """Each scan error is persisted to the scan_errors table and returned by the API."""
    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    scan_id = scan_response.json()["id"]

    errors_response = client.get("/api/scan-errors", params={"scan_run_id": scan_id})
    assert errors_response.status_code == 200
    payload = errors_response.json()
    assert payload["total"] >= 1
    found_broken = [e for e in payload["items"] if e["file_name"] == "broken.jpg"]
    assert len(found_broken) == 1
    assert found_broken[0]["error_type"] == "corrupt"
    assert found_broken[0]["scan_run_id"] == scan_id
    assert found_broken[0]["diagnostic_metadata"]["processing_stage"] == "file_processing"
    assert found_broken[0]["diagnostic_metadata"]["exception_class"] == "UnidentifiedImageError"


def test_scan_continues_after_non_database_processing_error(
    client,
    monkeypatch,
) -> None:
    """Unexpected per-file processing failures are recorded without aborting the batch."""
    original_ensure_variants = VariantService.ensure_variants

    def flaky_variant_generation(self, session, photo, source_path):
        if photo.file_name == "mountain.jpg":
            raise RuntimeError("Variant generation crashed")
        return original_ensure_variants(self, session, photo, source_path)

    monkeypatch.setattr(VariantService, "ensure_variants", flaky_variant_generation)

    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["status"] == "completed_with_errors"
    assert payload["photos_indexed"] == 1
    assert payload["errors_count"] == 2

    photos_response = client.get("/api/photos", params={"page": 1, "page_size": 10})
    assert photos_response.status_code == 200
    photo_names = {item["file_name"] for item in photos_response.json()["items"]}
    assert photo_names == {"beach.jpg"}

    errors_response = client.get("/api/scan-errors", params={"scan_run_id": payload["id"]})
    assert errors_response.status_code == 200
    error_items = errors_response.json()["items"]
    mountain_error = next(item for item in error_items if item["file_name"] == "mountain.jpg")
    assert mountain_error["error_type"] == "processing_error"
    assert mountain_error["diagnostic_metadata"]["exception_class"] == "RuntimeError"


def test_photos_can_be_filtered_by_scan_run(client, prepared_scan_root: Path) -> None:
    """Successful photos remain queryable for each scan run through the run-photo link."""
    first_scan = client.post("/api/scan-runs")
    assert first_scan.status_code == 200
    first_scan_id = first_scan.json()["id"]

    create_photo_series(prepared_scan_root, count=1)

    second_scan = client.post("/api/scan-runs")
    assert second_scan.status_code == 200
    second_scan_id = second_scan.json()["id"]

    first_run_photos = client.get(
        "/api/photos",
        params={"page": 1, "page_size": 10, "scan_run_id": first_scan_id},
    )
    assert first_run_photos.status_code == 200
    assert first_run_photos.json()["total"] == 2

    second_run_photos = client.get(
        "/api/photos",
        params={"page": 1, "page_size": 10, "scan_run_id": second_scan_id},
    )
    assert second_run_photos.status_code == 200
    second_run_payload = second_run_photos.json()
    assert second_run_payload["total"] == 3
    assert {item["file_name"] for item in second_run_payload["items"]} == {
        "beach.jpg",
        "mountain.jpg",
        "bulk-00.jpg",
    }


def test_scan_runs_endpoint_lists_recent_runs(client, prepared_scan_root: Path) -> None:
    """Recent scan runs are returned newest-first with pagination metadata."""
    first_scan = client.post("/api/scan-runs")
    assert first_scan.status_code == 200
    first_scan_id = first_scan.json()["id"]

    create_photo_series(prepared_scan_root, count=1)

    second_scan = client.post("/api/scan-runs")
    assert second_scan.status_code == 200
    second_scan_id = second_scan.json()["id"]

    response = client.get("/api/scan-runs", params={"page": 1, "page_size": 10})
    assert response.status_code == 200
    payload = response.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 10
    assert payload["total"] == 2
    assert [item["id"] for item in payload["items"]] == [second_scan_id, first_scan_id]
    assert payload["items"][0]["photos_indexed"] == 3
    assert payload["items"][1]["photos_indexed"] == 2


def test_evaluation_mode_stops_after_accepting_target_photo_count(
    client,
    prepared_scan_root: Path,
) -> None:
    """Evaluation mode stops once enough likely photos have been accepted."""
    create_photo_series(prepared_scan_root, count=24)

    response = client.post("/api/scan-runs", json={"mode": "evaluation"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "evaluation"
    assert payload["likely_photos_accepted"] == 20
    assert payload["photos_indexed"] == 20
    assert payload["candidate_images_evaluated"] <= 2000
    assert "Evaluation target reached after accepting 20 likely photos." in (payload["notes"] or "")


def test_evaluation_mode_stops_after_candidate_limit_when_acceptance_target_is_missed(
    client,
    monkeypatch,
    prepared_scan_root: Path,
) -> None:
    """Evaluation mode stops after the candidate limit when it cannot find enough likely photos."""
    monkeypatch.setattr("app.services.photo_scanner.EVALUATION_TARGET_PHOTOS", 50)
    monkeypatch.setattr("app.services.photo_scanner.EVALUATION_MAX_CANDIDATE_IMAGES", 12)

    create_graphic_image(prepared_scan_root / "aaa-logo.jpg")
    for index in range(16):
        create_graphic_image(prepared_scan_root / f"asset-{index:02d}.jpg")

    response = client.post("/api/scan-runs", json={"mode": "evaluation"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "evaluation"
    assert payload["candidate_images_evaluated"] == 12
    assert payload["likely_photos_accepted"] < 50
    assert payload["likely_graphics_rejected"] >= 1
    assert (
        "Evaluation candidate limit reached after checking 12 candidate images."
        in (payload["notes"] or "")
    )


def test_reset_endpoint_clears_app_managed_indexed_state(
    client,
    prepared_scan_root: Path,
) -> None:
    """Resetting indexed state removes persisted scan data and generated media only."""
    first_scan = client.post("/api/scan-runs")
    assert first_scan.status_code == 200

    media_root = get_settings().resolved_media_root()
    assert any(media_root.rglob("*"))
    originals_before_reset = {
        path.relative_to(prepared_scan_root).as_posix()
        for path in prepared_scan_root.rglob("*")
        if path.is_file()
    }

    reset_response = client.post("/api/scan-runs/reset")
    assert reset_response.status_code == 200
    reset_payload = reset_response.json()
    assert reset_payload["photos_deleted"] == 2
    assert reset_payload["scan_runs_deleted"] == 1
    assert reset_payload["media_files_deleted"] >= 2

    latest_response = client.get("/api/scan-runs/latest")
    assert latest_response.status_code == 200
    assert latest_response.json() == {"scan_run": None}

    photos_response = client.get("/api/photos", params={"page": 1, "page_size": 10})
    assert photos_response.status_code == 200
    assert photos_response.json()["total"] == 0

    errors_response = client.get("/api/scan-errors")
    assert errors_response.status_code == 200
    assert errors_response.json()["total"] == 0

    assert not any(media_root.rglob("*"))
    originals_after_reset = {
        path.relative_to(prepared_scan_root).as_posix()
        for path in prepared_scan_root.rglob("*")
        if path.is_file()
    }
    assert originals_after_reset == originals_before_reset

    still_empty_response = client.get("/api/photos", params={"page": 1, "page_size": 10})
    assert still_empty_response.status_code == 200
    assert still_empty_response.json()["total"] == 0

    explicit_rescan = client.post("/api/scan-runs")
    assert explicit_rescan.status_code == 200

    repopulated_response = client.get("/api/photos", params={"page": 1, "page_size": 10})
    assert repopulated_response.status_code == 200
    assert repopulated_response.json()["total"] == 2


def test_photo_detail_includes_latest_scan_run_provenance(client) -> None:
    """Photo detail includes the latest scan run id alongside source path and classification."""
    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    scan_run_id = scan_response.json()["id"]

    photos_response = client.get("/api/photos", params={"page": 1, "page_size": 10})
    assert photos_response.status_code == 200
    photo_id = photos_response.json()["items"][0]["id"]

    detail_response = client.get(f"/api/photos/{photo_id}")
    assert detail_response.status_code == 200
    payload = detail_response.json()
    assert payload["original_path"].endswith(("beach.jpg", "mountain.jpg"))
    assert payload["latest_scan_run_id"] == scan_run_id
    assert payload["classification_label"] == "likely_photo"


def test_scan_errors_returns_empty_list_before_any_scan(client) -> None:
    """The scan errors endpoint returns an empty list when no scan has been run."""
    response = client.get("/api/scan-errors")
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []
    assert payload["total"] == 0
