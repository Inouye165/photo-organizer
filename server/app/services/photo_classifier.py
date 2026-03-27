"""Heuristic photo classifier for separating real photos from obvious graphics."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image, ImageOps

CLASSIFIER_VERSION = "heuristic-v3"
MIN_PHOTO_EDGE = 160
MIN_NO_EXIF_EDGE = 1000
MIN_NO_EXIF_PIXELS = 1_000_000
MAX_ANALYSIS_EDGE = 256
RGB_CHANNEL_COUNT = 3
ALPHA_OPAQUE_THRESHOLD = 250
PHOTO_SCORE_THRESHOLD = 0.55
NO_EXIF_PHOTO_SCORE_THRESHOLD = 0.78
NO_EXIF_CAMERA_HINT_THRESHOLD = 0.72
ENTROPY_PHOTO_THRESHOLD = 5.25
ENTROPY_GRAPHIC_THRESHOLD = 4.45
EDGE_DENSITY_PHOTO_THRESHOLD = 0.012
EDGE_DENSITY_GRAPHIC_THRESHOLD = 0.0045
CHANNEL_VARIANCE_PHOTO_THRESHOLD = 1250.0
CHANNEL_VARIANCE_GRAPHIC_THRESHOLD = 800.0
UNIQUE_BUCKET_PHOTO_THRESHOLD = 0.015
UNIQUE_BUCKET_GRAPHIC_THRESHOLD = 0.003
DOMINANT_BUCKET_GRAPHIC_THRESHOLD = 0.24
TRANSPARENCY_SIGNAL_THRESHOLD = 0.18
TRANSPARENCY_HARD_REJECT_THRESHOLD = 0.35
CAMERA_EXIF_SCORE_FLOOR = 0.72
SCORE_BASELINE = 0.22
SCORE_CAMERA_EXIF = 0.34
SCORE_ENTROPY_POSITIVE = 0.16
SCORE_ENTROPY_NEGATIVE = -0.18
SCORE_EDGE_POSITIVE = 0.16
SCORE_EDGE_NEGATIVE = -0.24
SCORE_VARIANCE_POSITIVE = 0.1
SCORE_VARIANCE_NEGATIVE = -0.12
SCORE_UNIQUE_BUCKET_POSITIVE = 0.08
SCORE_UNIQUE_BUCKET_NEGATIVE = -0.14
SCORE_DOMINANT_BUCKET_NEGATIVE = -0.18
SCORE_TRANSPARENCY_NEGATIVE = -0.18
SCORE_CAMERA_PATH_POSITIVE = 0.16
SCORE_CAMERA_FILENAME_POSITIVE = 0.2
SCORE_ASSET_PATH_NEGATIVE = -0.2
SCORE_ASSET_FILENAME_NEGATIVE = -0.18
PHOTOGRAPHIC_EXIF_TAGS = (271, 272, 33437, 34855, 37386, 42035, 42036)
CAMERA_PATH_HINT_NAMES = frozenset(
    {
        "100apple",
        "100andro",
        "camera",
        "camera roll",
        "dcim",
        "iphone",
        "mobile uploads",
        "photos",
        "pictures",
        "saved pictures",
    }
)
ASSET_PATH_HINT_NAMES = frozenset(
    {
        "asset",
        "assets",
        "emoji",
        "favicon",
        "icon",
        "icons",
        "illustration",
        "logo",
        "logos",
        "mockup",
        "mockups",
        "placeholder",
        "placeholders",
        "sprite",
        "sprites",
        "sticker",
        "stickers",
        "thumbnail",
        "thumbnails",
    }
)
CAMERA_FILENAME_PATTERN = re.compile(
    (
        r"^(?:dji_|dsc_|img_|img-|mvimg_|pxl_|sam_|wp_|\d{8}_\d{6}|"
        r"\d{4}-\d{2}-\d{2}[ _]\d{2}[.-]\d{2}[.-]\d{2})"
    ),
    re.IGNORECASE,
)
ASSET_FILENAME_PATTERN = re.compile(
    r"(?:^|[-_.])(asset|avatar|emoji|favicon|icon|illustration|logo|mockup|placeholder|sprite|sticker|thumb|thumbnail)(?:[-_.]|$)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class PhotoClassification:
    """Result of evaluating one image as likely photo vs likely graphic."""

    label: str
    score: float
    reasons: list[str]
    diagnostics: dict[str, Any]


def has_photographic_exif(image: Image.Image) -> bool:
    """Return whether the image contains common photographic camera metadata."""
    exif = image.getexif()
    return any(exif.get(tag) for tag in PHOTOGRAPHIC_EXIF_TAGS)


def classify_image(
    image: Image.Image,
    *,
    source_path: Path | None = None,
) -> PhotoClassification:
    """Classify an image as likely photo or likely graphic using image heuristics."""
    if getattr(image, "is_animated", False) or getattr(image, "n_frames", 1) > 1:
        return PhotoClassification(
            label="likely_graphic",
            score=0.02,
            reasons=["Animated or multi-frame images are treated as non-photo assets."],
            diagnostics={
                "classifier_version": CLASSIFIER_VERSION,
                "signals": {
                    "animated": True,
                },
            },
        )

    normalized_image = ImageOps.exif_transpose(image)
    width, height = normalized_image.size
    if min(width, height) < MIN_PHOTO_EDGE:
        return PhotoClassification(
            label="likely_graphic",
            score=0.04,
            reasons=[
                f"Image is too small to trust as a real photo ({width}x{height}px).",
            ],
            diagnostics={
                "classifier_version": CLASSIFIER_VERSION,
                "signals": {
                    "width": width,
                    "height": height,
                },
            },
        )

    has_camera_exif = has_photographic_exif(normalized_image)
    transparency_ratio = _transparency_ratio(normalized_image)
    analysis_image = normalized_image.convert("RGB")
    analysis_image.thumbnail((MAX_ANALYSIS_EDGE, MAX_ANALYSIS_EDGE))
    signals = _extract_signals(analysis_image)
    signals["width"] = width
    signals["height"] = height
    signals["transparency_ratio"] = transparency_ratio
    signals["has_photographic_exif"] = has_camera_exif
    signals.update(_path_signals(source_path))

    score = SCORE_BASELINE
    reasons: list[str] = []

    if has_camera_exif:
        score += SCORE_CAMERA_EXIF
        reasons.append("Camera EXIF metadata is present.")

    score += _score_entropy(signals["entropy"], reasons)
    score += _score_edge_density(signals["edge_density"], reasons)
    score += _score_channel_variance(signals["channel_variance"], reasons)
    score += _score_unique_bucket_ratio(signals["unique_bucket_ratio"], reasons)
    score += _score_dominant_bucket_ratio(signals["dominant_bucket_ratio"], reasons)
    score += _score_transparency(transparency_ratio, has_camera_exif, reasons)
    score += _score_path_hints(signals, has_camera_exif, reasons)

    if transparency_ratio >= TRANSPARENCY_HARD_REJECT_THRESHOLD and not has_camera_exif:
        score = min(score, 0.2)
        reasons.append("Large transparent regions make this look like a composited graphic.")

    if not has_camera_exif:
        score += _score_missing_camera_evidence(width=width, height=height, reasons=reasons)

    if has_camera_exif:
        score = max(score, CAMERA_EXIF_SCORE_FLOOR)

    score = max(0.0, min(1.0, score))
    required_threshold = PHOTO_SCORE_THRESHOLD if has_camera_exif else NO_EXIF_PHOTO_SCORE_THRESHOLD
    if (
        not has_camera_exif
        and bool(signals["camera_like_path"])
        and bool(signals["camera_like_filename"])
        and not bool(signals["asset_like_path"])
        and not bool(signals["asset_like_filename"])
    ):
        required_threshold = NO_EXIF_CAMERA_HINT_THRESHOLD
        reasons.append(
            "Camera-style path evidence allows a slightly lower threshold despite missing EXIF."
        )
    label = "likely_photo" if score >= required_threshold else "likely_graphic"

    if label == "likely_photo" and not reasons:
        reasons.append("Natural texture and tonal variation passed the photo heuristic.")
    if label == "likely_graphic" and not reasons:
        reasons.append("The image did not meet the score threshold for likely photos.")

    diagnostics = {
        "classifier_version": CLASSIFIER_VERSION,
        "score": round(score, 3),
        "required_threshold": required_threshold,
        "reasons": reasons,
        "signals": {key: _round_signal(value) for key, value in signals.items()},
    }
    return PhotoClassification(
        label=label,
        score=round(score, 3),
        reasons=reasons,
        diagnostics=diagnostics,
    )


def _transparency_ratio(image: Image.Image) -> float:
    """Return the share of pixels with partial transparency when an alpha channel exists."""
    if image.mode not in {"RGBA", "LA"} and "A" not in image.getbands():
        return 0.0

    alpha_channel = np.asarray(image.getchannel("A"), dtype=np.uint8)
    if alpha_channel.size == 0:
        return 0.0
    return float(np.mean(alpha_channel < ALPHA_OPAQUE_THRESHOLD))


def _score_entropy(entropy: float, reasons: list[str]) -> float:
    if entropy >= ENTROPY_PHOTO_THRESHOLD:
        reasons.append("Tonal entropy looks more like a natural scene than flat artwork.")
        return SCORE_ENTROPY_POSITIVE
    if entropy < ENTROPY_GRAPHIC_THRESHOLD:
        reasons.append("Tonal entropy is low, which is common in placeholder graphics.")
        return SCORE_ENTROPY_NEGATIVE
    return 0.0


def _score_edge_density(edge_density: float, reasons: list[str]) -> float:
    if edge_density >= EDGE_DENSITY_PHOTO_THRESHOLD:
        reasons.append("Edge density suggests scene texture instead of smooth synthetic fills.")
        return SCORE_EDGE_POSITIVE
    if edge_density < EDGE_DENSITY_GRAPHIC_THRESHOLD:
        reasons.append("Edge density is very low, consistent with smooth gradients or flat art.")
        return SCORE_EDGE_NEGATIVE
    return 0.0


def _score_channel_variance(channel_variance: float, reasons: list[str]) -> float:
    if channel_variance >= CHANNEL_VARIANCE_PHOTO_THRESHOLD:
        reasons.append("Color variance is broad enough to look photographic.")
        return SCORE_VARIANCE_POSITIVE
    if channel_variance < CHANNEL_VARIANCE_GRAPHIC_THRESHOLD:
        reasons.append("Color variance is narrow, which often indicates UI art or logos.")
        return SCORE_VARIANCE_NEGATIVE
    return 0.0


def _score_unique_bucket_ratio(unique_bucket_ratio: float, reasons: list[str]) -> float:
    if unique_bucket_ratio >= UNIQUE_BUCKET_PHOTO_THRESHOLD:
        return SCORE_UNIQUE_BUCKET_POSITIVE
    if unique_bucket_ratio < UNIQUE_BUCKET_GRAPHIC_THRESHOLD:
        reasons.append("The palette is very limited, which is common in icons and illustrations.")
        return SCORE_UNIQUE_BUCKET_NEGATIVE
    return 0.0


def _score_dominant_bucket_ratio(dominant_bucket_ratio: float, reasons: list[str]) -> float:
    if dominant_bucket_ratio >= DOMINANT_BUCKET_GRAPHIC_THRESHOLD:
        reasons.append("A single quantized color dominates too much of the frame.")
        return SCORE_DOMINANT_BUCKET_NEGATIVE
    return 0.0


def _score_transparency(
    transparency_ratio: float,
    has_camera_exif: bool,
    reasons: list[str],
) -> float:
    if transparency_ratio >= TRANSPARENCY_SIGNAL_THRESHOLD and not has_camera_exif:
        reasons.append(
            "Visible transparency strongly suggests an asset rather than a camera photo."
        )
        return SCORE_TRANSPARENCY_NEGATIVE
    return 0.0


def _score_missing_camera_evidence(
    *,
    width: int,
    height: int,
    reasons: list[str],
) -> float:
    """Apply a stricter bar when a file lacks direct camera metadata evidence."""
    if min(width, height) < MIN_NO_EXIF_EDGE or (width * height) < MIN_NO_EXIF_PIXELS:
        reasons.append(
            "Missing camera metadata and resolution is too low to trust as an original photo."
        )
        return -0.24

    reasons.append(
        "Missing camera metadata, so this file must clear a much stricter visual-photo bar."
    )
    return -0.1


def _score_path_hints(
    signals: dict[str, float | int | bool],
    has_camera_exif: bool,
    reasons: list[str],
) -> float:
    score = 0.0
    if bool(signals["camera_like_path"]):
        reasons.append("Source path matches common camera or photo-library folders.")
        score += SCORE_CAMERA_PATH_POSITIVE
    if bool(signals["camera_like_filename"]):
        reasons.append("Filename matches common camera export naming patterns.")
        score += SCORE_CAMERA_FILENAME_POSITIVE
    if bool(signals["asset_like_path"]) and not has_camera_exif:
        reasons.append("Source path looks like an app asset or generated artwork location.")
        score += SCORE_ASSET_PATH_NEGATIVE
    if bool(signals["asset_like_filename"]) and not has_camera_exif:
        reasons.append("Filename looks like a UI asset rather than an original camera photo.")
        score += SCORE_ASSET_FILENAME_NEGATIVE
    return score


def _path_signals(source_path: Path | None) -> dict[str, bool]:
    """Derive lightweight path-based hints for the classifier."""
    if source_path is None:
        return {
            "camera_like_path": False,
            "camera_like_filename": False,
            "asset_like_path": False,
            "asset_like_filename": False,
        }

    path_parts = [part.lower() for part in source_path.parts]
    stem = source_path.stem.lower()
    return {
        "camera_like_path": any(part in CAMERA_PATH_HINT_NAMES for part in path_parts[:-1]),
        "camera_like_filename": CAMERA_FILENAME_PATTERN.search(stem) is not None,
        "asset_like_path": any(part in ASSET_PATH_HINT_NAMES for part in path_parts[:-1]),
        "asset_like_filename": ASSET_FILENAME_PATTERN.search(stem) is not None,
    }


def _extract_signals(image: Image.Image) -> dict[str, float]:
    """Compute classification signals from a normalized RGB image."""
    pixel_array = np.asarray(image, dtype=np.uint8)
    if pixel_array.ndim != RGB_CHANNEL_COUNT:
        return {
            "entropy": 0.0,
            "edge_density": 0.0,
            "channel_variance": 0.0,
            "unique_bucket_ratio": 0.0,
            "dominant_bucket_ratio": 1.0,
        }

    flat_pixels = pixel_array.reshape(-1, RGB_CHANNEL_COUNT)
    quantized_pixels = (flat_pixels // 16).astype(np.uint8)
    unique_bucket_count = np.unique(quantized_pixels, axis=0).shape[0]
    bucket_dtype = np.dtype((np.void, quantized_pixels.dtype.itemsize * RGB_CHANNEL_COUNT))
    quantized_view = quantized_pixels.view(bucket_dtype)
    _, bucket_counts = np.unique(quantized_view, return_counts=True)

    grayscale = (
        (0.299 * pixel_array[..., 0])
        + (0.587 * pixel_array[..., 1])
        + (0.114 * pixel_array[..., 2])
    ).astype(np.float32)
    histogram, _ = np.histogram(grayscale, bins=64, range=(0, 255), density=False)
    probabilities = histogram / max(1, histogram.sum())
    non_zero_probabilities = probabilities[probabilities > 0]
    entropy = -float(np.sum(non_zero_probabilities * np.log2(non_zero_probabilities)))

    horizontal_gradient = np.abs(np.diff(grayscale, axis=1))
    vertical_gradient = np.abs(np.diff(grayscale, axis=0))
    combined_gradient = np.concatenate(
        (horizontal_gradient.reshape(-1), vertical_gradient.reshape(-1))
    )
    edge_density = float(
        combined_gradient.mean() / 255.0
    )

    return {
        "entropy": entropy,
        "edge_density": edge_density,
        "channel_variance": float(np.mean(np.var(flat_pixels.astype(np.float32), axis=0))),
        "unique_bucket_ratio": unique_bucket_count / max(1, flat_pixels.shape[0]),
        "dominant_bucket_ratio": float(bucket_counts.max() / max(1, flat_pixels.shape[0])),
    }


def _round_signal(value: float | int | bool) -> float | int | bool:
    """Keep persisted classifier diagnostics compact and stable."""
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value
    if math.isfinite(value):
        return round(value, 4)
    return 0.0