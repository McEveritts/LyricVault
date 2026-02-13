"""
SettingsService - Manages persistent app settings stored locally.
Stores user preferences including their Gemini API key in a JSON file
in the OS-appropriate user data directory.
"""

import json
import os
import base64
import re
from pathlib import Path

from utils import dpapi


def _get_settings_dir() -> Path:
    """Get the LyricVault settings directory in the user's AppData."""
    app_data = os.environ.get("APPDATA", os.path.expanduser("~"))
    settings_dir = Path(app_data) / "LyricVault"
    settings_dir.mkdir(parents=True, exist_ok=True)
    return settings_dir


def _get_settings_path() -> Path:
    return _get_settings_dir() / "settings.json"


def _load_settings() -> dict:
    """Load settings from disk."""
    path = _get_settings_path()
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return {}
    return {}


def _save_settings(settings: dict):
    """Save settings to disk."""
    path = _get_settings_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2)


_DPAPI_PREFIX = "dpapi:"


def _obfuscate(value: str) -> str:
    """
    Store secrets securely (Windows): DPAPI per-user encryption.

    Fallback: base64 obfuscation (reversible). This is primarily for
    non-Windows environments and should not be relied on for security.
    """
    try:
        if dpapi.is_available():
            return f"{_DPAPI_PREFIX}{dpapi.protect(value)}"
    except Exception:
        # Fall through to base64 as a compatibility fallback.
        pass

    return base64.b64encode(value.encode("utf-8")).decode("utf-8")


def _deobfuscate(value: str) -> str:
    """Reverse the persisted secret encoding."""
    if value.startswith(_DPAPI_PREFIX):
        raw = value[len(_DPAPI_PREFIX):]
        return dpapi.unprotect(raw)
    return base64.b64decode(value.encode("utf-8")).decode("utf-8")


def _normalize_api_key(value: str | None) -> str | None:
    """Normalize API key input from settings or env."""
    if value is None:
        return None
    key = value.strip()
    if not key:
        return None
    # Common paste mistake: quoted key from shell/env files.
    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
        key = key[1:-1].strip()
    return key or None


def _looks_like_gemini_api_key(value: str | None) -> bool:
    """
    Lightweight format check.
    Typical Gemini keys begin with AIza and are longer than test placeholders.
    """
    if not value:
        return False
    return re.fullmatch(r"AIza[A-Za-z0-9_\-]{30,}", value) is not None


# ── Public API ────────────────────────────────────────────────────────

def get_gemini_api_key() -> str | None:
    """
    Retrieve the Gemini API key using this priority:
    1. User-configured key in settings.json
    2. GEMINI_API_KEY environment variable
    3. None (disabled)
    """
    settings = _load_settings()
    stored_key = settings.get("gemini_api_key")
    if stored_key:
        try:
            key = _normalize_api_key(_deobfuscate(stored_key))
        except Exception:
            key = _normalize_api_key(stored_key)  # Fallback: treat as plain text
        if _looks_like_gemini_api_key(key):
            return key
        # Cleanup stale/placeholder keys so status reflects reality.
        settings.pop("gemini_api_key", None)
        _save_settings(settings)

    env_key = _normalize_api_key(os.getenv("GEMINI_API_KEY"))
    if _looks_like_gemini_api_key(env_key):
        return env_key
    return None


def set_gemini_api_key(key: str):
    """Save a Gemini API key to persistent settings."""
    normalized = _normalize_api_key(key)
    if not normalized:
        raise ValueError("API key cannot be empty")
    settings = _load_settings()
    settings["gemini_api_key"] = _obfuscate(normalized)
    _save_settings(settings)


def delete_gemini_api_key():
    """Remove the stored Gemini API key."""
    settings = _load_settings()
    settings.pop("gemini_api_key", None)
    _save_settings(settings)


def get_genius_credentials() -> dict:
    """
    Retrieve all Genius credentials from settings or environment.
    Priority:
    1. settings.json
    2. Environment variables (GENIUS_CLIENT_ID, GENIUS_CLIENT_SECRET, GENIUS_ACCESS_TOKEN)
    """
    settings = _load_settings()
    
    def fetch(key, env_var):
        stored = settings.get(key)
        if stored:
            try:
                return _normalize_api_key(_deobfuscate(stored))
            except Exception:
                return _normalize_api_key(stored)
        return _normalize_api_key(os.getenv(env_var))

    creds = {
        "client_id": fetch("genius_client_id", "GENIUS_CLIENT_ID"),
        "client_secret": fetch("genius_client_secret", "GENIUS_CLIENT_SECRET"),
        "access_token": fetch("genius_access_token", "GENIUS_ACCESS_TOKEN"),
    }

    return creds


def set_genius_credentials(client_id: str = None, client_secret: str = None, access_token: str = None):
    """Save Genius credentials to persistent settings."""
    settings = _load_settings()
    
    if client_id is not None:
        settings["genius_client_id"] = _obfuscate(client_id.strip())
    if client_secret is not None:
        settings["genius_client_secret"] = _obfuscate(client_secret.strip())
    if access_token is not None:
        normalized = _normalize_api_key(access_token)
        if normalized:
            settings["genius_access_token"] = _obfuscate(normalized)

    _save_settings(settings)


