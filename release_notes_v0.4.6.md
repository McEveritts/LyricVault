# LyricVault v0.4.6

This is a **build + packaging fix** release for Windows. It also includes all user-facing improvements from **v0.4.5** (which was tagged but not successfully shipped due to Windows build failures).

## Build & Packaging (Windows)

- Fixed `winCodeSign` extraction failures on Windows by requiring **Windows Developer Mode** for symlink support during the build process.
- Refactored the NSIS include script to avoid fatal MUI macro ordering warnings during `makensis` compilation.
- Restored full `extraResources` packaging so the shipped app includes the Python backend (`backend/`), embedded Python (`python-embed/`), and FFmpeg (`ffmpeg/`).
- Normalized artifact naming to dot-separated format:
  - `LyricVault.Setup.0.4.6.exe`
  - `LyricVault.0.4.6.exe`

## Features (From v0.4.5)

- Lyrics Overlay media controls (hover Play/Pause, Skip, Seek) in the full-screen lyrics view.
- Activity log entries are clickable to navigate to the library, with clearer source attribution (**Official Web** vs **AI Generated**).
- Lyric source badges in the overlay header (Official, AI Researched, AI Transcribed).
- Playback "spinning" issue fixed by refining the app's Content Security Policy (CSP) to allow local media streaming.

## Downloads

Windows artifacts:

- Installer: `LyricVault.Setup.0.4.6.exe`
- Portable: `LyricVault.0.4.6.exe`

Use `release_checksums_v0.4.6.txt` to verify SHA256 checksums for all attached assets.

