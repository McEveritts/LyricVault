# LyricVault v0.4.3 Clean-Machine Smoke Test

## Environment
- Fresh Windows 11 user profile or VM.
- No prior LyricVault installation.
- Internet enabled.

## Artifacts
- `LyricVault Setup 0.4.3.exe`
- `LyricVault 0.4.3.exe`

## Installer Path
1. Run `LyricVault Setup 0.4.3.exe`.
2. Launch app from Start Menu/Desktop.
3. Confirm app opens without crash and title shows `LyricVault`.
4. Confirm footer shows `LyricVault v0.4.3 • Designed by McEveritts`.
5. Open Settings -> API and verify Genius credentials include a functional `Test` action.
6. Start playback and confirm queue drawer expands from the Now Playing bar (not floating).

## Portable Path
1. Run `LyricVault 0.4.3.exe` from a non-admin folder.
2. Confirm app opens without install prompts.
3. In Library, open sort dropdown and verify no clipping behind parent containers.
4. In Lyrics overlay, click a synced lyric line and verify playback seeks to that timestamp.
5. In Visualizer deck, verify fluid wave rendering and title/artist premium overlay.
6. Switch between major tabs quickly and confirm no white flash appears.

## Resilience Checks
1. Open Settings -> System and run `Check & Update yt-dlp`.
2. Confirm terminal status is deterministic (`success`, `rolled_back`, or `failed`).
3. If update fails smoke test, confirm rollback preserves ingest/search behavior.

## Pass Criteria
- No startup failures.
- Queue expansion is smooth and docked to player bar.
- Genius credential save/test/delete cycle works without stale UI state.
- Lyric click-to-seek is accurate and only active for synced lyrics.
- Visualizer renders fluid waves without fallback to legacy bars.
- No backend launch errors.
- Reported app version surfaces display `0.4.3`.

## Evidence to Capture
- Screenshots: branded footer, queue expansion, Genius test success/failure states, lyric seek interaction, visualizer overlay.
- Notes on any regressions with timestamp and repro steps.
