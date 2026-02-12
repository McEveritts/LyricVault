# Gemini 3 Flash Prompt: LyricVault v0.3.5 Backend Zero-Drift Audit

You are acting as a senior backend release engineer. Work only in this repository and produce real edits plus verifiable evidence.

## Mission
Perform a strict pre-push hardening audit for LyricVault v0.3.5 backend so there is:
- no stale or misleading comment,
- no comment or argument out of place,
- no function/argument mismatch,
- no unvetted or malformed text,
- no security regression in API/process/file handling,
- no unverifiable claim in your report.

If something is uncertain, mark it as uncertain and prove what you did check.

## Scope
Primary scope:
- `backend/**`
- `pytest.ini`

Only touch non-backend files if backend verification is blocked by them.

## Critical Context To Re-Verify
1. SQLite datetime adapters/converters are explicitly registered for Python 3.12+ compliance in `backend/database/database.py`.
2. CORS policy is strict in production/release mode and only allows permissive origins in development where intended.
3. Path traversal protections remain intact for all file/path entry points.
4. Worker heartbeat/retry behavior still matches test expectations.
5. Gemini/service integration paths fail safely when keys/network are unavailable.

## Non-Negotiable Rules
1. Never claim a fix without file+line evidence.
2. Never claim command success without command output.
3. Do not leave dead code, stale comments, placeholder text, or misleading TODOs.
4. Keep changes minimal and deterministic.
5. Preserve current API behavior unless behavior is incorrect, insecure, or contradictory.

## Audit Procedure (Execute In Order)
1. Baseline
- `git status --short`
- `python -m compileall backend`
- `$env:LYRICVAULT_ENV='development'; pytest backend/test_api_contract.py backend/test_path_traversal.py backend/test_ffmpeg_winget.py backend/test_worker_heartbeat.py`

2. Text Hygiene Sweep
- Scan for mojibake and malformed punctuation artifacts.
- Scan for accidental debug/dev text and noisy placeholders.
- Scan for raw emoji in backend-facing text where professional release text is expected.

Recommended scans:
- `rg -n "Â|â|ð|Ã|¤|¢|¬|\\uFFFD" backend`
- `rg -n "TODO|FIXME|XXX|debugger|console\\.log" backend`
- `rg -n "[\\x{1F300}-\\x{1FAFF}]" backend -P`

3. Function/Argument Contract Audit
For each touched module:
- Compare function signatures vs call sites.
- Remove unused args/returns or wire them correctly.
- Confirm exception handlers preserve error context and do not swallow actionable failures.
- Confirm async/sync boundaries are consistent (no blocking calls inside hot async paths without intent).

4. Security Hardening Audit
- Verify no unsafe subprocess execution (`shell=True`, string-concatenated commands) in backend paths.
- Verify path handling is canonicalized and guarded against traversal before file operations.
- Verify CORS origin list logic is environment-gated as intended.
- Verify secrets/tokens are never logged in plaintext.

Recommended scans:
- `rg -n "shell\\s*=\\s*True|os\\.system\\(|eval\\(|exec\\(" backend`
- `rg -n "subprocess\\.(run|Popen|call)\\(" backend`
- `rg -n "CORS|allow_origins|file://|null" backend`
- `rg -n "token|api[_-]?key|secret|authorization" backend`

5. Comment Accuracy Audit
- Every remaining comment must describe current behavior.
- Remove comments that refer to deleted behavior.
- Rewrite vague comments into concrete, testable statements.

6. API and Data Integrity Audit
- Verify response shapes in handlers still match API contract tests.
- Verify DB model usage matches query/update expectations.
- Verify retry/fallback logic does not mutate state inconsistently.

7. Re-Run Verification
- `python -m compileall backend`
- `$env:LYRICVAULT_ENV='development'; pytest backend/test_api_contract.py backend/test_path_traversal.py backend/test_ffmpeg_winget.py backend/test_worker_heartbeat.py`
- Re-run text and security scans above.

## Required Output Format
Return exactly these sections:

1. `Findings`
- Table: Severity | File:Line | Problem | Fix Applied
- If none, explicitly state `No findings`.

2. `Patch Summary`
- Bullet list of concrete edits by file.

3. `Verification Evidence`
- For each command: command text + pass/fail + key output lines.

4. `Risk Check`
- Residual risks that remain (if any), with why.

5. `Release Gate Decision`
- One of: `GO` or `NO-GO`
- Single-sentence justification tied to evidence.

## Quality Bar
Do not finish until all of the following are true:
- Compile check passes for backend (`python -m compileall backend`).
- Deterministic backend hardening tests pass.
- No mojibake artifacts in backend scope.
- No stale/misleading comments in touched files.
- No function/argument drift in touched files.
- No critical/high security findings left unresolved.
- Report contains evidence, not assumptions.

