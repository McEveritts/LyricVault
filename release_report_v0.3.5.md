# LyricVault v0.3.5 Release Verification Report

## 1. Executive Summary
- Release Status: PASSED (local supercheck and packaging)
- Target Version Tag: `v0.3.5`
- Verification Date: 2026-02-12
- Baseline Source: `release_report_v0.3.2.md` plus current `v0.3.5` validation run

LyricVault `v0.3.5` carries forward the hardened `v0.3.2` quality bar and re-validates frontend, backend, and packaging after version-surface updates.

## 2. Carry-Forward and Current Validation
### Carry-forward from `v0.3.2`
- Frontend accessibility hardening and visualizer safety checks.
- Backend CORS gating and path/security contract checks.
- Queue/playback integration and hygiene pass outcomes.

### Current `v0.3.5` validation
- Frontend:
  - `npm --prefix frontend run lint` PASSED
  - `npm run build:frontend` PASSED
- Backend:
  - `backend\\venv\\Scripts\\python.exe -m compileall -q -x "backend[\\/]venv" backend` PASSED
  - `backend\\venv\\Scripts\\python.exe -m pytest backend/test_api_contract.py backend/test_path_traversal.py backend/test_ffmpeg_winget.py backend/test_worker_heartbeat.py` PASSED (`8 passed`)
- Packaging:
  - `npm run dist` PASSED
  - Generated `0.3.5` installer and portable binaries.

## 3. Build Artifacts (`release/`)
- `LyricVault Setup 0.3.5.exe`
- `LyricVault Setup 0.3.5.exe.blockmap`
- `LyricVault 0.3.5.exe`
- `SHA256SUMS-v0.3.5.txt`
- `SHA256SUMS-v0.3.5-upload.txt`

## 4. Checksums (SHA256)
```text
0cfe6ddcfa2d926075756f5487c9397a2da333952037f313e2fdd97a8e0f3af9 *LyricVault Setup 0.3.5.exe
7fb2a232d643d65bd163aa7a37c7a050b515df95b2f9231a816c74f41b963127 *LyricVault 0.3.5.exe
```

Canonical files updated:
- `release/SHA256SUMS-v0.3.5.txt`
- `release/SHA256SUMS-v0.3.5-upload.txt`
- `release_checksums_v0.3.5.txt`

## 5. Version-Surface Alignment
Updated to `0.3.5` in:
- `package.json`
- `package-lock.json`
- `frontend/package.json`
- `frontend/package-lock.json`
- `electron/preload.js`
- `backend/main.py`
- `frontend/src/components/SettingsView.jsx`
- `README.md`
- `CHANGELOG.md`

## 6. Release Integrity Notes
- `v0.3.2` reports remain historical context only.
- `v0.3.5` files, prompts, artifacts, and checksums are now the active release baseline.
- Final push/tag action should target `v0.3.5` only.
