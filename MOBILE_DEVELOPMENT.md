# Mobile Development Split (Flutter)

Desktop (Electron/React) and Mobile (Flutter) development are split to avoid build + dependency confusion.

## Electron Desktop (Frozen)

- Path: `Antigravity` (Electron worktree folder)
- Versioning: root `package.json` (currently `0.4.82`)
- Status: frozen at `v0.4.82` (final Electron/React release)
- Build: `npm run dev`, `npm run dist`

## Flutter Clients (Active)

- Path: `Antigravity_mobile` (sibling worktree)
- Branch: `mobile/v0.5.0`
- Repo layout:
  - `desktop_client/` (Flutter Desktop, Windows-first)
  - `mobile_client/` (Flutter Mobile baseline)
  - `packages/lyricvault_core/` (shared models/API/playback)

### Desktop Flutter prerequisites (Windows)

- Visual Studio 2022: install the "Desktop development with C++" workload (required by Flutter Windows builds).
- Python backend: the desktop client refuses to run without the backend.
  - Preferred: `scripts/setup-python.ps1` (downloads `python-embed/` + `ffmpeg/` for local runs/packaging).
  - Alternative: install Python and ensure `python` is available on PATH.

### Why a worktree?

- Keeps Node/Python desktop build outputs and Flutter build outputs separated by folder.
- Lets you switch contexts without stashing or accidentally mixing version bumps.
