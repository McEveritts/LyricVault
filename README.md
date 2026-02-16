# LyricVault

LyricVault is a local-first music player focused on personal library control, high-performance playback UX, and AI-assisted lyric workflows.

## Desktop Stack (Current)

- Shell/Core: Tauri + Rust
- Frontend: SolidJS + Vite + TypeScript
- Data: SQLite (`%APPDATA%\\LyricVault\\lyricvault_v2.db`)
- Media pipeline: bundled `yt-dlp` + `ffmpeg`
- Runtime API: typed Tauri IPC + event stream (`lyricvault:event`)

## Legacy Stack (Archived)

The previous Electron/React/Python desktop stack remains in this repository for historical reference but is no longer the primary runtime.

## Quick Start (Pre-Alpha Setup)

If you are a pre-alpha tester or just cloned the repo, run the automated setup:

```powershell
./SETUP_PREALPHA.ps1
```

This script will check your toolchain, install dependencies, and fetch runtime assets (Python/FFmpeg).

---

## Project Layout

- `apps/desktop/` SolidJS desktop frontend + Tauri app wrapper
- `apps/desktop/src-tauri/` Tauri shell + command/event bridge
- `crates/lv_core/` SQLite, migrations, library/job domain operations
- `crates/lv_settings/` settings persistence + secret handling
- `crates/lv_media/` media search/status + yt-dlp orchestration
- `crates/lv_lyrics/` lyric research interface
- `crates/lv_events/` typed in-process event bus
- `crates/lv_jobs/` shared job/song event emit helpers

## Development

### Prerequisites (Windows)

- Node.js 20+
- Rust toolchain (`rustup`, `cargo`, `rustc`)
- Visual Studio C++ build tools (for Tauri/WebView2)
- Runtime assets prepared by:
  - `npm run runtime:fetch`
  - `npm run setup:python` (compat alias)

### Run desktop app

```bash
npm run dev
```

### Build installer artifacts

```bash
npm run dist
```

### Build desktop bundles directly

```bash
npm run tauri build
```

### Diagnose desktop build environment (Windows)

```bash
npm run doctor:desktop-env
```

If you encounter toolchain errors (e.g., missing `link.exe`), consult `docs/migration/windows_toolchain.md`.

## Migration Notes

- Desktop no longer starts a localhost HTTP backend in normal operation.
- Existing user data is preserved in place under `%APPDATA%\\LyricVault`.
- Stream URLs are provided through `lvmedia://` protocol instead of `http://127.0.0.1/...`.

## License

MIT
