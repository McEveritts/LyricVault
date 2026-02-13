# ![LyricVault Logo](./frontend/public/logo.svg) LyricVault v0.4.6

## The Ultimate Local Music Sanctuary - Powered by AI

[![Version](https://img.shields.io/badge/version-0.4.6-E2C286?style=for-the-badge)](https://github.com/McEveritts/LyricVault)
[![License: MIT](https://img.shields.io/badge/License-MIT-E2C286?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build: Portable & Installer](https://img.shields.io/badge/Build-Portable%20%2B%20Installer-2B2D31?style=for-the-badge)](https://github.com/McEveritts/LyricVault/releases)

---

## What is LyricVault?

LyricVault is a local-first music player that combines a personal library workflow with AI-assisted lyric research.

Instead of relying on streaming metadata that can change over time, LyricVault helps you build and keep a stable local catalog.

---

## New in v0.4.6

### Build & Packaging (Windows)

- Fixed electron-builder `winCodeSign` extraction failures by requiring Windows Developer Mode for symlink support.
- Refactored the custom NSIS include script to avoid MUI macro ordering warnings (and no longer fail the build on warnings).
- Restored full `extraResources` packaging for the Python backend (`backend/`, `python-embed/`, `ffmpeg/`).

### Features (From v0.4.5)

- **Gemini 3.0 Pro Support**: Optimized for the latest high-intelligence models.
- **Lyrics Overlay Media Controls**: Hover-responsive playback controls (Play/Pause, Skip, Seek) in the full-screen lyrics view.
- **Activity Log Navigation & Attribution**: Clickable task entries that navigate to the library, with distinct source identifiers (**Official Web** vs **AI Generated**).
- **Lyric Source Identifiers**: Badges indicating whether content is Official, AI Researched, or AI Transcribed.

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
Run `LyricVault.Setup.0.4.6.exe`.

Option B (Portable):
Run `LyricVault.0.4.6.exe`.

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
