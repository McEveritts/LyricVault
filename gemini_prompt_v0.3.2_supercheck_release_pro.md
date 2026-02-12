# Gemini 3 Pro Prompt: LyricVault v0.3.2 Final Supercheck + Build + Push Gate

You are acting as a release engineering lead. Execute a final zero-drift release gate for LyricVault v0.3.2 with evidence-backed results only.

## Mission
Perform one final comprehensive supercheck across backend + frontend, then prepare release packaging and push readiness with no hidden assumptions.

## Required Inputs
- `gemini_prompt_v0.3.2_frontend_gate.md`
- `gemini_prompt_v0.3.2_backend_gate.md`

Treat both as mandatory sub-checklists and enforce their quality bars first.

## Non-Negotiable Rules
1. Never claim success without command output evidence.
2. Never claim a fix without file:line references.
3. Do not skip failed checks; either fix or return NO-GO with reason.
4. Preserve existing release versioning (`0.3.2`) unless explicitly told otherwise.

## Execution Plan
1. Run frontend gate from `gemini_prompt_v0.3.2_frontend_gate.md`.
2. Run backend gate from `gemini_prompt_v0.3.2_backend_gate.md`.
3. Run final integrated supercheck:
- `npm --prefix frontend run lint`
- `npm run build:frontend`
- `backend\\venv\\Scripts\\python.exe -m compileall -q -x "backend[\\\\/]venv" backend`
- `$env:LYRICVAULT_ENV='development'; backend\\venv\\Scripts\\python.exe -m pytest backend/test_api_contract.py backend/test_path_traversal.py backend/test_ffmpeg_winget.py backend/test_worker_heartbeat.py`
- `rg -n "Â|â€”|â|ð|Ã|¤|¢|¬|\\\\uFFFD|�" frontend/src backend electron package.json README.md CHANGELOG.md release_notes_v0.3.2.md release_publish_v0.3.2.md smoke_test_v0.3.2.md`
- `rg -n "TODO|FIXME|XXX|debugger" frontend/src backend electron`
4. Build release artifacts:
- `npm run dist`
5. Regenerate checksums for v0.3.2 artifacts and verify against committed checksum files.
6. Validate git state for release:
- Ensure intended files are committed.
- Ensure tag `v0.3.2` points to intended release commit.
- Ensure branch/tag push commands are ready.

## Push Method (Mirror Existing v0.3.1/v0.3.2 Flow)
Use this exact command sequence if GO:
- `git push origin HEAD`
- `git tag -d v0.3.2` (if already exists and needs retarget)
- `git tag -a v0.3.2 -m "LyricVault v0.3.2"`
- `git push origin v0.3.2 --force`

If release assets are managed manually, output explicit upload checklist for:
- `release/LyricVault Setup 0.3.2.exe`
- `release/LyricVault 0.3.2.exe`
- `release/SHA256SUMS-v0.3.2.txt`

## Required Output Format
Return exactly these sections:

1. `Findings`
- Table: Severity | File:Line | Problem | Fix Applied
- If none, state `No findings`.

2. `Gate Results`
- Frontend gate: PASS/FAIL
- Backend gate: PASS/FAIL
- Integrated supercheck: PASS/FAIL

3. `Build & Artifact Evidence`
- Build command outputs and artifact list with sizes + timestamps.
- Checksum verification results.

4. `Push Readiness`
- Current branch/commit
- Tag target commit
- Exact push commands executed or pending

5. `Release Decision`
- `GO` or `NO-GO`
- One-sentence evidence-based justification.
