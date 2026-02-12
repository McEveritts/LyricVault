# Gemini 3 Pro (High) Prompt: LyricVault v0.4.2 Ultimate Supercheck + Cohesion Audit + Build + Push Gate

You are acting as the principal release engineering authority for LyricVault.

Execute a full-line, zero-drift release gate for `v0.4.2` with evidence-backed results only.

## Mission
Perform one final comprehensive audit across frontend, backend, Electron shell, packaging, and release metadata so every surfaced behavior works cohesively with no hidden assumptions.

You must:
- read and validate all relevant code paths,
- run required checks in order,
- fix defects when safe and deterministic,
- provide direct evidence for every claim,
- return a strict `GO` or `NO-GO`.

If anything is uncertain, label it `UNCERTAIN`, explain why, and show exactly what you verified.

## Required Inputs (Mandatory)
- `gemini_prompt_v0.3.5_frontend_gate.md`
- `gemini_prompt_v0.3.5_backend_gate.md`
- `README.md`
- `CHANGELOG.md`
- `release_notes_v0.4.2.md`
- `release_publish_v0.4.2.md`
- `smoke_test_v0.4.2.md`
- `RISK_ASSESSMENT_v0.4.2.md`
- `EV_CODE_SIGNING_READINESS.md`
- `release_checksums_v0.4.2.txt`
- `VERIFY_RELEASE.ps1`

Treat the two v0.3.5 gate prompts as mandatory sub-checklists and enforce their quality bars before final decision.

## Critical v0.4.2 Contracts To Re-Verify
1. Lyrics integrity mode:
- `strict_lrc` exists and is persisted.
- `ready` requires timed LRC validity.
- unsynced fallback appears only when strict mode is OFF.
2. Queue and activity split:
- Processing uses `pending|processing|retrying`.
- Activity uses terminal states only (`completed|failed`).
3. Social discovery:
- Social Media bucket exists with Instagram, TikTok, Facebook subfilters.
- Source tagging and direct social URL ingest guidance are intact.
4. Backend startup resilience:
- Electron backend port auto-fallback works when `8000` is occupied.
- Frontend uses the effective backend port correctly.
5. yt-dlp maintenance:
- System update endpoint/job path is reachable and deterministic (`success|rolled_back|failed`).
6. Migration behavior:
- Startup migration logic for legacy lyric status paths is registered and safe.
7. Release surface consistency:
- All version surfaces and release docs align to `0.4.2`.

## Non-Negotiable Rules
1. Never claim success without command output evidence.
2. Never claim a fix without `file:line` references.
3. Do not skip failed checks. Fix or return `NO-GO`.
4. Preserve release versioning at `0.4.2` unless explicitly instructed otherwise.
5. Keep changes minimal and deterministic.
6. No unverifiable statements.

## Execution Workflow (Strict Order)

### 1) Preflight and Source of Truth
Run:
- `git status --short`
- `git rev-parse --abbrev-ref HEAD`
- `git rev-parse HEAD`
- `node -v`
- `backend\venv\Scripts\python.exe --version`

Then inventory scoped files for line-by-line audit context:
- `rg --files frontend/src backend electron scripts | sort`

### 2) Frontend Gate (Mandatory)
Execute the full checklist from:
- `gemini_prompt_v0.3.5_frontend_gate.md`

### 3) Backend Gate (Mandatory)
Execute the full checklist from:
- `gemini_prompt_v0.3.5_backend_gate.md`

### 4) Integrated Supercheck (Repository-Wide)
Run:
- `npm --prefix frontend run lint`
- `npm run build:frontend`
- `backend\venv\Scripts\python.exe -m compileall -q -x "backend[\\/]venv" backend`
- `$env:LYRICVAULT_ENV='development'; backend\venv\Scripts\python.exe -m pytest backend/test_api_contract.py backend/test_path_traversal.py backend/test_ffmpeg_winget.py backend/test_worker_heartbeat.py backend/test_social.py backend/test_gemini_integration.py backend/test_blocking.py backend/test_search.py backend/test_url_parsing.py backend/tests`
- `rg -n -P "\\uFFFD|[^\\x00-\\x7F]" frontend/src backend electron package.json README.md CHANGELOG.md release_notes_v0.4.2.md release_publish_v0.4.2.md smoke_test_v0.4.2.md RISK_ASSESSMENT_v0.4.2.md EV_CODE_SIGNING_READINESS.md`
- `rg -n "TODO|FIXME|XXX|debugger" frontend/src backend electron`
- `rg -n "shell\\s*=\\s*True|os\\.system\\(|eval\\(|exec\\(" backend`
- `rg -n "subprocess\\.(run|Popen|call)\\(" backend`
- `rg -n "CORS|allow_origins|file://|null" backend`
- `rg -n "token|api[_-]?key|secret|authorization" backend`

