from __future__ import annotations

import importlib.util
from pathlib import Path

from app.core.config import Settings


def load_module():
    module_path = Path(__file__).resolve().parents[1] / "scripts" / "start_local_server.py"
    spec = importlib.util.spec_from_file_location("start_local_server", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec is not None
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_should_enable_reload_for_direct_runs(monkeypatch):
    monkeypatch.delenv("PHOTO_ORGANIZER_MANAGED_START", raising=False)
    monkeypatch.delenv("PHOTO_ORGANIZER_BACKEND_RELOAD", raising=False)

    module = load_module()

    assert module.should_enable_reload() is True


def test_should_disable_reload_for_managed_start(monkeypatch):
    monkeypatch.setenv("PHOTO_ORGANIZER_MANAGED_START", "1")
    monkeypatch.delenv("PHOTO_ORGANIZER_BACKEND_RELOAD", raising=False)

    module = load_module()

    assert module.should_enable_reload() is False


def test_explicit_reload_override_wins(monkeypatch):
    monkeypatch.setenv("PHOTO_ORGANIZER_MANAGED_START", "1")
    monkeypatch.setenv("PHOTO_ORGANIZER_BACKEND_RELOAD", "true")

    module = load_module()

    assert module.should_enable_reload() is True


def test_settings_accept_powershell_escaped_cors_origins(monkeypatch):
    monkeypatch.setenv(
        "PHOTO_ORGANIZER_CORS_ORIGINS",
        '[""http://127.0.0.1:5173"",""http://localhost:5173""]',
    )

    settings = Settings()

    assert settings.cors_origins == ["http://127.0.0.1:5173", "http://localhost:5173"]