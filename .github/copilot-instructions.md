# Copilot Instructions

- Keep both frontend and backend diagnostics clean after edits. Before finishing, run the relevant linting/tests and check workspace problems.
- For backend Python work, run commands from the `server` directory so Alembic and pytest resolve correctly.
- Avoid introducing missing static asset references. If UI code expects a favicon or other public asset, add it under `client/public` and wire it in `client/index.html`.
- Keep Pydantic, SQLAlchemy, and Alembic files friendly to static analysis:
  - cast `BaseSettings` fields before calling string or `Path` methods when Pylance cannot infer runtime types
  - prefer SQL expressions like `text("CURRENT_TIMESTAMP")` over `func.now()` in ORM defaults when static analysis flags callable issues
  - use typed aliases or casts for Alembic `context` and `op` in migration files and `env.py`
  - avoid patterns that leave unused-import diagnostics in metadata-registration helpers
- When adding backend schema changes, update Alembic migrations and tests in the same change.