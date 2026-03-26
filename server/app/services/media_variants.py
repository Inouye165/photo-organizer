"""Manage copied originals and browser-facing variants for indexed photos."""

from __future__ import annotations

import os
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import TypedDict

from PIL import Image, ImageOps
from pillow_heif import register_heif_opener
from sqlalchemy.orm import Session

from app.models.photo import Photo
from app.models.photo_variant import PhotoVariant

register_heif_opener()


@dataclass(frozen=True)
class VariantSpec:
    """Configuration for a generated image variant."""

    kind: str
    max_edge: int
    quality: int


@dataclass(frozen=True)
class ManagedOriginalResult:
    """Describe the managed original path and whether it was refreshed."""

    absolute_path: Path
    copied: bool


class ImageSaveKwargs(TypedDict, total=False):
    """Typed subset of Pillow save kwargs used for WebP output."""

    format: str
    quality: int
    method: int
    icc_profile: bytes


class VariantService:
    """Create and repair app-managed originals and browser-facing variants."""

    def __init__(self, media_root: Path, thumbnail_size: int, display_max_edge: int) -> None:
        self.media_root = media_root
        self.thumbnail_spec = VariantSpec(kind="thumbnail", max_edge=thumbnail_size, quality=80)
        self.display_spec = VariantSpec(kind="display_webp", max_edge=display_max_edge, quality=85)

    def ensure_managed_original(
        self,
        photo: Photo,
        source_path: Path,
        *,
        force_refresh: bool = False,
    ) -> ManagedOriginalResult:
        """Copy the accepted source file into app-managed storage when needed."""
        relative_path = self._managed_original_relative_path(photo.id, source_path.suffix)
        absolute_path = self.media_root / relative_path
        absolute_path.parent.mkdir(parents=True, exist_ok=True)

        expected_size = source_path.stat().st_size
        previous_relative_path = photo.managed_original_relative_path
        copied = force_refresh or not self._managed_original_is_current(
            photo=photo,
            expected_relative_path=relative_path,
            expected_size=expected_size,
        )

        if copied:
            _atomic_copy_file(source_path, absolute_path)

        if previous_relative_path and previous_relative_path != relative_path.as_posix():
            _delete_file_if_exists(self.media_root / previous_relative_path)

        photo.managed_original_relative_path = relative_path.as_posix()
        photo.managed_original_file_size_bytes = absolute_path.stat().st_size
        return ManagedOriginalResult(absolute_path=absolute_path, copied=copied)

    def ensure_variants(
        self,
        session: Session,
        photo: Photo,
        source_path: Path,
        *,
        force_refresh: bool = False,
    ) -> None:
        """Generate required variants when they are missing or stale."""
        existing_variants = {variant.kind: variant for variant in photo.variants}
        source_stat = source_path.stat()
        for spec in (self.thumbnail_spec, self.display_spec):
            relative_path = Path("photos") / str(photo.id) / f"{spec.kind}.webp"
            absolute_path = self.media_root / relative_path
            variant = existing_variants.get(spec.kind)
            if not self._variant_needs_refresh(
                variant=variant,
                relative_path=relative_path,
                absolute_path=absolute_path,
                source_stat=source_stat,
                force_refresh=force_refresh,
            ):
                continue

            absolute_path.parent.mkdir(parents=True, exist_ok=True)
            width, height = self._write_variant(
                source_path=source_path,
                destination=absolute_path,
                spec=spec,
            )

            if variant is None:
                variant = PhotoVariant(photo=photo, kind=spec.kind)
                session.add(variant)

            previous_relative_path = variant.relative_path if variant.relative_path else None
            variant.relative_path = relative_path.as_posix()
            variant.width = width
            variant.height = height
            variant.mime_type = "image/webp"
            variant.file_size_bytes = absolute_path.stat().st_size

            if previous_relative_path and previous_relative_path != relative_path.as_posix():
                _delete_file_if_exists(self.media_root / previous_relative_path)

    def _managed_original_relative_path(self, photo_id: int, extension: str) -> Path:
        """Build the managed-original path for one photo."""
        suffix = extension or ""
        return Path("photos") / str(photo_id) / f"original{suffix}"

    def _managed_original_is_current(
        self,
        *,
        photo: Photo,
        expected_relative_path: Path,
        expected_size: int,
    ) -> bool:
        """Return whether the copied original already exists at the expected path."""
        if photo.managed_original_relative_path != expected_relative_path.as_posix():
            return False
        if photo.managed_original_file_size_bytes != expected_size:
            return False

        absolute_path = self.media_root / expected_relative_path
        if not absolute_path.exists():
            return False
        return absolute_path.stat().st_size == expected_size

    def _variant_needs_refresh(
        self,
        *,
        variant: PhotoVariant | None,
        relative_path: Path,
        absolute_path: Path,
        source_stat: os.stat_result,
        force_refresh: bool,
    ) -> bool:
        """Return whether one browser-facing derivative should be regenerated."""
        if force_refresh or variant is None:
            return True
        if variant.relative_path != relative_path.as_posix():
            return True
        if not absolute_path.exists():
            return True

        absolute_stat = absolute_path.stat()
        if variant.file_size_bytes != absolute_stat.st_size:
            return True
        return absolute_stat.st_mtime_ns < source_stat.st_mtime_ns

    def _write_variant(
        self,
        source_path: Path,
        destination: Path,
        spec: VariantSpec,
    ) -> tuple[int, int]:
        """Render one browser-safe WebP derivative atomically."""
        with Image.open(source_path) as raw_image:
            image, icc_profile = _prepare_browser_variant_image(raw_image)
            try:
                image.thumbnail((spec.max_edge, spec.max_edge))
                save_kwargs: ImageSaveKwargs = {
                    "format": "WEBP",
                    "quality": spec.quality,
                    "method": 6,
                }
                if icc_profile is not None:
                    save_kwargs["icc_profile"] = icc_profile
                _atomic_save_image(image=image, destination=destination, save_kwargs=save_kwargs)
                return image.width, image.height
            finally:
                image.close()


