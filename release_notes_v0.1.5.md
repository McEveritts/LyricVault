# 🚀 LyricVault v0.1.5 — Resilience & API Hardening

This release fortifies every layer of the stack — from AI communication to background task safety — making LyricVault significantly more reliable in the real world.

## ✨ Highlights

### 🧠 Smarter AI Communication

- **System Instructions**: Research and Transcription now use dedicated system prompts, improving accuracy and reducing wasted tokens.
- **Safety Settings**: Permissive safety thresholds ensure song lyrics aren't silently blocked by content filters (common with explicit or edgy tracks).
- **Server Error Retries**: In addition to rate limits, Gemini 500/503 errors are now automatically retried with exponential backoff.

### 🔒 Backend Resilience

- **Thread-Safe Tasks**: Background task state is now protected by a threading lock — no more race conditions when multiple songs process simultaneously.
- **Duplicate Detection**: Re-pasting a URL that's already in your library returns the existing song instantly.
- **Dynamic FFmpeg Discovery**: FFmpeg is discovered automatically from WinGet packages, working for any Windows user.
- **CORS Tightened**: Origin whitelist replaces the previous wildcard `*` policy.

### 🎨 Frontend Polish

- **Centralized API Config**: Every component now imports from a single `API_BASE` constant — no more hardcoded localhost URLs.
- **Player UI**: Previous/Next track buttons are now visually disabled with "coming soon" tooltips.
- **Discovery View**: Graceful `--:--` display when duration is unavailable.

### 🧹 Housekeeping

- Removed unused dependencies: `beautifulsoup4`, `spotipy`
- Migrated deprecated SQLAlchemy `declarative_base()` → modern `DeclarativeBase` class
- Replaced `datetime.utcnow` with timezone-aware `datetime.now(timezone.utc)`

## 📦 Downloads

| File | Description |
| :--- | :--- |
| **LyricVault Setup 0.1.5.exe** | Windows Installer — installs to Program Files with Start Menu shortcut |
| **LyricVault 0.1.5.exe** | Portable — run anywhere, no installation required |

---
*Build your sanctuary. Own your music.*
