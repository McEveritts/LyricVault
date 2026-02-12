# Gemini 3 Flash Prompt: LyricVault v0.3.2 Frontend Zero-Drift Audit

You are acting as a senior frontend release engineer. Work only in this repository and produce real edits plus verifiable evidence.

## Mission
Perform a strict pre-push hardening audit for LyricVault v0.3.2 frontend so there is:
- no stale or misleading comment,
- no comment or argument out of place,
- no prop/argument mismatch,
- no unvetted or malformed text,
- no accessibility regression in icon-only controls,
- no unverifiable claim in your report.

If something is uncertain, mark it as uncertain and prove what you did check.

## Scope
Primary scope:
- `frontend/src/**`
- `frontend/package.json`

Do not modify backend code unless a frontend build is blocked by it.

## Critical Context To Re-Verify
1. Dedicated visualizer flow exists (`Player` button opens full-screen `VisualizerDeck`).
2. Beat detection uses bass-focused analysis and reduced-motion support.
3. Icon system is SVG-only and consistent; no emoji fallbacks or mojibake.
4. Icon-only interactive controls have accurate `aria-label` (and `aria-pressed` where toggle semantics apply).

## Non-Negotiable Rules
1. Never claim a fix without showing the file+line evidence.
2. Never claim command success without including command output.
3. Do not leave dead code, stale comments, placeholder text, or misleading TODOs.
4. Keep changes minimal and deterministic.
5. Preserve existing UX intent unless it is broken, inaccessible, or contradictory.

## Audit Procedure (Execute In Order)
1. Baseline
- `git status --short`
- `npm --prefix frontend run lint`
- `npm run build:frontend`

2. Text Hygiene Sweep
- Scan for mojibake and malformed punctuation artifacts.
- Scan for raw emoji in UI code where SVG icons should be used.
- Scan for accidental debug/dev text and noisy placeholders.

Recommended scans:
- `rg -n "Â|â|ð|Ã|¤|¢|¬|\\uFFFD" frontend/src`
- `rg -n "console\\.log|debugger|TODO|FIXME|XXX" frontend/src`
- `rg -n "[\\x{1F300}-\\x{1FAFF}]" frontend/src -P`

3. Prop/Argument Contract Audit
For each touched component:
- Compare function signature props vs actual usage.
- Compare parent call-site props vs child component signature.
- Remove unused props/args or wire them correctly.
- Confirm no accidental argument order bugs in callbacks.

4. Comment Accuracy Audit
- Every remaining comment must describe current behavior.
- Remove comments that refer to deleted behavior.
- Rewrite vague comments to precise behavior notes.

5. Accessibility/Interaction Audit
- Every icon-only button must have an accurate `aria-label`.
- Toggle controls should include `aria-pressed` when semantically toggle-like.
- Verify keyboard interactions for visualizer close (`Esc`) and button actions.

6. Visualizer Reliability Audit
- Verify bass-bin mapping is frequency-based (not arbitrary bin percentage).
- Verify reduced-motion preference is not polled per frame.
- Verify animation loop cleanup on unmount/close.
- Verify no crash path when analyser/context is missing.

7. Re-Run Verification
- `npm --prefix frontend run lint`
- `npm run build:frontend`
- Re-run text hygiene scans above.

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
- Lint passes.
- Frontend build passes.
- No mojibake artifacts.
- No raw emoji placeholders in audited UI components.
- No stale/misleading comments in touched files.
- No prop/argument drift in touched files.
- Report contains evidence, not assumptions.
