import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from services import ytdlp_manager as ytdlp_module
from services.ytdlp_manager import YtDlpManager


class _Result:
    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


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


def test_ytdlp_update_success(monkeypatch):
    state = _patch_state(monkeypatch)
    manager = YtDlpManager()

    versions = iter(["2026.01.01", "2026.02.15", "2026.02.15"])
    monkeypatch.setattr(manager, "get_version", lambda: next(versions))
    monkeypatch.setattr(manager, "_run_pip_install", lambda *args, **kwargs: _Result(returncode=0))
    monkeypatch.setattr(manager, "_reload_module", lambda: None)
    monkeypatch.setattr(manager, "smoke_test", lambda *args, **kwargs: True)

    result = manager.update_with_rollback()
    assert result["status"] == "success"
    assert state["last_update_status"] == "success"
    assert state["last_smoke_test_ok"] is True
    assert state["last_known_good_version"] == "2026.02.15"


def test_ytdlp_update_rolls_back_on_smoke_failure(monkeypatch):
    state = _patch_state(monkeypatch)
    manager = YtDlpManager()

    versions = iter(["2026.01.01", "2026.02.15", "2026.01.01"])
    monkeypatch.setattr(manager, "get_version", lambda: next(versions))

    calls = []

    def fake_install(package_spec, upgrade=False):
        calls.append((package_spec, upgrade))
        return _Result(returncode=0)

    monkeypatch.setattr(manager, "_run_pip_install", fake_install)
    monkeypatch.setattr(manager, "_reload_module", lambda: None)
    monkeypatch.setattr(manager, "smoke_test", lambda *args, **kwargs: False)

    result = manager.update_with_rollback()
    assert result["status"] == "rolled_back"
    assert result["rolled_back"] is True
    assert state["last_update_status"] == "rolled_back"
    assert calls[0] == ("yt-dlp", True)
    assert calls[1][0].startswith("yt-dlp==")
