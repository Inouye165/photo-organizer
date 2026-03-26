# Local Start Results

This file is appended automatically by `npm run start:local`.

Each run records:

- date and time in ISO 8601 format
- hostname
- launcher PID
- success or failure outcome
- notable startup and monitoring events
## Run 2026-03-26T13:45:47.915Z-pid-31312
- Started: 2026-03-26T13:45:47.915Z
- Hostname: Rons-Computer
- PID: 31312
- Launcher: npm run start:local

- 2026-03-26T13:45:47.925Z | INFO | Launcher started.
- 2026-03-26T13:46:11.089Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-26T13:46:56.718Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-26T13:46:56.721Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-26T13:47:01.934Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-26T13:47:04.782Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-26T13:52:41.540Z | ERROR | [frontend] exited unexpectedly with code 1.
- 2026-03-26T13:52:41.541Z | INFO | Shutting down with exit code 1.
- Ended: 2026-03-26T13:52:41.542Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-26T13:53:04.591Z-pid-31344
- Started: 2026-03-26T13:53:04.591Z
- Hostname: Rons-Computer
- PID: 31344
- Launcher: npm run start:local

- 2026-03-26T13:53:04.600Z | INFO | Launcher started.
- 2026-03-26T13:53:06.449Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-26T13:53:18.783Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-26T13:53:18.784Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-26T13:53:18.785Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-26T13:53:22.896Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-26T13:53:23.951Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
