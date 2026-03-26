# Photo Organizer

Phase 1 delivers the first real vertical slice of a photo organizer with a PostgreSQL-ready FastAPI backend, a React + TypeScript + Vite frontend, filesystem scanning, managed copied originals, generated browser variants, and an API-driven gallery with no mocked page data.

## Phase 1 Summary

### Included

- FastAPI backend with modular settings, services, routers, models, and schemas
- SQLAlchemy ORM models and Alembic migrations
- PostgreSQL-ready configuration and local Docker Compose support
- Safe recursive scanning across configured roots only
- Indexing of supported image types: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`, `.tiff`, `.heic`, `.heif`
- Real managed-original copying for accepted photos
- Real thumbnail generation
- Real display-sized WebP generation
- Real API-driven gallery with date filtering
- Real latest scan status and real totals in the UI
- Backend integration tests, frontend unit tests, and Playwright E2E coverage

### Not Included

- Authentication
- Semantic search
- AI features
- Face detection
- File move or delete workflows
- Background jobs or asynchronous task orchestration

## Architecture

See [docs/architecture.md](docs/architecture.md) for the component-level overview.

Top-level structure:

```text
client/   React + TypeScript + Vite frontend
server/   FastAPI API, Alembic, SQLAlchemy models, scan services, tests
infra/    Docker Compose for PostgreSQL
docs/     Architecture notes and supporting documentation
```

## Environment Variables

Copy the root example and adjust values for your machine:

```powershell
Copy-Item .env.example .env
```

Variables:

- `PHOTO_ORGANIZER_DATABASE_URL`: SQLAlchemy database URL. PostgreSQL is the intended local runtime database.
- `PHOTO_ORGANIZER_SCAN_ROOTS`: JSON array of directories the scanner is allowed to traverse.
- `PHOTO_ORGANIZER_SCAN_MAX_PHOTOS`: Safety cap for how many accepted photos one scan will index. Defaults to `500`. Set `0` to remove the cap later.
- `PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT`: Root directory for app-managed copied originals plus generated browser variants.
- `PHOTO_ORGANIZER_CORS_ORIGINS`: JSON array of allowed frontend origins.
- `PHOTO_ORGANIZER_THUMBNAIL_SIZE`: Max edge in pixels for the thumbnail variant.
- `PHOTO_ORGANIZER_DISPLAY_MAX_EDGE`: Max edge in pixels for the display WebP variant.
- `VITE_API_BASE_URL`: Base URL used by the frontend to reach the backend.

Example:

```env
PHOTO_ORGANIZER_POSTGRES_PORT=5434
PHOTO_ORGANIZER_DATABASE_URL=postgresql+psycopg://photoorganizer:photoorganizer@localhost:5434/photoorganizer
PHOTO_ORGANIZER_SCAN_ROOTS=["./sample-photos"]
PHOTO_ORGANIZER_SCAN_MAX_PHOTOS=500
PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT=./server/generated-media
PHOTO_ORGANIZER_CORS_ORIGINS=["http://localhost:5173"]
PHOTO_ORGANIZER_THUMBNAIL_SIZE=360
PHOTO_ORGANIZER_DISPLAY_MAX_EDGE=1600
VITE_API_BASE_URL=http://localhost:8000
```

## Run PostgreSQL

```powershell
docker compose -f infra/docker-compose.yml up -d
```

This is optional if you use `npm run start:local` with the default database settings. The launcher now starts the Compose `postgres` service automatically when `PHOTO_ORGANIZER_DATABASE_URL` is unset or points at the bundled local PostgreSQL instance.

## Start Everything Locally

From the repository root:

```powershell
npm run start:local
```

What it does:

- creates `.venv` if it does not exist
- installs backend dependencies if required
- installs frontend dependencies if required
- applies Alembic migrations automatically
- starts the FastAPI backend on `http://127.0.0.1:8000`
- starts the Vite frontend on `http://127.0.0.1:5173`

Operational log:

- every `npm run start:local` run appends a timestamped Markdown entry to `docs/start-local-results.md`
- each entry includes hostname, PID, success or failure outcome, and notable startup or monitoring issues
- this gives you one growing log you can review over time across different machines

Behavior:

