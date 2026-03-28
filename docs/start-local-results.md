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
- 2026-03-27T21:12:59.567Z | ERROR | [frontend] exited unexpectedly with code 3221225786.
- 2026-03-27T21:12:59.568Z | INFO | Shutting down with exit code 3221225786.
- Ended: 2026-03-27T21:12:59.569Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T21:47:30.451Z-pid-26668
- Started: 2026-03-27T21:47:30.451Z
- Hostname: Rons-Computer
- PID: 26668
- Launcher: npm run start:local

- 2026-03-27T21:47:30.460Z | INFO | Launcher started.
- 2026-03-27T21:47:32.719Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T21:47:44.924Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T21:47:44.925Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T21:47:46.680Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T21:47:48.774Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T21:47:50.851Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
## Run 2026-03-27T22:03:04.600Z-pid-19592
- Started: 2026-03-27T22:03:04.600Z
- Hostname: Rons-Computer
- PID: 19592
- Launcher: npm run start:local

- 2026-03-27T22:03:04.611Z | INFO | Launcher started.
- 2026-03-27T22:03:06.876Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T22:03:07.801Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T22:03:07.802Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T22:03:09.573Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T22:03:09.626Z | INFO | Reusing existing backend at http://127.0.0.1:8000/health.
- 2026-03-27T22:03:09.627Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T22:03:09.638Z | INFO | Reusing existing frontend at http://127.0.0.1:5173/.
- 2026-03-27T22:03:09.641Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-27T22:14:55.406Z | ERROR | [frontend] exited unexpectedly with code 1.
- 2026-03-27T22:14:55.407Z | INFO | Shutting down with exit code 1.
- Ended: 2026-03-27T22:14:55.409Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

- 2026-03-27T22:14:59.224Z | INFO | Stop requested by npm run stop:local.
- Ended: 2026-03-27T22:14:59.224Z
- Outcome: SUCCESS
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health
- Detail: Stop source: npm run stop:local on host Rons-Computer

- 2026-03-27T22:17:21.472Z | WARN | PostgreSQL dependency check failed (1/3). Health=missing, auth=failed.
- 2026-03-27T22:19:36.518Z | WARN | PostgreSQL dependency check failed (2/3). Health=missing, auth=failed.
- 2026-03-27T22:21:51.423Z | WARN | PostgreSQL dependency check failed (3/3). Health=missing, auth=failed.
- 2026-03-27T22:21:51.425Z | ERROR | PostgreSQL remained unhealthy. Stopping local app processes.
- 2026-03-27T22:21:51.428Z | INFO | Shutting down with exit code 1.
- Ended: 2026-03-27T22:21:51.429Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T23:03:13.625Z-pid-31020
- Started: 2026-03-27T23:03:13.625Z
- Hostname: Rons-Computer
- PID: 31020
- Launcher: npm run start:local

- 2026-03-27T23:03:13.638Z | INFO | Launcher started.
- 2026-03-27T23:03:16.852Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T23:03:41.260Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T23:03:41.266Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T23:03:43.893Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T23:03:47.372Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T23:03:49.882Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-27T23:15:04.263Z | ERROR | [backend] exited unexpectedly with code 4294967295.
- 2026-03-27T23:15:04.266Z | INFO | Shutting down with exit code 4294967295.
- Ended: 2026-03-27T23:15:04.267Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

## Run 2026-03-27T23:53:58.558Z-pid-39328
- Started: 2026-03-27T23:53:58.558Z
- Hostname: Rons-Computer
- PID: 39328
- Launcher: npm run start:local

- 2026-03-27T23:53:58.572Z | INFO | Launcher started.
- 2026-03-27T23:54:03.015Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T23:54:05.799Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T23:54:05.801Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T23:54:09.395Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T23:54:09.494Z | INFO | Reusing existing backend at http://127.0.0.1:8000/health.
- 2026-03-27T23:54:09.497Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T23:54:13.452Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
## Run 2026-03-27T23:55:18.893Z-pid-31672
- Started: 2026-03-27T23:55:18.893Z
- Hostname: Rons-Computer
- PID: 31672
- Launcher: npm run start:local

- 2026-03-27T23:55:18.907Z | INFO | Launcher started.
- 2026-03-27T23:55:22.512Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-27T23:55:24.350Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-27T23:55:24.351Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-27T23:55:27.500Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-27T23:55:27.578Z | INFO | Reusing existing backend at http://127.0.0.1:8000/health.
- 2026-03-27T23:55:27.580Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-27T23:55:27.596Z | INFO | Reusing existing frontend at http://127.0.0.1:5173/.
- 2026-03-27T23:55:27.599Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
## Run 2026-03-28T00:39:36.177Z-pid-34424
- Started: 2026-03-28T00:39:36.177Z
- Hostname: Rons-Computer
- PID: 34424
- Launcher: npm run start:local

- 2026-03-28T00:39:36.186Z | INFO | Launcher started.
- 2026-03-28T00:39:58.705Z | INFO | Ensuring bundled PostgreSQL is running on port 5434.
- 2026-03-28T00:40:24.569Z | WARN | PHOTO_ORGANIZER_SCAN_ROOTS not set; backend will use broad machine discovery.
- 2026-03-28T00:40:24.571Z | INFO | Database target selected: bundled-postgres:5434.
- 2026-03-28T00:40:26.313Z | INFO | Starting backend health target at http://127.0.0.1:8000/health.
- 2026-03-28T00:40:28.470Z | INFO | Starting frontend target at http://127.0.0.1:5173/.
- 2026-03-28T00:40:30.907Z | SUCCESS | App ready. Frontend=http://127.0.0.1:5173/; Backend=http://127.0.0.1:8000/health; Database=bundled-postgres:5434.
- 2026-03-28T00:42:09.679Z | ERROR | [frontend] exited unexpectedly with code 3221225786.
- 2026-03-28T00:42:09.680Z | INFO | Shutting down with exit code 3221225786.
- Ended: 2026-03-28T00:42:09.680Z
- Outcome: FAILURE
- Detail: Startup ready state: reached
- Detail: Frontend target: http://127.0.0.1:5173/
- Detail: Backend target: http://127.0.0.1:8000/health