def delete_genius_credentials():
    """Remove all stored Genius credentials."""
    settings = _load_settings()
    settings.pop("genius_client_id", None)
    settings.pop("genius_client_secret", None)
    settings.pop("genius_client_access_token", None) # legacy cleanup
    settings.pop("genius_access_token", None)
    settings.pop("genius_api_key", None) # legacy cleanup
    _save_settings(settings)
    
    os.environ.pop("GENIUS_ACCESS_TOKEN", None)


def get_strict_lrc_mode() -> bool:
    """
    Global lyric integrity mode.
    True  -> strict LRC only
    False -> allow unsynced/plain-text fallback
    """
    settings = _load_settings()
    value = settings.get("strict_lrc")

    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "1", "yes", "on"}:
            return True
        if lowered in {"false", "0", "no", "off"}:
            return False
    if isinstance(value, int):
        return bool(value)

    # Default is strict mode.
    return True


def set_strict_lrc_mode(strict_lrc: bool):
    """Persist global lyric integrity mode."""
    settings = _load_settings()
    settings["strict_lrc"] = bool(strict_lrc)
    _save_settings(settings)


def has_gemini_api_key() -> bool:
    """Check whether any Gemini API key is available."""
    return get_gemini_api_key() is not None


def get_ytdlp_state() -> dict:
    """Read persisted yt-dlp maintenance state."""
    settings = _load_settings()
    raw_state = settings.get("ytdlp_state")
    state = dict(raw_state) if isinstance(raw_state, dict) else {}
    return {
        "last_known_good_version": state.get("last_known_good_version"),
        "last_checked_at": state.get("last_checked_at"),
        "last_update_status": state.get("last_update_status"),
        "last_update_error": state.get("last_update_error"),
        "last_smoke_test_ok": bool(state.get("last_smoke_test_ok", False)),
    }


def set_ytdlp_state(state: dict):
    """Persist yt-dlp maintenance state."""
    settings = _load_settings()
    settings["ytdlp_state"] = dict(state)
    _save_settings(settings)


def update_ytdlp_state(**fields) -> dict:
    """Patch and persist yt-dlp maintenance state."""
    state = get_ytdlp_state()
    state.update(fields)
    set_ytdlp_state(state)
    return state


# ── Model Selection ───────────────────────────────────────────────────

# Available models with metadata for the UI
# Rate limits shown are for the free tier (as of early 2026)
AVAILABLE_MODELS = [
    {
        "id": "gemini-3-pro-preview",
        "name": "Gemini 3.0 Pro",
        "description": "Highest quality output - best for complex lyrics",
        "rate_limit": "5 RPM / 200 RPD",
        "pricing": "$3.50 / 1M tokens",
        "cost_per_song": "~$0.04 / song",
        "tier": "quality",
        "lifecycle": "preview",
    },
    {
        "id": "gemini-3-flash-preview",
        "name": "Gemini 3.0 Flash",
        "description": "Next-gen speed and efficiency",
        "rate_limit": "15 RPM / 1,500 RPD",
        "pricing": "$0.075 / 1M tokens",
        "cost_per_song": "< $0.01 / song",
        "tier": "preview",
        "lifecycle": "preview",
    },
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "description": "Balanced performance and latency",
        "rate_limit": "15 RPM / 1,500 RPD",
        "pricing": "$0.075 / 1M tokens",
        "cost_per_song": "< $0.01 / song",
        "tier": "fast",
        "lifecycle": "stable",
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "description": "Stable and reliable - current standard",
        "rate_limit": "15 RPM / 1,500 RPD",
        "pricing": "$0.075 / 1M tokens",
        "cost_per_song": "< $0.01 / song",
        "tier": "recommended",
        "lifecycle": "stable",
    },
]

DEFAULT_MODEL = "gemini-2.0-flash"


def get_available_models() -> list[dict]:
    """Return the list of available Gemini models."""
    return AVAILABLE_MODELS


def get_model_metadata(model_id: str) -> dict | None:
    """Return metadata for a known model id."""
    for model in AVAILABLE_MODELS:
        if model["id"] == model_id:
            return model
    return None


def get_stable_gemini_model() -> str:
    """Return the preferred stable model id."""
    for model in AVAILABLE_MODELS:
        if model.get("lifecycle") == "stable":
            return model["id"]
    return DEFAULT_MODEL


def get_gemini_model() -> str:
    """Get the user's preferred Gemini model (defaults to gemini-2.0-flash)."""
    settings = _load_settings()
    selected = settings.get("gemini_model", DEFAULT_MODEL)
    valid_ids = {m["id"] for m in AVAILABLE_MODELS}
    if selected in valid_ids:
        return selected

    # Heal stale/invalid saved model IDs from older configs.
    settings["gemini_model"] = DEFAULT_MODEL
    _save_settings(settings)
    return DEFAULT_MODEL


def set_gemini_model(model_id: str):
    """Set the user's preferred Gemini model."""
    valid_ids = {m["id"] for m in AVAILABLE_MODELS}
    if model_id not in valid_ids:
        raise ValueError(f"Unknown model: {model_id}")
    settings = _load_settings()
    settings["gemini_model"] = model_id
    _save_settings(settings)
