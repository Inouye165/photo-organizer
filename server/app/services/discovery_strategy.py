"""Discovery planning helpers for broad photo scanning."""

from __future__ import annotations

import string
from dataclasses import dataclass
from pathlib import Path

HIGH_PRIORITY_DIRECTORY_NAMES = frozenset(
    {
        "camera roll",
        "dcim",
        "images",
        "my pictures",
        "onedrive",
        "photos",
        "pictures",
        "saved pictures",
        "users",
    }
)
MEDIUM_PRIORITY_DIRECTORY_NAMES = frozenset(
    {
        "desktop",
        "documents",
        "downloads",
        "icloud photos",
        "media",
        "my photo stream",
        "onedrive - pictures",
        "shared pictures",
    }
)
DEFAULT_EXCLUDED_DIR_NAMES = frozenset(
    {
        ".git",
        ".hg",
        ".idea",
        ".next",
        ".pytest_cache",
        ".venv",
        "__pycache__",
        "build",
        "dist",
        "generated-media",
        "node_modules",
        "test-results",
        "venv",
    }
)
SYSTEM_EXCLUDED_DIR_NAMES = frozenset(
    {
        "$recycle.bin",
        "$windows.~bt",
        "$windows.~ws",
        "appdata",
        "intel",
        "msocache",
        "perflogs",
        "program files",
        "program files (x86)",
        "programdata",
        "recovery",
        "system volume information",
        "windows",
        "winsxs",
    }
)
CACHE_AND_TEMP_EXCLUDED_DIR_NAMES = frozenset(
    {
        "cache",
        "caches",
        "temp",
        "tmp",
    }
)
TEST_AND_SAMPLE_EXCLUDED_DIR_NAMES = frozenset(
    {
        "fixture",
        "fixtures",
        "sample",
        "samples",
        "test",
        "tests",
    }
)
PROJECT_CONTEXT_EXCLUDED_DIR_NAMES = frozenset(
    {
        "assets",
        "client",
        "docs",
        "icons",
        "infra",
        "logos",
        "placeholders",
        "public",
        "server",
        "static",
    }
)
PROJECT_MARKER_NAMES = frozenset(
    {
        ".git",
        "alembic.ini",
        "package.json",
        "pnpm-workspace.yaml",
        "pyproject.toml",
        "vite.config.js",
        "vite.config.ts",
    }
)


@dataclass(frozen=True)
class DiscoveryTier:
    """One traversal tier exposed for diagnostics."""

    name: str
    description: str
    paths: tuple[str, ...]


@dataclass(frozen=True)
class DiscoveryPlan:
    """Resolved scan roots, priority tiers, and excluded categories."""

    mode: str
    ordered_roots: tuple[Path, ...]
    tiers: tuple[DiscoveryTier, ...]
    excluded_path_categories: tuple[str, ...]


def build_discovery_plan(configured_roots: list[Path]) -> DiscoveryPlan:
    """Build the discovery plan used by the scanner and the API."""
    normalized_configured_roots = tuple(_normalize_paths(configured_roots))
    if normalized_configured_roots:
        return DiscoveryPlan(
            mode="configured",
            ordered_roots=normalized_configured_roots,
            tiers=(
                DiscoveryTier(
                    name="Configured roots",
                    description="Explicit roots supplied through PHOTO_ORGANIZER_SCAN_ROOTS.",
                    paths=tuple(path.as_posix() for path in normalized_configured_roots),
                ),
            ),
            excluded_path_categories=_excluded_categories(),
        )

    ordered_roots = tuple(discover_machine_roots())
    home_path = _resolved_home_path()
    tier_one_paths = tuple(
        path.as_posix() for path in _existing_priority_paths(home_path, ordered_roots, tier=1)
    )
    tier_two_paths = tuple(
        path.as_posix() for path in _existing_priority_paths(home_path, ordered_roots, tier=2)
    )
    return DiscoveryPlan(
        mode="machine",
        ordered_roots=ordered_roots,
        tiers=(
            DiscoveryTier(
                name="Tier 1",
                description="Obvious photo folders and import locations visited first.",
                paths=tier_one_paths,
            ),
            DiscoveryTier(
                name="Tier 2",
                description="Common user-content folders that still often contain photos.",
                paths=tier_two_paths,
            ),
            DiscoveryTier(
                name="Tier 3",
                description=(
                    "Remaining accessible machine roots scanned after "
                    "higher-probability areas."
                ),
                paths=tuple(path.as_posix() for path in ordered_roots),
            ),
        ),
        excluded_path_categories=_excluded_categories(),
    )


