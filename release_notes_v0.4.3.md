# LyricVault v0.4.3 Release Notes

Release date: 2026-02-12

## Highlights
- Branding polish completed: footer now reads "Designed by McEveritts" and sidebar header flow was refined.
- Added lightweight Genius token validation with in-app test flow and secure multi-field credential persistence.
- Integrated Queue redesigned as a docked expansion of the Now Playing bar with fluid transitions.
- Aura visualizer upgraded to motion-blur fluid waves plus premium title/artist overlay styling.
- Added lyric click-to-seek interaction in synced lyrics view with hover-state feedback.
- Resolved key UI regressions: sort dropdown clipping and white flash during tab/view transitions.

## Backend + Contract Integrity
- Verified atomic job claim and retry behavior in worker pipeline.
- Confirmed robust error-handling paths in background processing.
- Confirmed secure credential obfuscation/persistence behavior for settings storage.
- Re-validated frontend/backend contract alignment, including delete endpoints and job polling flows.

## Verification
- Backend tests executed in virtual environment; release gate tests passed including `test_ytdlp_system_endpoint.py`.
- LRC validator behavior confirmed for centisecond/millisecond normalization and strictly increasing timestamps.
- Manual verification completed for:
  - Integrated queue expansion UX.
  - Lyric click-to-seek behavior.
  - Branding update surfaces.
  - Genius credential test/save flows.
  - yt-dlp update with smoke-test rollback behavior.

## Artifacts
- `LyricVault Setup 0.4.3.exe`
- `LyricVault 0.4.3.exe`
- `SHA256SUMS-v0.4.3.txt`
