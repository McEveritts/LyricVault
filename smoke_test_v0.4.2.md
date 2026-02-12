# LyricVault v0.4.2 Clean-Machine Smoke Test

## Environment
- Fresh Windows 11 user profile or VM.
- No prior LyricVault installation.
- Internet enabled.

## Artifacts
- `LyricVault Setup 0.4.2.exe`
- `LyricVault 0.4.2.exe`

## Installer Path
1. Run `LyricVault Setup 0.4.2.exe`.
2. Launch app from Start Menu/Desktop.
3. Confirm app opens without crash and title shows `LyricVault`.
4. Confirm native menu bar auto-hides.
5. In Settings -> API, verify Lyrics Integrity toggle is present and defaults to strict mode.
6. In Discover, ingest one track and confirm auto-route to Processing Queue.
7. Verify job transitions to Activity after completion.

## Portable Path
1. Run `LyricVault 0.4.2.exe` from a non-admin folder.
2. Confirm app opens without install prompts.
3. Test strict mode ON with a track that resolves to non-LRC text: should show unavailable (not ready).
4. Toggle strict mode OFF and retry lyric research: unsynced status should be visible.
5. Open Song Detail and verify synced-line scroll only occurs on timed LRC tracks.
6. Verify Social Media discovery bucket, source subfilters, and source tags render.

## Pass Criteria
- No startup failures.
- No backend launch errors.
- Queue/history split is correct (`pending/processing/retrying` vs `completed/failed`).
- Lyrics mode toggle persists after app restart.
- No white flash during major route transitions.
- Reported app version surfaces display `0.4.2`.

## Evidence to Capture
- Screenshots: Settings toggle, Processing queue, Activity log, Song Detail synced/unsynced states, Social Media discover mode.
- Notes on any regressions with timestamp and repro steps.
