"""
SettingsService - Manages persistent app settings stored locally.
Stores user preferences including their Gemini API key in a JSON file
in the OS-appropriate user data directory.
"""

import json
import os
import base64
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
            return _deobfuscate(stored_key)
        except Exception:
            return stored_key  # Fallback: treat as plain text

    return os.getenv("GEMINI_API_KEY")


def set_gemini_api_key(key: str):
    """Save a Gemini API key to persistent settings."""
    settings = _load_settings()
    settings["gemini_api_key"] = _obfuscate(key)
    _save_settings(settings)


def delete_gemini_api_key():
    """Remove the stored Gemini API key."""
    settings = _load_settings()
    settings.pop("gemini_api_key", None)
    _save_settings(settings)


def has_gemini_api_key() -> bool:
    """Check whether any Gemini API key is available."""
    return get_gemini_api_key() is not None


# ── Model Selection ───────────────────────────────────────────────────

# Available models with metadata for the UI
# Rate limits shown are for the free tier (as of early 2026)
AVAILABLE_MODELS = [
    {
        "id": "gemini-3.0-pro",
        "name": "Gemini 3.0 Pro",
        "description": "Highest quality output — best for complex lyrics",
        "rate_limit": "5 RPM / 200 RPD",
        "tier": "quality",
    },
    {
        "id": "gemini-3.0-flash",
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
    return settings.get("gemini_model", DEFAULT_MODEL)


def set_gemini_model(model_id: str):
    """Set the user's preferred Gemini model."""
    valid_ids = {m["id"] for m in AVAILABLE_MODELS}
    if model_id not in valid_ids:
        raise ValueError(f"Unknown model: {model_id}")
    settings = _load_settings()
    settings["gemini_model"] = model_id
    _save_settings(settings)
