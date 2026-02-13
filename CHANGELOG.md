# Changelog

All notable changes to the LyricVault project will be documented in this file.

## [0.4.4] - 2026-02-13

### Added

- **Global Footer**: Integrated a centralized `AppFooter` for consistent versioning across all views.
- **Security Gauntlet**:
  - Restricted backend API binding to `127.0.0.1` (localhost only).
  - Implemented a strict Content Security Policy (CSP) in `index.html`.
  - Added security headers: `X-Content-Type-Options: nosniff` and `X-Frame-Options: DENY`.
  - Enabled Electron `sandbox` mode for the renderer process.
  - Served the production renderer via a privileged `app://.` protocol to keep CORS strict without allowing `Origin: null` / `file://` in production.
- **Installer Branding**: Integrated custom header + sidebar assets for the Windows NSIS installer.

### Changed

- **Codebase Hygiene**: Purged 50+ obsolete artifacts, logs, and documentation files to streamline the repository.
- **Version Management**: Consolidated versioning to derive from the root `package.json` (frontend compile-time + backend runtime via Electron env).
- **UI Cleanup**: Removed redundant footer styling from `SettingsView`.

### Fixed

- **Library Stability**: Resolved an `undefined categories` reference in `LibraryGrid` causing potential runtime crashes.
- **Database Consolidation**: Retired legacy `lyricvault.db` (v1) in favor of the current v2 schema.

## [0.4.3] - 2026-02-12

### Added

- Lightweight Genius token validation endpoint: `POST /settings/test-genius-key` (alias: `/settings/test-genius-credentials`).
- In-app Genius "Test" action with async status feedback in Settings.
- Lyric click-to-seek interaction for synced lines in `LyricsOverlay`.

### Changed

- Branding footer text updated to "Designed by McEveritts".
- Sidebar collapse toggle moved into the sidebar header region.
- Integrated Queue redesigned as a docked expansion of the Now Playing bar.
- Aura visualizer upgraded from legacy bars to fluid motion-blur wave rendering with premium overlay.
- Frontend Genius credential UX refined for multi-field persistence and test flow.
- Version surfaces and release metadata bumped from `0.4.2` to `0.4.3`.

### Fixed

- Library sort dropdown clipping by increasing overlay z-index.
- White-box flash during tab/view transitions by preserving dark background continuity.

## [0.4.2] - 2026-02-12

### Added

- Global lyrics integrity mode (`strict_lrc`) with new settings endpoints:
  - `GET /settings/lyrics-mode`
  - `POST /settings/lyrics-mode`
- Explicit `lyrics_status: unsynced` contract when fallback mode is enabled.
- Social discovery bucket support with `platform=social` and `social_sources` query filter.
- Startup legacy lyric migration pass with bounded batch queueing and idempotent dedupe keys.

### Changed

- `SongResponse` now includes `lyrics_synced` in library responses.
- Lyric status contract expanded to `ready|processing|unsynced|unavailable`.
- Worker retry flow now uses explicit `retrying` status for backoff windows.
- Processing/Activity views now consume strict active/history job contracts.
- Song Detail now surfaces synced vs unsynced badges and improved lyric export visibility.
- Version surfaces and release metadata bumped from `0.3.5` to `0.4.2`.

## [0.3.5] - 2026-02-12

### Changed

- Bumped application version baseline from `0.3.2` to `0.3.5`.
- Updated runtime version surfaces across Electron preload, backend API metadata, and frontend Settings footer.
- Updated release-facing documentation references and artifact naming to `0.3.5`.

## [0.3.2] - 2026-02-12

### Added

- Playback queue controls: `Play Next` and `Add to Queue` actions integrated in Library and Discovery.
- API contract coverage for CORS origin gating and stream URL host correctness.

### Changed

- Player navigation now honors queue-aware transitions, repeat states, and previous-track history.
- Song detail lyric research refreshes in-app state instead of hard reloading the page.
- Release documentation updated to reference `0.3.2` installer and portable artifacts.

### Security

- CORS origin policy gates permissive `file://` and `null` origins to development mode only.

## [0.3.0] - 2026-02-11

### Added

- **Model Selector**: Choose Gemini Flash / Pro / Lite with tier badges and rates visible in Settings.
- **Multimodal Transcription**: Standard audio fallback when web lyric research fails.
- **API Key Tester**: Validate Gemini keys in-app before saving.
- **Icon Pipeline**: Algorithmic app icon generation in `scripts/`.

### Changed

- **Space Bass UI**: Refined glassmorphism + gold accent theme across Settings and core views.
- **Task Safety**: Background ingest/research now guarded by locks and smarter retries (500/503 + rate limits).
- **Dynamic FFmpeg Discovery**: Automatically locates FFmpeg from WinGet/system PATH.
- **Docs & Versioning**: Synchronized project version to 0.3.0.

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
