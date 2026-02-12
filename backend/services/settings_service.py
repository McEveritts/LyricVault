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


def _obfuscate(value: str) -> str:
    """Simple base64 obfuscation for at-rest storage (not true encryption)."""
    return base64.b64encode(value.encode("utf-8")).decode("utf-8")


def _deobfuscate(value: str) -> str:
    """Reverse the base64 obfuscation."""
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


def get_genius_api_key() -> str | None:
    """
    Retrieve the Genius API key priority:
    1. User-configured key in settings.json
    2. GENIUS_ACCESS_TOKEN environment variable
    """
    settings = _load_settings()
    stored_key = settings.get("genius_api_key")
    if stored_key:
        try:
            key = _normalize_api_key(_deobfuscate(stored_key))
        except Exception:
            key = _normalize_api_key(stored_key)
        
        if key:
            # Important: Export to env for syncedlyrics to use automatically
            os.environ["GENIUS_ACCESS_TOKEN"] = key
            return key

    env_key = _normalize_api_key(os.getenv("GENIUS_ACCESS_TOKEN"))
    if env_key:
        return env_key
    return None


def set_genius_api_key(key: str):
    """Save a Genius API key to persistent settings."""
    normalized = _normalize_api_key(key)
    if not normalized:
        raise ValueError("API key cannot be empty")
    settings = _load_settings()
    settings["genius_api_key"] = _obfuscate(normalized)
    _save_settings(settings)
    # Update env immediately for current process
    os.environ["GENIUS_ACCESS_TOKEN"] = normalized


def delete_genius_api_key():
    """Remove the stored Genius API key."""
    settings = _load_settings()
    settings.pop("genius_api_key", None)
    _save_settings(settings)
    os.environ.pop("GENIUS_ACCESS_TOKEN", None)


def has_gemini_api_key() -> bool:
    """Check whether any Gemini API key is available."""
    return get_gemini_api_key() is not None


# ── Model Selection ───────────────────────────────────────────────────

# Available models with metadata for the UI
# Rate limits shown are for the free tier (as of early 2026)
AVAILABLE_MODELS = [
    {
        "id": "gemini-3-pro-preview",
        "name": "Gemini 3.0 Pro",
        "description": "Highest quality output — best for complex lyrics",
        "rate_limit": "5 RPM / 200 RPD",
        "tier": "quality",
    },
    {
        "id": "gemini-3-flash-preview",
        "name": "Gemini 3.0 Flash",
        "description": "Next-gen speed and efficiency",
        "rate_limit": "15 RPM / 1,500 RPD",
        "tier": "preview",
    },
    {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "description": "Balanced performance and latency",
        "rate_limit": "15 RPM / 1,500 RPD",
        "tier": "fast",
    },
    {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "description": "Stable and reliable — current standard",
        "rate_limit": "15 RPM / 1,500 RPD",
        "tier": "recommended",
    },
]

DEFAULT_MODEL = "gemini-2.0-flash"


def get_available_models() -> list[dict]:
    """Return the list of available Gemini models."""
    return AVAILABLE_MODELS


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
