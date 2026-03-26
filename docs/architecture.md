# Architecture Overview

## Backend

- `app/core/config.py`: Environment-driven settings for database, scan roots, and generated media.
- `app/db/`: SQLAlchemy base and session factory.
- `app/models/`: `photos`, `photo_variants`, and `scan_runs` tables.
- `app/services/photo_scanner.py`: Safe root traversal, filtering, metadata extraction, and scan accounting.
- `app/services/media_variants.py`: Managed-original copy handling plus thumbnail and display WebP generation.
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
5. The accepted source file is copied into app-managed storage as an immutable managed original.
6. Required browser-facing WebP variants are generated from that managed original.
7. `PhotoVariant` rows are inserted or updated.
7. The frontend reads persisted scan and photo data through the API.

## Storage Model

- Originals remain in place on disk and are never modified by the app.
- The database stores both the user source path and the managed copied-original path.
- The managed media root now contains immutable copied originals plus generated browser derivatives.
- Browser UI reads optimized WebP derivatives, while the managed original is reserved for future reprocessing and embedding work.

This keeps the current slice simple while leaving room for future metadata, semantic search, and embedding workflows.
