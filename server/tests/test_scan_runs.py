"""Backend integration tests for scan execution and media generation."""

from __future__ import annotations

import hashlib
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pytest
from alembic.config import Config
from PIL import Image, ImageDraw
from pillow_heif import register_heif_opener
from sqlalchemy import select

from alembic import command
from app.core.config import Settings, get_settings
from app.db.session import get_engine, get_session_factory
from app.models.photo import Photo
from app.models.scan_run import ScanRun
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


def create_photo_series(root: Path, count: int, *, width: int = 240, height: int = 320) -> None:
    """Create multiple deterministic photo-like files to exercise scan caps."""
    for index in range(count):
        pixel_data = np.random.default_rng(index + 101).integers(
            0,
            256,
            size=(height, width, 3),
            dtype=np.uint8,
        )
        image = Image.fromarray(pixel_data, mode="RGB")
        exif = Image.Exif()
        exif[271] = "BulkCamera"
        exif[272] = f"Model-{index}"
        image.save(root / f"bulk-{index:02d}.jpg", exif=exif)


def file_sha256(path: Path) -> str:
    """Return a stable SHA-256 digest for one file path."""
    digest = hashlib.sha256()
    with path.open("rb") as file_handle:
        for chunk in iter(lambda: file_handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reset_runtime_caches() -> None:
    """Clear settings and SQLAlchemy caches for temporary integration tests."""
    get_settings.cache_clear()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def run_scan_with_env_override(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    scan_root: Path,
    *,
    scan_max_photos: int | None,
) -> tuple[ScanRun, Path]:
    """Run one real scan with a temporary database and optional scan-cap override."""
    database_path = tmp_path / "override-test.db"
    media_root = tmp_path / "override-media"
    alembic_config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))

    monkeypatch.setenv("PHOTO_ORGANIZER_DATABASE_URL", f"sqlite:///{database_path.as_posix()}")
    monkeypatch.setenv("PHOTO_ORGANIZER_SCAN_ROOTS", f"[\"{scan_root.as_posix()}\"]")
    monkeypatch.setenv("PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT", str(media_root))
    monkeypatch.setenv("PHOTO_ORGANIZER_CORS_ORIGINS", "[\"http://localhost:5173\"]")
    if scan_max_photos is None:
        monkeypatch.delenv("PHOTO_ORGANIZER_SCAN_MAX_PHOTOS", raising=False)
    else:
        monkeypatch.setenv("PHOTO_ORGANIZER_SCAN_MAX_PHOTOS", str(scan_max_photos))

    reset_runtime_caches()
    command.upgrade(alembic_config, "head")

    try:
        settings = get_settings()
        with get_session_factory()() as session:
            scan_run = PhotoScannerService(settings).scan(session=session)
        return scan_run, media_root
    finally:
        engine = get_engine()
        engine.dispose()
        reset_runtime_caches()


def assert_managed_assets_created(photos: list[Photo], media_root: Path) -> None:
    """Verify managed originals and generated browser variants for indexed photos."""
    for photo in photos:
        assert photo.classification_label == "likely_photo"
        assert photo.classification_details is not None
        assert photo.classification_details["label"] == "likely_photo"
        assert photo.managed_original_relative_path is not None
        managed_original_path = media_root / photo.managed_original_relative_path
        assert managed_original_path.exists()
        assert managed_original_path.suffix.lower() == photo.extension
        assert managed_original_path.stat().st_size == photo.managed_original_file_size_bytes
        assert file_sha256(managed_original_path) == photo.content_hash
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


def assert_scan_payload_summary(payload: dict[str, Any]) -> None:
    """Verify the expected high-level scan counters for the baseline fixture set."""
    assert payload["mode"] == "full"
    assert payload["candidate_images_evaluated"] == 3
    assert payload["likely_photos_accepted"] == 2
    assert payload["likely_graphics_rejected"] == 0
    assert payload["unreadable_failed_count"] == 1
    assert payload["files_seen"] == 4
    assert payload["photos_indexed"] == 2
    assert payload["errors_count"] == 1
    assert payload["diagnostics"]["outcome_counts"]["accepted_photos"] == 2
    assert payload["diagnostics"]["outcome_counts"]["unsupported_files"] == 1
    assert payload["diagnostics"]["outcome_counts"]["unreadable_files"] == 1
    assert payload["diagnostics"]["sample_paths"]["accepted_photos"]