def _atomic_copy_file(source_path: Path, destination: Path) -> None:
    """Copy a source file to its managed location without exposing partial output."""
    temporary_path = _temporary_output_path(destination)
    try:
        shutil.copy2(source_path, temporary_path)
        os.replace(temporary_path, destination)
    finally:
        _delete_file_if_exists(temporary_path)


def _atomic_save_image(
    image: Image.Image,
    destination: Path,
    save_kwargs: ImageSaveKwargs,
) -> None:
    """Write an image to disk atomically where the filesystem supports rename semantics."""
    temporary_path = _temporary_output_path(destination)
    try:
        image.save(temporary_path, **save_kwargs)
        os.replace(temporary_path, destination)
    finally:
        _delete_file_if_exists(temporary_path)


def _temporary_output_path(destination: Path) -> Path:
    """Allocate a sibling temporary file path for atomic writes."""
    handle, raw_path = tempfile.mkstemp(
        prefix=f".{destination.stem}-",
        suffix=f"{destination.suffix}.tmp",
        dir=destination.parent,
    )
    os.close(handle)
    return Path(raw_path)


def _delete_file_if_exists(file_path: Path) -> None:
    """Remove one file if it exists, ignoring already-cleared paths."""
    file_path.unlink(missing_ok=True)


def _prepare_browser_variant_image(raw_image: Image.Image) -> tuple[Image.Image, bytes | None]:
    """Create a clean browser-facing image that omits source metadata."""
    normalized_image = ImageOps.exif_transpose(raw_image)
    icc_profile = _extract_safe_icc_profile(raw_image, normalized_image)
    rgb_image = (
        normalized_image
        if normalized_image.mode == "RGB"
        else normalized_image.convert("RGB")
    )
    clean_image = Image.frombytes("RGB", rgb_image.size, rgb_image.tobytes())

    if rgb_image is not normalized_image:
        rgb_image.close()
    if normalized_image is not raw_image:
        normalized_image.close()

    return clean_image, icc_profile


def _extract_safe_icc_profile(
    raw_image: Image.Image,
    normalized_image: Image.Image,
) -> bytes | None:
    """Preserve only a safe ICC profile when present; strip all other metadata."""
    for candidate in (normalized_image.info.get("icc_profile"), raw_image.info.get("icc_profile")):
        if isinstance(candidate, bytes) and candidate:
            return candidate
    return None
