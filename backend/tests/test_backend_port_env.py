import os
import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from main import DEFAULT_BACKEND_PORT, resolve_backend_port


def test_backend_port_defaults_when_env_missing(monkeypatch):
    monkeypatch.delenv("LYRICVAULT_BACKEND_PORT", raising=False)
    assert resolve_backend_port() == DEFAULT_BACKEND_PORT


def test_backend_port_uses_env_value(monkeypatch):
    monkeypatch.setenv("LYRICVAULT_BACKEND_PORT", "8123")
    assert resolve_backend_port() == 8123


def test_backend_port_falls_back_on_invalid_env(monkeypatch):
    monkeypatch.setenv("LYRICVAULT_BACKEND_PORT", "invalid-port")
    assert resolve_backend_port() == DEFAULT_BACKEND_PORT


def test_backend_port_falls_back_on_out_of_range_env(monkeypatch):
    monkeypatch.setenv("LYRICVAULT_BACKEND_PORT", "70000")
    assert resolve_backend_port() == DEFAULT_BACKEND_PORT