def assert_source_file_unchanged(
    source_path: Path,
    *,
    expected_hash: str,
    expected_size: int,
    expected_mtime_ns: int,
) -> None:
    """Verify the original source file was not modified by scanning."""
    assert file_sha256(source_path) == expected_hash
    source_stat_after = source_path.stat()
    assert source_stat_after.st_size == expected_size
    assert source_stat_after.st_mtime_ns == expected_mtime_ns


def test_scan_indexes_supported_files_and_creates_managed_assets(
    client,
    prepared_scan_root: Path,
) -> None:
    """A scan copies managed originals, creates WebP variants, and leaves sources untouched."""
    beach_source = prepared_scan_root / "beach.jpg"
    beach_hash_before = file_sha256(beach_source)
    beach_stat_before = beach_source.stat()

    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert_scan_payload_summary(payload)

    photos_response = client.get("/api/photos", params={"page": 1, "page_size": 10})
    assert photos_response.status_code == 200
    photos_payload = photos_response.json()
    assert photos_payload["total"] == 2
    assert len(photos_payload["items"]) == 2
    assert all(item["thumbnail_url"] for item in photos_payload["items"])
    assert all(item["display_url"] for item in photos_payload["items"])
    assert all("?v=" in item["thumbnail_url"] for item in photos_payload["items"])
    assert all("?v=" in item["display_url"] for item in photos_payload["items"])

    with get_session_factory()() as session:
        photos = session.scalars(select(Photo)).all()
        assert len(photos) == 2
        media_root = get_settings().resolved_media_root()
        assert_managed_assets_created(photos=photos, media_root=media_root)

    assert_source_file_unchanged(
        beach_source,
        expected_hash=beach_hash_before,
        expected_size=beach_stat_before.st_size,
        expected_mtime_ns=beach_stat_before.st_mtime_ns,
    )


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
    assert payload["diagnostics"]["outcome_counts"]["unsupported_files"] == 3
    assert payload["diagnostics"]["outcome_counts"]["rejected_likely_graphics"] == 1
    assert payload["diagnostics"]["sample_paths"]["rejected_graphics"] == [
        (prepared_scan_root / "poster.jpg").as_posix()
    ]

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


