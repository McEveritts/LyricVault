# Risk Assessment & Mitigation - LyricVault v0.4.2

## 1. External Dependencies

### 1.1. Genius API

* **Risk:** Rate limiting or API changes could break lyric fetching.
* **Severity:** Medium
* **Mitigation:**
  * Implemented client-side token support to bypass shared IP limits.
  * Added fallback to Gemini AI research/transcription.
  * "Lyrics mode" toggle allows users to accept lower-quality results if strict mode fails.

### 1.2. YouTube/SoundCloud/Spotify Ingest (yt-dlp)

* **Risk:** Platform changes frequently break `yt-dlp` extractors.
* **Severity:** High
* **Mitigation:**
  * `yt-dlp` is bundled but can be updated.
  * Error handling in `ingestor.py` captures failures gracefully.
  * **Proposed:** Add an auto-update mechanism for the `yt-dlp` binary in future releases.

### 1.3. Google Gemini API

* **Risk:** API deprecation (preview models) or quota exhaustion.
* **Severity:** Medium
* **Mitigation:**
  * Configurable model selection in Settings.
  * User-supplied API key ensures personal quota usage.
  * Fallback to other lyric sources.

## 2. Technical Debt & Complexity

### 2.1. Electron + Python Bridge

* **Risk:** Process management issues (zombie processes) or port conflicts.
* **Severity:** Low
* **Mitigation:**
  * `main.js` handles child process lifecycle strictness.
  * Port selection logic is currently static (8000); conflict could prevent startup.
  * **Future:** Implement dynamic port selection.

### 2.2. Database Migrations

* **Risk:** No formal migration framework (Alembic) is currently used; `init_db` relies on `create_all`.
* **Severity:** Medium
* **Mitigation:**
  * Schema changes currently additive.
  * `worker.py` includes migration logic for `lyrics_synced` status on startup.
  * **Action:** Inspect `lyricvault.db` carefully before major schema iterations.

## 3. User Experience

### 3.1. Strict Lyric Mode

* **Risk:** Users might perceive "Lyrics unavailable" as a bug when unsynced text exists.
* **Severity:** Low
* **Mitigation:**
  * Default is Strict, but Toggle exists in Settings.
  * UI copy explains "Synced lyrics only" vs "All text".

## 4. Release & Packaging

### 4.1. Anti-Virus False Positives

* **Risk:** Unsigned Electron executables often flag Windows Defender.
* **Severity:** High (for adoption)
* **Mitigation:**
  * None currently (requires EV Code Signing Certificate).
  * Checksums provided for verification.
