# ![LyricVault Logo](./frontend/public/logo.svg) LyricVault v0.3.5

## The Ultimate Local Music Sanctuary - Powered by AI

[![Version](https://img.shields.io/badge/version-0.3.5-E2C286?style=for-the-badge)](https://github.com/McEveritts/LyricVault)
[![License: MIT](https://img.shields.io/badge/License-MIT-E2C286?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build: Portable & Installer](https://img.shields.io/badge/Build-Portable%20%2B%20Installer-2B2D31?style=for-the-badge)](https://github.com/McEveritts/LyricVault/releases)

---

## What is LyricVault?

LyricVault is a local-first music player that combines a personal library workflow with AI-assisted lyric research.

Instead of relying on streaming metadata that can change over time, LyricVault helps you build and keep a stable local catalog.

---

## New in v0.3.5

### Security and Core Integrity
- Hardened CORS policy and release-mode origin gating.
- Ingestion/database behavior improved for safer retry flows.
- Release hardening checks expanded and documented.

### AI and Model Controls
- Gemini model selection from Settings.
- Audio transcription fallback when web lyric research fails.
- API key validation before save.

### Reliability
- Better task safety for background ingest/research flows.
- Retry behavior improved for transient server failures and rate limits.
- Dynamic FFmpeg discovery for local and packaged environments.

### UI and Workflow
- Dedicated visualizer deck flow and icon system cleanup.
- Queue actions integrated across Discovery/Library views.
- Accessibility pass for icon-only controls.

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
Run `LyricVault Setup 0.3.5.exe`.

Option B (Portable):
Run `LyricVault 0.3.5.exe`.

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
