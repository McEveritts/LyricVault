# LyricVault v0.4.2 Release Notes

Release date: 2026-02-12

## Highlights
- Added global lyrics integrity mode with strict LRC default and optional unsynced fallback.
- Expanded lyric status contract to `ready`, `processing`, `unsynced`, `unavailable`.
- Added social discovery bucket flow with Instagram/TikTok/Facebook source subfilters.
- Hardened worker queue behavior with explicit `retrying` status and startup legacy lyric migration batching.
- Completed full `0.4.2` version-surface synchronization across backend, frontend, and Electron.

## Verification
- Backend release tests pass, including lyric mode status/migration coverage.
- Frontend lint and production build pass.
- Processing and Activity views respect queue/history separation.
- Strict mode ON rejects invalid non-LRC as ready; strict mode OFF exposes unsynced fallback.

## Artifacts
- `LyricVault Setup 0.4.2.exe`
- `LyricVault 0.4.2.exe`
- `SHA256SUMS-v0.4.2.txt`