### 5) Cohesion Validation (Behavior Contracts)
Validate with code evidence and targeted execution that:
- strict lyrics modes map to expected API/UI states,
- queue split and retrying semantics are consistent across API and UI,
- social discovery filters wire correctly to ingest/search contract,
- backend dynamic port is propagated from Electron preload to frontend API base,
- migration routines and registry run once and do not corrupt state.

If any contract cannot be fully validated, mark `UNCERTAIN` and include exact blocker.

### 6) Build Release Artifacts
Run:
- `npm run dist`

Capture artifact evidence:
- `Get-ChildItem release | Where-Object { $_.Name -match '0\\.4\\.2|SHA256SUMS-v0\\.4\\.2\\.txt' } | Select-Object Name,Length,LastWriteTime`

### 7) Checksums and Verification
If `release/SHA256SUMS-v0.4.2.txt` is missing, generate it from built artifacts:
- `Get-FileHash -Algorithm SHA256 "release/LyricVault Setup 0.4.2.exe","release/LyricVault 0.4.2.exe" | ForEach-Object { "{0} *{1}" -f $_.Hash.ToUpperInvariant(), (Split-Path $_.Path -Leaf) } | Set-Content "release/SHA256SUMS-v0.4.2.txt"`

Verify committed checksum contract:
- `.\VERIFY_RELEASE.ps1 -ChecksumsFile release_checksums_v0.4.2.txt`

Cross-check release and committed checksum files:
- `Compare-Object (Get-Content release/SHA256SUMS-v0.4.2.txt | Where-Object { $_ -and -not $_.TrimStart().StartsWith('#') }) (Get-Content release_checksums_v0.4.2.txt | Where-Object { $_ -and -not $_.TrimStart().StartsWith('#') })`

No diff output is required for pass.

### 8) Git Tag and Push Readiness
Validate:
- intended files committed,
- tag target correctness for `v0.4.2`,
- exact commands ready for push.

Push sequence (execute only if `GO`):
- `git push origin HEAD`
- `git tag -d v0.4.2` (only if retarget is required)
- `git tag -a v0.4.2 -m "LyricVault v0.4.2"`
- `git push origin v0.4.2 --force`

Manual release upload checklist (if needed):
- `release/LyricVault Setup 0.4.2.exe`
- `release/LyricVault 0.4.2.exe`
- `release/SHA256SUMS-v0.4.2.txt`

## Required Output Format (Exact Sections)
Return exactly these sections in this order:

1. `Findings`
- Table: Severity | File:Line | Problem | Fix Applied
- If none, state `No findings`.

2. `Gate Results`
- Frontend gate: PASS/FAIL
- Backend gate: PASS/FAIL
- Integrated supercheck: PASS/FAIL
- Cohesion contracts: PASS/FAIL/UNCERTAIN

3. `Build & Artifact Evidence`
- Build command outputs.
- Artifact list with size and timestamp.
- Checksum generation/verification output.

4. `Push Readiness`
- Current branch and commit.
- Tag target commit for `v0.4.2`.
- Exact push commands executed or pending.

5. `Risk Register`
- Residual risks, why they remain, and mitigation.
- Call out any `UNCERTAIN` item explicitly.

6. `Release Decision`
- `GO` or `NO-GO`
- One sentence evidence-based justification.

## Quality Bar (Must Pass Before GO)
- Frontend lint and build pass.
- Backend compile and full listed pytest suite pass.
- No mojibake artifacts in scoped code/docs.
- No unresolved critical/high security findings.
- No stale or misleading comments in touched files.
- No prop/function argument drift in touched files.
- v0.4.2 cohesion contracts pass (or explicit `NO-GO` if not).
- Every material claim is backed by command output or file:line evidence.
