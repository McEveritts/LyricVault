import sys
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import main as main_module
from main import app


def test_get_ytdlp_status_endpoint(monkeypatch):
    monkeypatch.setattr(
        main_module.ytdlp_manager,
        "get_status",
        lambda: {
            "version": "2026.02.15",
            "last_update_status": "success",
            "last_smoke_test_ok": True,
        },
    )
    with TestClient(app) as client:
        response = client.get("/system/ytdlp")
    assert response.status_code == 200
    payload = response.json()
    assert payload["version"] == "2026.02.15"
    assert payload["last_update_status"] == "success"
