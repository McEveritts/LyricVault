# Gemini 3 Pro (Evolving) Prompt: LyricVault v0.4.3 Iteration

`STATUS: DRAFT` `MODE: PLANNING`

You are acting as the principal engineering lead for the **v0.4.3** iteration of LyricVault.
This prompt serves as the **living source of truth** for all v0.4.3 changes. It will evolve as the user provides more requirements.

## Mission

Execute the **v0.4.3** iteration with the same rigor as v0.4.2, focusing immediately on branding updates and preparing for new feature requests.

## Required Inputs (Context)

- `gemini_prompt_v0.4.2_supercheck_release_pro_HIGH.md` (Previous baseline)
- `CHANGELOG.md`
- `README.md`

## Critical v0.4.3 Objectives (Dynamic List)

### 1. Brand Update [P0]

- **Target**: `frontend/src/components/SettingsView.jsx`
- **Requirement**: Change footer text from "Designed for Pixel" to "**Designed by McEveritts**".
- **Validation**:
  - Verify text content in built artifact.
  - Check for other occurrences (grep check required).

### 2. Genius API Integration & UX [P1]

- **Target**: `frontend/src/components/SettingsView.jsx`, `backend/services/lyrics_provider.py` (or similar)
- **Requirement**:
  - **Design Continuity**: aligning Genius section UI with Gemini section (Active state, Test button if applicable).
  - **API Utilization**: Ensure we are using the Client Access Token properly.
  - *Self-Correction*: The User provided a screenshot showing Client ID/Secret. Verify if we need those or if Access Token is sufficient for our scoped usage (searching lyrics).
- **Validation**:
  - UX matches expectations.
  - Token storage works.

### 3. Lyric-Click Seek & Interaction [P1]

- **Target**: `frontend/src/components/SongDetailView.jsx` (and `Player.jsx` for seek control)
- **Requirement**:
  - Clicking a lyric line in the lyrics view MUST trigger a seek to that timestamp.
  - **Visual Feedback**: Implement a subtle splash or highlight effect on the clicked line to confirm the interaction.
  - Ensure smooth transition and auditory synchronization.
- **Validation**:
  - Manual test: Click line, verify playback jumps, verify visual effect.

### 4. Visualizer Redesign (Dedicated Page) [P1]

- **Target**: `frontend/src/components/VisualizerDeck.jsx`
- **Requirement**:
  - The dedicated full-screen visualizer currently uses legacy blocky bars.
  - **Re-imagination**: Implement a high-fidelity, fluid animation (e.g., silk-smooth waves or glowing aura) using the `google-gold` palette.
  - Ensure the UI overlay (song title/artist) feels premium and native.
- **Validation**:
  - UX Review: Does it feel "native" and "premium"?

### 5. Taskbar Icon Synchronization [P1]

- **Target**: `electron/main.js`, `electron-builder.yml`, `assets/`
- **Requirement**:
  - The application still shows the generic default icon in the taskbar.
  - **Fix**: Synchronize the taskbar icon with the branded LyricVault logo.
- **Validation**:
  - Verify taskbar icon matches branding in dev and build.

### 6. Sidebar UI Refinement [P2]

- **Target**: `frontend/src/components/Sidebar.jsx`
- **Requirement**:
  - The "Collapse" icon is currently separated or poorly positioned.
  - **Change**: Place the collapse icon on the **same line** as the LyricVault Logo and Name, positioned adjacently.
- **Validation**:
  - Verify layout looks clean in both expanded and collapsed states (if applicable).

### 7. [Pending User Input]

- *This section will be populated as the user defines new requirements.*
- *Examples: Bug fixes from v0.4.2, new features, performance improvements.*

## Execution Workflow (Strict Order)

### 1) Preflight

- `git status` (clean state required)
- `git pull` (ensure up to date)

### 2) Feature Implementation

- **Lyric-Click Seek**:
  - Implement `onClick` seek in `SongDetailView.jsx`.
- **Visualizer Redesign**:
  - Re-implement `VisualizerDeck.jsx` with fluid animation.
- **Icon Sync**:
  - Update Electron icon configuration.

### 3) Regression Testing

- Run full v0.4.2 test suite to ensure no regressions.
- `backend\venv\Scripts\python.exe -m pytest backend/tests` (Baseline).

### 4) Release Packaging (When Ready)

- Bump version to `0.4.3` in:
  - `package.json`
  - `electron/package.json`
  - `backend/main.py` (if versioned)
  - `README.md`
  - `CHANGELOG.md`
- Generate release artifacts.
- Sign and verify.

## Quality Gate

- **No "Designed for Pixel" strings remaining.**
- **All v0.4.2 tests pass.**
- **Linting clean.**

---
**DO NOT EXECUTE YET. WAITING FOR EXPLICIT "EXECUTE" COMMAND.**
