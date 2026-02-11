# Changelog

All notable changes to the LyricVault project will be documented in this file.

## [0.1.5] - 2026-02-11

### Added

- **Centralized API Config**: All frontend components now use a single `API_BASE` constant — no more hardcoded `localhost` URLs.
- **AI Safety Settings**: Permissive safety thresholds prevent lyrics from being silently blocked by content filters.
- **System Instructions**: Gemini requests use dedicated system instructions for Research and Transcription tasks, improving accuracy and reducing token usage.
- **Server Error Retries**: Automatic retry with exponential backoff now covers 500/503 transient errors in addition to rate limits.
- **Duplicate Detection**: Re-ingesting a URL that already exists in the library returns the existing song instantly instead of duplicating it.
- **Dynamic FFmpeg Discovery**: FFmpeg is now discovered automatically from WinGet packages for any user, not just a hardcoded path.

### Changed

- **Thread-Safe Task Tracking**: Background task state is now guarded by a threading lock to prevent race conditions.
- **Deprecated API Migration**: Replaced `declarative_base()` with modern `DeclarativeBase` class and `datetime.utcnow` with timezone-aware timestamps.
- **Leaner Dependencies**: Removed unused `beautifulsoup4` and `spotipy` packages.
- **Player UI**: Previous/Next buttons are now visually disabled with "coming soon" tooltips instead of appearing functional.
- **Discovery View**: Duration display gracefully handles missing values (`--:--`).
- **CORS Policy**: Tightened from wildcard `*` to specific allowed origins.

## [0.1.4] - 2026-02-11

### Added

- **API Key Testing**: New button in Settings to validate Gemini API keys before saving.
- **Multimodal AI Transcription**: Gemini 2.0 can now transcribe lyrics directly from audio files.
- **Space Bass Branding**: Official golden-accented logo and UI theme integration.
- **Release Automation Improvements**: Added descriptive artifact names for Installer and Portable builds.

## [0.1.3] - 2026-02-11

### Added

- Early integration of Multimodal AI capabilities.
- Backend infrastructure for audio-to-text processing.

## [0.1.2] - 2026-02-11

### Added

- **Universal Discovery**: "Magic Paste" support for YouTube, Spotify, and SoundCloud.
- **Portable Mode**: Standalone `.exe` support for USB/Portable usage.
- **Live Processing View**: Progress tracking for downloads and AI tasks.

## [0.1.1] - 2026-02-11

### Fixed

- Filename encoding issues for Windows downloads.
- Database session leak fixes and performance optimizations.

## [0.1.0] - 2026-02-03

### Added

- Initial release with Gemini AI lyric research.
- React-based UI with Google Pixel design language.
- Local audio streaming and library management.