- if `.env` exists, `start:local` uses it
- if `PHOTO_ORGANIZER_DATABASE_URL` is unset, `start:local` starts the bundled Docker Compose PostgreSQL service and uses `postgresql+psycopg://photoorganizer:photoorganizer@127.0.0.1:5434/photoorganizer`
- if `PHOTO_ORGANIZER_POSTGRES_PORT` is unset, the bundled local PostgreSQL container publishes on host port `5434`
- `start:local` accepts either `docker compose` or `docker-compose`, whichever is installed
- on Windows, if Docker Desktop is installed but not already running, `start:local` attempts to launch it and waits for the Docker engine before starting PostgreSQL
- if a local `photo-organizer-postgres` container already exists, `start:local` reuses it instead of failing on a container-name conflict
- if that existing `photo-organizer-postgres` container was created with different PostgreSQL credentials, `start:local` removes and recreates it so the app can connect cleanly
- if the bundled `infra/postgres-data` directory contains incompatible local PostgreSQL state, `start:local` resets that local data directory and recreates the bundled database automatically
- if another Docker container already owns the selected bundled PostgreSQL host port, `start:local` stops with a precise conflict message instead of failing later during Compose startup
- if Docker is unavailable while using that default PostgreSQL configuration, `start:local` exits with a clear error instead of silently switching databases
- if `PHOTO_ORGANIZER_SCAN_ROOTS` is not set, it falls back to the bundled fixture photos so the app still opens successfully
- if `PHOTO_ORGANIZER_SCAN_MAX_PHOTOS` is unset, the backend currently stops each scan after the first `500` accepted photos as a safety guard
- if you explicitly set `PHOTO_ORGANIZER_DATABASE_URL` to a `sqlite:///...` value, `start:local` respects that and skips PostgreSQL container startup
- `start:local` waits for the PostgreSQL container health check, backend `/health` payload, and frontend root page before declaring the app ready
- while running against the bundled PostgreSQL container, `start:local` keeps monitoring container health and database authentication; repeated failures stop the app processes instead of leaving a half-broken session running
- `start:local` records startup success, process failures, dependency-monitor warnings, and final shutdown outcome in `docs/start-local-results.md`

## Run the Backend

Install dependencies into the project virtual environment:

```powershell
.venv\Scripts\python.exe -m pip install -e .\server[dev]
```

Apply the database migration:

```powershell
Push-Location server
..\.venv\Scripts\python.exe -m alembic upgrade head
Pop-Location
```

Start the API:

```powershell
Push-Location server
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
Pop-Location
```

App-managed copied originals and generated browser variants are served from `/media/...`, and API routes are under `/api/...`.

## Run the Frontend

Install dependencies:

```powershell
Push-Location client
npm install
Pop-Location
```

Start the frontend:

```powershell
Push-Location client
npm run dev
Pop-Location
```

Open `http://localhost:5173`.

## Run Tests

From the repository root, you can now use the workspace scripts directly:

```powershell
npm run lint
npm run test
npm run typecheck
npm run build
npm run test:e2e
```

What they do:

- `npm run lint`: backend Ruff plus frontend ESLint
- `npm run test`: backend pytest plus frontend Vitest
- `npm run typecheck`: frontend TypeScript checks
- `npm run build`: frontend production build
- `npm run test:e2e`: Playwright end-to-end tests

You can still run each side manually if you want finer control.

Backend:

```powershell
Push-Location server
..\.venv\Scripts\python.exe -m ruff check app tests
..\.venv\Scripts\python.exe -m pytest -q
Pop-Location
```

Frontend:

```powershell
Push-Location client
npm run typecheck
npm run lint
npm run test
npm run build
Pop-Location
```

End-to-end:

```powershell
Push-Location client
npx playwright install chromium
npm run playwright:test
Pop-Location
```

## API Overview

- `POST /api/scan-runs`: Run a real synchronous scan across configured roots.
- `GET /api/scan-runs/latest`: Return the latest scan run or `null` when none exists.
- `GET /api/photos?page=&page_size=&date_from=&date_to=`: Return paginated photos from the real database.
- `GET /api/photos/{id}`: Return one photo with its generated variants.

## Phase 1 Constraints

- The scanner does not traverse arbitrary machine paths. It only scans configured roots.
- The scan is synchronous. Large libraries will block the request until completion.
- The scanner currently stops after the first `500` accepted photos per run by default, and `PHOTO_ORGANIZER_SCAN_MAX_PHOTOS` still overrides that value.
- Existing originals are indexed by `original_path` and updated in place.
- Existing originals are never modified in place by the app.
- Each accepted photo is copied into app-managed storage before downstream processing.
- Exact duplicates are rejected by SHA-256 `content_hash`, and the database enforces uniqueness for non-null hashes.
- Browser-facing variants are generated on demand from the managed original and persisted on disk as WebP derivatives.
- `photo_variants.kind` is constrained to the supported Phase 1 values: `thumbnail` and `display_webp`.
- Metadata extraction prefers EXIF capture time and falls back to the file modified time.

## Temporary Scan Cap

To avoid indexing an entire machine or very large libraries during local development, the backend currently stops each scan after indexing the first `500` accepted photos by default.

To change the cap:

- set `PHOTO_ORGANIZER_SCAN_MAX_PHOTOS=50` to index fewer photos per scan when you want a tighter dev loop
- set `PHOTO_ORGANIZER_SCAN_MAX_PHOTOS=0` to remove the cap entirely later

The cap only counts photos that pass ingestion checks. Unsupported files, duplicates, videos, rejected graphics, and corrupt files do not count toward the limit.

## Storage Contract

- The app never modifies the user’s source originals.
- Every accepted photo keeps its source `original_path` in the database.
- Every accepted photo is copied into app-managed storage as an immutable managed original.
- Browser UI reads generated WebP derivatives, not the copied original.
- The managed original is the authoritative app-owned source for future work such as re-derivation, metadata reprocessing, and embeddings.

## Recommended Next Steps for Phase 2

- Add richer metadata extraction and filtering
- Add a dedicated detail view with navigation
- Add original-file download support
- Add incremental rescans and hashing for stronger change detection
- Add background job execution for large scans
