# ![LyricVault Logo](./frontend/public/logo.svg) LyricVault v0.4.2

## The Ultimate Local Music Sanctuary - Powered by AI

[![Version](https://img.shields.io/badge/version-0.4.2-E2C286?style=for-the-badge)](https://github.com/McEveritts/LyricVault)
[![License: MIT](https://img.shields.io/badge/License-MIT-E2C286?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build: Portable & Installer](https://img.shields.io/badge/Build-Portable%20%2B%20Installer-2B2D31?style=for-the-badge)](https://github.com/McEveritts/LyricVault/releases)

---

## What is LyricVault?

LyricVault is a local-first music player that combines a personal library workflow with AI-assisted lyric research.

Instead of relying on streaming metadata that can change over time, LyricVault helps you build and keep a stable local catalog.

---

## New in v0.4.2

### Lyrics Integrity and Control
- Added a global strict lyrics mode toggle (`strict_lrc`) in Settings.
- Strict mode now enforces true timed LRC for `ready` status.
- Unsynced fallback mode now exposes explicit `unsynced` lyric status.

### Queue and Processing Contracts
- Active queue now treats `retrying` as a first-class processing state.
- Processing and Activity views are split by status contract at API source.
- Startup migration now batches legacy non-LRC songs into controlled lyric regeneration jobs.

### Discovery and Social Media
- Discovery now supports a Social Media bucket with Instagram, TikTok, and Facebook subfilters.
- Added source tags and best-effort social search guidance.
- Direct social URLs are the reliable ingest path when keyword extractor support is limited.

### UX and Release Hardening
- Refined Song Detail synced/unsynced lyric presentation and export controls.
- Updated mini visualizer to a stronger Gold-reactive style.
- Full version-surface bump and release pipeline updates for `0.4.2`.

---

## Tech Stack

| Core | Technology |
| :--- | :--- |
| Frontend | React 19 + Vite + Tailwind v4 |
| Backend | Python FastAPI + SQLAlchemy |
| AI | Google Gemini |
| Audio | yt-dlp + FFmpeg |
| Shell | Electron 35 |

---

## Getting Started

### 1. Installation

Get the latest release artifacts from GitHub Releases or build locally.

Option A (Installer):
Run `LyricVault Setup 0.4.2.exe`.

Option B (Portable):
Run `LyricVault 0.4.2.exe`.

### 2. Configuration

To enable AI features:
1. Open Settings.
2. Add your Google Gemini API key.
3. Select your preferred Gemini model.

---

## Contributing

1. Fork the repository.
2. Run `npm run setup:python`.
3. Run `npm run dev`.

---

Created by McEveritts.
