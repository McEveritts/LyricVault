import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from services import ytdlp_manager as ytdlp_module
from services.ytdlp_manager import YtDlpManager


def _patch_state(monkeypatch):
    state = {
        "last_known_good_version": "2026.01.01",
        "last_checked_at": None,
        "last_update_status": None,
        "last_update_error": None,
        "last_smoke_test_ok": False,
    }

    def get_state():
        return dict(state)

    def set_state(new_state):
        state.clear()
        state.update(new_state)

    def update_state(**fields):
        state.update(fields)
        return dict(state)

    monkeypatch.setattr(ytdlp_module.settings_service, "get_ytdlp_state", get_state)
    monkeypatch.setattr(ytdlp_module.settings_service, "set_ytdlp_state", set_state)
    monkeypatch.setattr(ytdlp_module.settings_service, "update_ytdlp_state", update_state)
    return state


def test_ytdlp_update_is_unsupported(monkeypatch):
    state = _patch_state(monkeypatch)
    manager = YtDlpManager()

    monkeypatch.setattr(manager, "get_version", lambda: "2026.02.15")
    result = manager.update_with_rollback()
    assert result["status"] == "unsupported"
    assert result["current_version"] == "2026.02.15"
    assert state["last_update_status"] == "unsupported"
    assert state["last_smoke_test_ok"] is None