def discover_machine_roots() -> list[Path]:
    """Return accessible filesystem roots for broad machine scanning."""
    home_path = _resolved_home_path()
    home_anchor = Path(home_path.anchor) if home_path.anchor else None

    discovered_roots = [home_anchor] if home_anchor is not None and home_anchor.exists() else []
    discovered_keys = {home_anchor.as_posix().lower()} if home_anchor is not None else set()

    if home_anchor is None or len(home_anchor.drive) == 0:
        root_path = Path.home().resolve().anchor or Path("/").as_posix()
        return [Path(root_path)]

    for drive_letter in string.ascii_uppercase:
        drive_root = Path(f"{drive_letter}:/")
        try:
            if not drive_root.exists() or not drive_root.is_dir():
                continue
        except OSError:
            continue
        key = drive_root.as_posix().lower()
        if key in discovered_keys:
            continue
        discovered_roots.append(drive_root)
        discovered_keys.add(key)

    return discovered_roots


def sort_candidate_directories(
    directories: list[Path],
    *,
    home_path: Path | None,
) -> list[Path]:
    """Return directories ordered from most likely to least likely photo-bearing."""
    return sorted(
        directories,
        key=lambda candidate: _directory_priority(candidate, home_path=home_path),
    )


def _directory_priority(candidate: Path, *, home_path: Path | None) -> tuple[int, int, str]:
    """Compute a stable traversal sort key for one directory."""
    candidate_name = candidate.name.lower()
    resolved_candidate = _safe_resolve(candidate)

    if home_path is not None and resolved_candidate == home_path:
        return (0, 0, candidate_name)
    if candidate_name in HIGH_PRIORITY_DIRECTORY_NAMES:
        return (0, 1, candidate_name)
    if (
        home_path is not None
        and resolved_candidate is not None
        and resolved_candidate.is_relative_to(home_path)
    ):
        return (0, 2, candidate_name)
    if candidate_name in MEDIUM_PRIORITY_DIRECTORY_NAMES:
        return (1, 0, candidate_name)
    return (2, 0, candidate_name)


def _existing_priority_paths(home_path: Path, roots: tuple[Path, ...], *, tier: int) -> list[Path]:
    """Return existing diagnostic paths for one discovery tier."""
    candidates: list[Path] = []
    if tier == 1:
        home_candidates = [
            home_path / "Pictures",
            home_path / "Photos",
            home_path / "OneDrive" / "Pictures",
            home_path / "Pictures" / "Camera Roll",
            home_path / "Pictures" / "Saved Pictures",
        ]
        root_candidates = [root / "DCIM" for root in roots]
        candidates.extend(home_candidates)
        candidates.extend(root_candidates)
    else:
        home_candidates = [
            home_path / "Desktop",
            home_path / "Downloads",
            home_path / "Documents",
            home_path / "OneDrive",
        ]
        root_candidates = [root / "Users" for root in roots]
        candidates.extend(home_candidates)
        candidates.extend(root_candidates)

    existing: list[Path] = []
    seen = set()
    for candidate in candidates:
        resolved_candidate = _safe_resolve(candidate)
        if (
            resolved_candidate is None
            or not resolved_candidate.exists()
            or not resolved_candidate.is_dir()
        ):
            continue
        key = resolved_candidate.as_posix().lower()
        if key in seen:
            continue
        existing.append(resolved_candidate)
        seen.add(key)
    return existing


def _normalize_paths(paths: list[Path]) -> list[Path]:
    """Normalize configured roots to absolute paths."""
    normalized: list[Path] = []
    seen = set()
    for path in paths:
        resolved_path = Path(str(path)).expanduser().resolve()
        key = resolved_path.as_posix().lower()
        if key in seen:
            continue
        normalized.append(resolved_path)
        seen.add(key)
    return normalized


def _excluded_categories() -> tuple[str, ...]:
    """Return stable high-level exclusion categories for diagnostics."""
    return (
        "managed generated media",
        "project and dependency artifacts",
        "system directories",
        "temp and cache directories",
        "test and sample directories",
        "nested project workspaces",
    )


def _resolved_home_path() -> Path:
    """Return the current user home path for traversal prioritization."""
    return Path.home().expanduser().resolve()


def _safe_resolve(path: Path) -> Path | None:
    """Resolve a path without raising when the path is inaccessible."""
    try:
        return path.resolve(strict=False)
    except OSError:
        return None