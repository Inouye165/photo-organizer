# Photo Organizer

Phase 1 delivers the first real vertical slice of a photo organizer with a PostgreSQL-ready FastAPI backend, a React + TypeScript + Vite frontend, filesystem scanning, generated media variants, and an API-driven gallery with no mocked page data.

## Phase 1 Summary

### Included

- FastAPI backend with modular settings, services, routers, models, and schemas
- SQLAlchemy ORM models and Alembic migrations
- PostgreSQL-ready configuration and local Docker Compose support
- Safe recursive scanning across configured roots only
- Indexing of supported image types: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`, `.tiff`
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
- `PHOTO_ORGANIZER_GENERATED_MEDIA_ROOT`: Directory for generated thumbnails and display variants.
- `PHOTO_ORGANIZER_CORS_ORIGINS`: JSON array of allowed frontend origins.
- `PHOTO_ORGANIZER_THUMBNAIL_SIZE`: Max edge in pixels for the thumbnail variant.
- `PHOTO_ORGANIZER_DISPLAY_MAX_EDGE`: Max edge in pixels for the display WebP variant.
- `VITE_API_BASE_URL`: Base URL used by the frontend to reach the backend.

Example:

```env
PHOTO_ORGANIZER_DATABASE_URL=postgresql+psycopg://photoorganizer:photoorganizer@localhost:5432/photoorganizer
PHOTO_ORGANIZER_SCAN_ROOTS=["./sample-photos"]
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

For local PostgreSQL verification, one of these must already be available:

- a running Docker engine capable of starting the Compose service in `infra/docker-compose.yml`
- a separate local PostgreSQL instance, with `PHOTO_ORGANIZER_DATABASE_URL` pointed at it

If neither is available, the app can still be run locally against SQLite for development and UI verification.

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

Generated media is served from `/media/...` and API routes are under `/api/...`.

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
- Existing originals are indexed by `original_path` and updated in place.
- Variants are generated on demand during scan execution and persisted on disk.
- `photo_variants.kind` is constrained to the supported Phase 1 values: `thumbnail` and `display_webp`.
- Metadata extraction prefers EXIF capture time and falls back to the file modified time.

## Recommended Next Steps for Phase 2

- Add richer metadata extraction and filtering
- Add a dedicated detail view with navigation
- Add original-file download support
- Add incremental rescans and hashing for stronger change detection
- Add background job execution for large scans
