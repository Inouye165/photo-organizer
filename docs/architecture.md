# Architecture Overview

## Backend

- `app/core/config.py`: Environment-driven settings for database, scan roots, and generated media.
- `app/db/`: SQLAlchemy base and session factory.
- `app/models/`: `photos`, `photo_variants`, and `scan_runs` tables.
- `app/services/photo_scanner.py`: Safe root traversal, filtering, metadata extraction, and scan accounting.
- `app/services/media_variants.py`: Thumbnail and display WebP generation.
- `app/api/routers/`: Scan and photo endpoints.
- `alembic/`: Migration environment and the initial schema migration.

The backend serves two categories of data:

- JSON API responses under `/api`
- Generated media files under `/media`

## Frontend

- React + TypeScript + Vite
- React Router for route handling
- TanStack Query for server state
- Tailwind and shadcn-style primitives for the UI layer

The dashboard fetches three real data streams:

- Latest scan status
- Total indexed photo count
- Current gallery page with date filters

It also loads real detail data for the selected photo.

## Data Flow

1. A scan request reaches `POST /api/scan-runs`.
2. The scanner walks configured roots, ignoring unsupported files and symlinks.
3. Each supported file is opened with Pillow.
4. A `Photo` row is inserted or updated by `original_path`.
5. Required variants are generated and persisted in `generated-media`.
6. `PhotoVariant` rows are inserted or updated.
7. The frontend reads persisted scan and photo data through the API.

## Storage Model

- Originals remain in place on disk.
- The database stores metadata and stable references to originals.
- Generated derivatives are stored separately under the configured media root.

This keeps the current slice simple while leaving room for future metadata, search, and detail workflows.
