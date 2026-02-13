# ![LyricVault Logo](./frontend/public/logo.svg) LyricVault v0.4.5

## The Ultimate Local Music Sanctuary - Powered by AI

[![Version](https://img.shields.io/badge/version-0.4.5-E2C286?style=for-the-badge)](https://github.com/McEveritts/LyricVault)
[![License: MIT](https://img.shields.io/badge/License-MIT-E2C286?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build: Portable & Installer](https://img.shields.io/badge/Build-Portable%20%2B%20Installer-2B2D31?style=for-the-badge)](https://github.com/McEveritts/LyricVault/releases)

---

## What is LyricVault?

LyricVault is a local-first music player that combines a personal library workflow with AI-assisted lyric research.

Instead of relying on streaming metadata that can change over time, LyricVault helps you build and keep a stable local catalog.

---

## New in v0.4.5

### Security Hardening

- Backend now binds to `127.0.0.1` (localhost only) to prevent LAN exposure.
- Tightened CORS origin allowlist and added security headers (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`).
- Electron renderer sandbox explicitly enabled for additional isolation.
- Added a strict Content Security Policy (CSP) to restrict script execution and local API connections.

### Codebase Hygiene

- Removed 50+ obsolete artifacts (legacy logs, prompts, old release files).
- Retired legacy `lyricvault.db` (v1) in favor of the current v2 schema.
- Consolidated per-view footers into a single global `AppFooter`.

### Fixes & Improvements

- Fixed a potential crash in `LibraryGrid` when categories are undefined.
- Consolidated versioning so frontend/backend metadata are derived from the root `package.json`.
- Added custom branding assets for the Windows installer (header + sidebar).

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
Run `LyricVault Setup 0.4.5.exe`.

Option B (Portable):
Run `LyricVault 0.4.5.exe`.

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
