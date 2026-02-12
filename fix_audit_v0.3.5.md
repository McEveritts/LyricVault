# LyricVault v0.3.5 Consolidated Fix Audit

Date: 2026-02-12
Scope: Compile all known release context and apply all safe, non-breaking fixes.

## Applied Fixes

1. Version surface synchronization to `0.3.5`
- Updated root and frontend versions in:
  - `package.json`
  - `package-lock.json`
  - `frontend/package.json`
  - `frontend/package-lock.json`
- Updated runtime version strings in:
  - `backend/main.py`
  - `electron/preload.js`
  - `frontend/src/components/SettingsView.jsx`

2. Documentation and release collateral updates
- Updated baseline docs:
  - `README.md` (rewritten clean, ASCII-safe, no mojibake)
  - `CHANGELOG.md` (added `0.3.5` entry)
- Added `0.3.5` release docs:
  - `release_notes_v0.3.5.md`
  - `release_publish_v0.3.5.md`
  - `smoke_test_v0.3.5.md`
- Added `0.3.5` gate prompts:
  - `gemini_prompt_v0.3.5_frontend_gate.md`
  - `gemini_prompt_v0.3.5_backend_gate.md`
  - `gemini_prompt_v0.3.5_supercheck_release_pro.md`

3. Text/encoding hygiene hardening
- Fixed packaging metadata text artifacts:
  - `electron-builder.yml` copyright line normalized to ASCII.
  - `package.json` description normalized to ASCII-safe punctuation.
- Cleaned comment/header text in:
  - `electron/main.js` (normalized section comments)

4. Frontend hygiene
- Removed non-essential auth lifecycle console noise in:
  - `frontend/src/contexts/AuthContext.jsx`

5. Release evidence and reporting
- Added preserved historical context report:
  - `release_report_v0.3.2.md`
- Added current carry-forward verification report:
  - `release_report_v0.3.5.md`
- Generated and saved canonical `0.3.5` checksums:
  - `release_checksums_v0.3.5.txt`
  - `release/SHA256SUMS-v0.3.5.txt`
  - `release/SHA256SUMS-v0.3.5-upload.txt`

## Validation Results

- `npm --prefix frontend run lint` -> PASS
- `npm run build:frontend` -> PASS
- `backend\\venv\\Scripts\\python.exe -m compileall -q -x "backend[\\/]venv" backend` -> PASS
- `backend\\venv\\Scripts\\python.exe -m pytest backend/test_api_contract.py backend/test_path_traversal.py backend/test_ffmpeg_winget.py backend/test_worker_heartbeat.py` -> PASS (`8 passed`)
- `npm run dist` -> PASS (`LyricVault Setup 0.3.5.exe`, `LyricVault 0.3.5.exe` generated)

## Current 0.3.5 SHA256

- `0cfe6ddcfa2d926075756f5487c9397a2da333952037f313e2fdd97a8e0f3af9 *LyricVault Setup 0.3.5.exe`
- `7fb2a232d643d65bd163aa7a37c7a050b515df95b2f9231a816c74f41b963127 *LyricVault 0.3.5.exe`

## Intentional Historical/Archive Exceptions

These are retained intentionally and are not release blockers for `0.3.5`:
- `gemini_prompt_v0.3.2_*.md` (historical prompts)
- `release_report_v0.3.2.md` (historical verification context)
- `CHANGELOG.md` historical `0.3.2` entry content
- `LyricVault_Full_Text.txt` snapshot artifact containing legacy text and bundled/generated content
- ignored local release artifacts under `release/` for older versions