def test_scan_records_excluded_path_diagnostics_for_project_and_temp_noise(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    """Broad scans record which noisy path categories were skipped before image work."""
    scan_root = tmp_path / "scan-root"
    accepted_dir = scan_root / "Pictures"
    accepted_dir.mkdir(parents=True)
    create_photo_series(accepted_dir, count=1)
    (scan_root / "package.json").write_text("{}\n", encoding="utf8")

    excluded_dirs = [
        scan_root / "cache" / "thumbs",
        scan_root / "samples" / "marketing",
        scan_root / "client" / "public",
    ]
    for directory in excluded_dirs:
        directory.mkdir(parents=True, exist_ok=True)
        create_photo_series(directory, count=1)

    scan_run, _media_root = run_scan_with_env_override(
        monkeypatch,
        tmp_path,
        scan_root,
        scan_max_photos=None,
    )

    diagnostics = scan_run.diagnostics or {}
    assert diagnostics["outcome_counts"]["excluded_path_skips"] >= 3
    assert diagnostics["excluded_path_counts"]["project asset directories"] >= 1
    assert diagnostics["excluded_path_counts"]["temp and cache directories"] >= 1
    assert diagnostics["excluded_path_counts"]["test and sample directories"] >= 1
    assert diagnostics["sample_paths"]["excluded_paths"]


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
        assert heic_photo.managed_original_relative_path is not None
        assert heic_photo.captured_at is not None
        assert heic_photo.captured_at.replace(tzinfo=UTC) == heic_captured_at
        variants = {variant.kind: variant for variant in heic_photo.variants}
        assert set(variants) == {"thumbnail", "display_webp"}

        media_root = get_settings().resolved_media_root()
        managed_original = media_root / heic_photo.managed_original_relative_path
        assert managed_original.exists()
        assert managed_original.suffix == ".HEIC"
        for variant in variants.values():
            assert (media_root / variant.relative_path).exists()


def test_settings_default_scan_cap_is_five_hundred(monkeypatch: pytest.MonkeyPatch) -> None:
    """Unset scan-cap configuration defaults to the production-minded 500-photo limit."""
    monkeypatch.delenv("PHOTO_ORGANIZER_SCAN_MAX_PHOTOS", raising=False)
    assert Settings().scan_max_photos == 500


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

def test_scan_stops_after_default_five_hundred_photo_cap(
    client,
    prepared_scan_root: Path,
) -> None:
    """The default scan cap stops after 500 accepted photos, not after 500 candidates."""
    create_photo_series(prepared_scan_root, count=505)

    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200
    payload = scan_response.json()
    assert payload["photos_indexed"] == 500
    assert payload["likely_photos_accepted"] == 500
    assert payload["candidate_images_evaluated"] >= 500
    assert "Scan cap reached after indexing 500 photos." in (payload["notes"] or "")

    photos_response = client.get("/api/photos", params={"page": 1, "page_size": 200})
    assert photos_response.status_code == 200
    photos_payload = photos_response.json()
    assert photos_payload["total"] == 500


def test_scan_cap_env_override_still_applies(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    prepared_scan_root: Path,
) -> None:
    """PHOTO_ORGANIZER_SCAN_MAX_PHOTOS still overrides the accepted-photo scan limit."""
    create_photo_series(prepared_scan_root, count=8)

    scan_run, _media_root = run_scan_with_env_override(
        monkeypatch,
        tmp_path,
        prepared_scan_root,
        scan_max_photos=3,
    )

    assert scan_run.photos_indexed == 3
    assert scan_run.likely_photos_accepted == 3
    assert "Scan cap reached after indexing 3 photos." in (scan_run.notes or "")


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

    def flaky_variant_generation(self, session, photo, source_path, **kwargs):
        if photo.file_name == "mountain.jpg":
            raise RuntimeError("Variant generation crashed")
        return original_ensure_variants(self, session, photo, source_path, **kwargs)

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
    assert reset_payload["media_files_deleted"] >= 4

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


def test_duplicate_handling_does_not_create_extra_managed_media(
    client,
    prepared_scan_root: Path,
) -> None:
    """Duplicate-content source files do not create extra managed originals or variants."""
    shutil.copy2(prepared_scan_root / "beach.jpg", prepared_scan_root / "beach-copy.jpg")

    scan_response = client.post("/api/scan-runs")
    assert scan_response.status_code == 200

    media_root = get_settings().resolved_media_root()
    managed_originals = sorted(path for path in media_root.rglob("original*") if path.is_file())
    thumbnails = sorted(path for path in media_root.rglob("thumbnail.webp") if path.is_file())
    display_variants = sorted(
        path for path in media_root.rglob("display_webp.webp") if path.is_file()
    )

    assert len(managed_originals) == 2
    assert len(thumbnails) == 2
    assert len(display_variants) == 2


def test_rescan_repairs_missing_and_stale_variants(client) -> None:
    """A later scan repairs missing or stale browser-facing variants from the managed original."""
    first_scan = client.post("/api/scan-runs")
    assert first_scan.status_code == 200

    with get_session_factory()() as session:
        photo = session.scalar(select(Photo).where(Photo.file_name == "beach.jpg"))
        assert photo is not None
        media_root = get_settings().resolved_media_root()
        managed_original = media_root / (photo.managed_original_relative_path or "")
        thumbnail = media_root / next(
            variant.relative_path for variant in photo.variants if variant.kind == "thumbnail"
        )
        display = media_root / next(
            variant.relative_path for variant in photo.variants if variant.kind == "display_webp"
        )

    stale_timestamp = 946684800
    thumbnail.unlink()
    os.utime(display, (stale_timestamp, stale_timestamp))
    managed_original_stat = managed_original.stat()
    assert not thumbnail.exists()
    assert display.stat().st_mtime_ns < managed_original_stat.st_mtime_ns

    second_scan = client.post("/api/scan-runs")
    assert second_scan.status_code == 200

    assert thumbnail.exists()
    assert display.exists()
    assert display.stat().st_mtime_ns > managed_original_stat.st_mtime_ns


def test_scan_errors_returns_empty_list_before_any_scan(client) -> None:
    """The scan errors endpoint returns an empty list when no scan has been run."""
    response = client.get("/api/scan-errors")
    assert response.status_code == 200
    payload = response.json()
    assert payload["items"] == []
    assert payload["total"] == 0
