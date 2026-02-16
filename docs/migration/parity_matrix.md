# Tauri Migration Parity Matrix

Track parity between legacy desktop behavior and the new Tauri IPC runtime.

## Core Contracts

- [x] `library_list`
- [x] `song_get`
- [x] `ingest_start`
- [x] `jobs_active`
- [x] `jobs_history`
- [x] `job_get`
- [x] `lyrics_retry`
- [x] settings contracts (`gemini`, `genius`, `lyrics_mode`, `models`)
- [x] `system_ytdlp_status`
- [x] event stream (`lyricvault:event`)
- [x] `stream_url` protocol migration (`lvmedia://`)

## In Progress

- [x] `search_music` social providers parity
- [x] lyric research / transcription parity with legacy Python stack
- [x] background worker parity (lease heartbeats, retries, cleanup loops)
- [x] visualizer fidelity parity
- [x] packaging parity for installer + portable outputs in release pipeline

## Validation Checklist

- [x] migrate existing `%APPDATA%\\LyricVault\\lyricvault_v2.db` without data loss
- [x] verify DPAPI encrypted key read/write compatibility
- [x] verify queue split semantics (`active` vs `history`)
- [x] verify expired/rehydrating audio status transitions
- [x] verify strict vs fallback lyric mode behavior
- [x] verify path traversal protections for media protocol
