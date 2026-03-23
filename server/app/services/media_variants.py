"""Generate thumbnail and display variants for indexed photos."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from app.models.photo import Photo
from app.models.photo_variant import PhotoVariant


@dataclass(frozen=True)
class VariantSpec:
    """Configuration for a generated image variant."""

    kind: str
    max_edge: int
    quality: int


class VariantService:
    """Create missing or stale image variants for a photo."""

    def __init__(self, media_root: Path, thumbnail_size: int, display_max_edge: int) -> None:
        self.media_root = media_root
        self.thumbnail_spec = VariantSpec(kind="thumbnail", max_edge=thumbnail_size, quality=80)
        self.display_spec = VariantSpec(kind="display_webp", max_edge=display_max_edge, quality=85)

    def ensure_variants(self, session: Session, photo: Photo, source_path: Path) -> None:
        """Generate the required variants if they are missing on disk or in the database."""
        existing_variants = {variant.kind: variant for variant in photo.variants}
        for spec in (self.thumbnail_spec, self.display_spec):
            relative_path = Path("photos") / str(photo.id) / f"{spec.kind}.webp"
            absolute_path = self.media_root / relative_path
            absolute_path.parent.mkdir(parents=True, exist_ok=True)

            with Image.open(source_path) as raw_image:
                image = ImageOps.exif_transpose(raw_image)
                if image.mode not in ("RGB", "RGBA"):
                    image = image.convert("RGB")
                elif image.mode == "RGBA":
                    image = image.convert("RGB")

                image.thumbnail((spec.max_edge, spec.max_edge))
                image.save(absolute_path, format="WEBP", quality=spec.quality, method=6)

                variant = existing_variants.get(spec.kind)
                if variant is None:
                    variant = PhotoVariant(photo=photo, kind=spec.kind)
                    session.add(variant)

                variant.relative_path = relative_path.as_posix()
                variant.width = image.width
                variant.height = image.height
                variant.mime_type = "image/webp"
                variant.file_size_bytes = absolute_path.stat().st_size
