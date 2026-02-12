# LyricVault v0.3.2 Release Notes

Release date: 2026-02-12

## Highlights
- Hardening pass completed for stability, security, and release hygiene.
- Playback flow finalized with queue integration and robust next/previous behavior.
- CORS origin policy hardened for release mode.
- Pytest hygiene cleanup completed to prevent accidental test discovery failures.

## Security and Reliability
- SQLite datetime adapter/converter compatibility updated for modern Python runtime behavior.
- Electron backend spawn hardened (`shell: false`, argument-safe spawn usage, platform-safe PATH handling).
- Frontend race-condition guardrails added for rapid song switching and state refresh.

## Verification
- Backend regression suite: 13/13 passed.
- Frontend build: passed.
- Release packaging: installer + portable artifacts generated successfully.

## Artifacts
- `LyricVault Setup 0.3.2.exe`
- `LyricVault 0.3.2.exe`
- `SHA256SUMS-v0.3.2.txt`
