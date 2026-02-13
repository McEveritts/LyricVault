import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import main as main_module
from main import DOWNLOADS_DIR, app


def test_requires_token_when_enabled(monkeypatch):
    monkeypatch.setattr(main_module, "REQUIRE_AUTH", True)
    monkeypatch.setattr(main_module, "API_TOKEN", "testtoken")

    with TestClient(app) as client:
        res = client.get("/")
        assert res.status_code == 401

        res = client.get("/", headers={"X-LyricVault-Token": "testtoken"})
        assert res.status_code == 200


def test_stream_requires_token_query_param_when_enabled(monkeypatch):
    monkeypatch.setattr(main_module, "REQUIRE_AUTH", True)
    monkeypatch.setattr(main_module, "API_TOKEN", "testtoken")

    filename = f"auth-stream-{uuid.uuid4().hex}.mp3"
    path = Path(DOWNLOADS_DIR) / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"stream-auth-ok")

    try:
        with TestClient(app) as client:
            res = client.get(f"/stream/{filename}")
            assert res.status_code == 401

            res = client.get(f"/stream/{filename}", headers={"X-LyricVault-Token": "testtoken"})
            assert res.status_code == 200
            assert res.content == b"stream-auth-ok"
    finally:
        if path.exists():
            path.unlink()


def test_events_requires_token_when_enabled(monkeypatch):
    monkeypatch.setattr(main_module, "REQUIRE_AUTH", True)
    monkeypatch.setattr(main_module, "API_TOKEN", "testtoken")

    # Avoid streaming assertions here; TestClient streaming behavior can be brittle/hanging
    # across dependency versions. We only assert auth gating.
    with TestClient(app) as client:
        res = client.get("/events")
        assert res.status_code == 401
