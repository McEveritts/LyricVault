# LyricVault v0.3.2 Clean-Machine Smoke Test

## Environment
- Fresh Windows 11 user profile or VM.
- No prior LyricVault installation.
- Internet enabled.

## Artifacts
- `LyricVault Setup 0.3.2.exe`
- `LyricVault 0.3.2.exe`

## Installer Path
1. Run `LyricVault Setup 0.3.2.exe`.
2. Launch app from Start Menu/Desktop.
3. Confirm app opens without crash.
4. In Settings, save valid Gemini API key.
5. In Discover, ingest one track.
6. Verify playback, queue controls, lyrics research, and app close/reopen persistence.

## Portable Path
1. Run `LyricVault 0.3.2.exe` from a non-admin folder.
2. Confirm app opens without install prompts.
3. Ingest one track and play it.
4. Verify queue actions (`Play Next`, `Add to Queue`) and lyrics overlay behavior.
5. Close and reopen portable binary; verify library still behaves correctly.

## Pass Criteria
- No startup failures.
- No backend launch errors.
- Playback and queue transitions are correct.
- Lyrics UI does not hard reload or crash.
- Settings save/reload works.

## Evidence to Capture
- One screenshot each: home, library playback, lyrics overlay, settings.
- Notes on any regressions with timestamp and repro steps.
