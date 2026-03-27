# Local Start Results

This file is appended automatically by `npm run start:local`.

## Guide

Follow these rules when monitoring startup runs:

- start the app with `npm run start:local`
- watch the process until it reaches success or failure
- if startup fails, record the reason and fix the problem before treating the run as complete
- always include a date and time stamp for every log entry in ISO 8601 format
- keep the newest run at the top of the file
- preserve the existing log pattern and add new runs above older runs
- record the launcher name, hostname, PID, outcome, and any notable startup or monitoring events

Each run records:

- date and time in ISO 8601 format
- hostname
- launcher PID
- success or failure outcome
- notable startup and monitoring events

## Run 2026-03-27T13:57:23.722Z-pid-38428
- Started: 2026-03-27T13:57:23.722Z
- Hostname: Rons-Computer
- PID: 38428
- Launcher: npm run start:local

- 2026-03-27T13:57:23.730Z | INFO | Launcher started.
- 2026-03-27T13:57:45.708Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T13:58:20.158Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T13:58:20.160Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T13:58:22.097Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T13:58:27.395Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T13:58:30.154Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.

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
## Run 2026-03-26T20:17:46.110Z-pid-37848
- Started: 2026-03-26T20:17:46.110Z
- Hostname: Rons-Computer
- PID: 37848
- Launcher: npm run start:local

- 2026-03-26T20:17:46.118Z | INFO | Launcher started.
- 2026-03-26T20:18:08.756Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-26T20:18:45.128Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-26T20:18:45.130Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-26T20:18:46.893Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-26T20:18:49.078Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-26T20:18:51.905Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-26T20:23:12.333Z | ERROR | [frontend] exited unexpectedly with code 1.
- 2026-03-26T20:23:12.335Z | INFO | Shutting down with exit code 1.
- Ended: 2026-03-26T20:23:12.337Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-26T20:23:31.800Z-pid-22972
- Started: 2026-03-26T20:23:31.800Z
- Hostname: Rons-Computer
- PID: 22972
- Launcher: npm run start:local

- 2026-03-26T20:23:31.814Z | INFO | Launcher started.
- 2026-03-26T20:23:35.058Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-26T20:23:48.718Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-26T20:23:48.720Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-26T20:23:51.542Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-26T20:23:54.711Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-26T20:23:57.167Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-26T23:28:27.562Z | WARN | PostgreSQL dependency check failed (2/3). Health=missing, auth=failed.
- 2026-03-26T23:30:42.518Z | WARN | PostgreSQL dependency check failed (3/3). Health=missing, auth=failed.
- 2026-03-26T23:30:42.520Z | ERROR | PostgreSQL remained unhealthy. Stopping local app processes.
- 2026-03-26T23:30:42.522Z | INFO | Shutting down with exit code 1.
- Ended: 2026-03-26T23:30:42.523Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T00:13:44.194Z-pid-20700
- Started: 2026-03-27T00:13:44.194Z
- Hostname: Rons-Computer
- PID: 20700
- Launcher: npm run start:local

- 2026-03-27T00:13:44.209Z | INFO | Launcher started.
- 2026-03-27T00:13:46.556Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T00:14:00.121Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T00:14:00.123Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T00:14:02.290Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T00:14:05.471Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T00:14:07.589Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-27T00:15:01.068Z | ERROR | [frontend] exited unexpectedly with code 3221225786.
- 2026-03-27T00:15:01.070Z | INFO | Shutting down with exit code 3221225786.
- Ended: 2026-03-27T00:15:01.071Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health
- 2026-03-27T14:02:22.885Z | ERROR | [frontend] exited unexpectedly with code 3221225786.
- 2026-03-27T14:02:22.886Z | INFO | Shutting down with exit code 3221225786.
- Ended: 2026-03-27T14:02:22.887Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T14:14:41.098Z-pid-9076
- Started: 2026-03-27T14:14:41.098Z
- Hostname: Rons-Computer
- PID: 9076
- Launcher: npm run start:local

- 2026-03-27T14:14:41.107Z | INFO | Launcher started.
- 2026-03-27T14:14:42.878Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T14:14:43.717Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T14:14:43.718Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T14:14:45.180Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T14:14:47.281Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T14:14:48.949Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-27T14:28:46.244Z | ERROR | [frontend] exited unexpectedly with code 3221225786.
- 2026-03-27T14:28:46.245Z | INFO | Shutting down with exit code 3221225786.
- Ended: 2026-03-27T14:28:46.246Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T15:04:22.768Z-pid-21772
- Started: 2026-03-27T15:04:22.768Z
- Hostname: Rons-Computer
- PID: 21772
- Launcher: npm run start:local

- 2026-03-27T15:04:22.778Z | INFO | Launcher started.
- 2026-03-27T15:04:50.410Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T15:05:15.647Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T15:05:15.649Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T15:05:17.396Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T15:05:19.593Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T15:05:22.172Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-27T16:05:11.736Z | ERROR | [frontend] exited unexpectedly with code 3221225786.
- 2026-03-27T16:05:11.738Z | INFO | Shutting down with exit code 3221225786.
- Ended: 2026-03-27T16:05:11.739Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T16:46:29.242Z-pid-35632
- Started: 2026-03-27T16:46:29.242Z
- Hostname: Rons-Computer
- PID: 35632
- Launcher: npm run start:local

- 2026-03-27T16:46:29.252Z | INFO | Launcher started.
- 2026-03-27T16:46:31.215Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T16:46:32.038Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T16:46:32.039Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T16:46:33.673Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T16:46:35.764Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T16:46:37.830Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-27T17:54:51.868Z | ERROR | [frontend] exited unexpectedly with code 3221225786.
- 2026-03-27T17:54:51.870Z | INFO | Shutting down with exit code 3221225786.
- Ended: 2026-03-27T17:54:51.871Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T18:02:17.912Z-pid-20780
- Started: 2026-03-27T18:02:17.912Z
- Hostname: Rons-Computer
- PID: 20780
- Launcher: npm run start:local

- 2026-03-27T18:02:17.921Z | INFO | Launcher started.
- 2026-03-27T18:02:19.855Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T18:02:20.710Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T18:02:22.331Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T18:02:24.414Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T18:02:26.478Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-27T18:11:58.868Z | ERROR | [frontend] exited unexpectedly with code 3221225786.
- 2026-03-27T18:11:58.869Z | INFO | Shutting down with exit code 3221225786.
- Ended: 2026-03-27T18:11:58.870Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T19:52:24.840Z-pid-29232
- Started: 2026-03-27T19:52:24.840Z
- Hostname: Rons-Computer
- PID: 29232
- Launcher: npm run start:local

- 2026-03-27T19:52:24.849Z | INFO | Launcher started.
- 2026-03-27T19:52:44.128Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T19:53:21.096Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T19:53:21.098Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T19:53:23.334Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T19:53:26.525Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T19:53:28.965Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
