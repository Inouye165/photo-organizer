"""Unit-style tests for the heuristic real-photo classifier."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from app.services.photo_classifier import classify_image


def create_photo_like_image(width: int, height: int, seed: int) -> Image.Image:
    """Build a deterministic, textured image that looks more photographic than graphic."""
    rng = np.random.default_rng(seed)
    x_gradient = np.linspace(0, 255, width, dtype=np.float32)
    y_gradient = np.linspace(0, 255, height, dtype=np.float32)[:, None]
    noise = rng.normal(loc=0.0, scale=26.0, size=(height, width, 3)).astype(np.float32)

    image_array = np.zeros((height, width, 3), dtype=np.float32)
    image_array[..., 0] = x_gradient
    image_array[..., 1] = y_gradient
    image_array[..., 2] = (x_gradient[None, :] * 0.45) + (y_gradient * 0.55)
    image_array += noise
    return Image.fromarray(np.clip(image_array, 0, 255).astype(np.uint8), mode="RGB")


def create_gradient_asset(width: int, height: int) -> Image.Image:
    """Build a smooth synthetic gradient that should be rejected as graphic art."""
    gradient = np.tile(np.linspace(30, 220, width, dtype=np.uint8), (height, 1))
    image_array = np.dstack((gradient, gradient, np.flipud(gradient)))
    return Image.fromarray(image_array, mode="RGB")


def create_logo_like_asset(width: int, height: int) -> Image.Image:
    """Build a transparent logo-style asset with large flat regions."""
    image = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    drawing = ImageDraw.Draw(image)
    drawing.ellipse((35, 35, width - 35, height - 35), fill=(255, 126, 0, 255))
    drawing.rectangle(
        (width // 2 - 22, 50, width // 2 + 22, height - 50),
        fill=(255, 255, 255, 255),
    )
    return image


def create_photo_like_image_with_camera_exif(width: int, height: int, seed: int) -> Image.Image:
    """Build a textured image and round-trip it through JPEG with camera EXIF metadata."""
    image = create_photo_like_image(width=width, height=height, seed=seed)
    exif = Image.Exif()
    exif[271] = "TestCamera"
    exif[272] = "TestPhone"
    buffer = BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    buffer.seek(0)
    reopened = Image.open(buffer)
    reopened.load()
    return reopened


def test_classifier_accepts_photo_like_image_with_camera_exif() -> None:
    """Camera-tagged photo-like JPEG content is accepted as a likely real photo."""
    result = classify_image(
        create_photo_like_image_with_camera_exif(width=960, height=720, seed=17)
    )

    assert result.label == "likely_photo"
    assert result.score >= 0.55
    assert result.diagnostics["signals"]["entropy"] > 5.0


def test_classifier_rejects_photo_like_image_without_camera_exif() -> None:
    """Photo-like raster content without camera evidence is rejected."""
    result = classify_image(create_photo_like_image(width=960, height=720, seed=17))

    assert result.label == "likely_graphic"
    assert result.diagnostics["required_threshold"] == 0.78


def test_classifier_accepts_photo_like_image_without_exif_when_camera_path_signals_are_strong(
) -> None:
    """Camera-style path hints can rescue a plausible real photo that lacks EXIF."""
    result = classify_image(
        create_photo_like_image(width=1400, height=1100, seed=21),
        source_path=Path("C:/Users/test/Pictures/DCIM/IMG_4021.JPG"),
    )

    assert result.label == "likely_photo"
    assert result.score >= result.diagnostics["required_threshold"]
    assert result.diagnostics["signals"]["camera_like_path"] is True
    assert result.diagnostics["signals"]["camera_like_filename"] is True


def test_classifier_rejects_photo_like_image_without_exif_when_asset_path_signals_are_strong(
) -> None:
    """Asset-style paths still reject photo-like pixels that look like app artwork."""
    result = classify_image(
        create_photo_like_image(width=1400, height=1100, seed=21),
        source_path=Path("C:/repo/client/public/assets/logo-placeholder.jpg"),
    )

    assert result.label == "likely_graphic"
    assert result.diagnostics["signals"]["asset_like_path"] is True
    assert result.diagnostics["signals"]["asset_like_filename"] is True


def test_classifier_rejects_smooth_gradient_artwork() -> None:
    """Smooth synthetic gradients are rejected as non-photo graphics."""
    result = classify_image(create_gradient_asset(width=960, height=720))

    assert result.label == "likely_graphic"
    assert result.score < 0.55


def test_classifier_rejects_transparent_logo_assets() -> None:
    """Transparent logo-like assets are rejected as likely graphics."""
    result = classify_image(create_logo_like_asset(width=420, height=420))

    assert result.label == "likely_graphic"
    assert result.score < 0.55