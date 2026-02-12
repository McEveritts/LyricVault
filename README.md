# ![LyricVault Logo](./frontend/public/logo.svg) LyricVault v0.4.3

## The Ultimate Local Music Sanctuary - Powered by AI

[![Version](https://img.shields.io/badge/version-0.4.3-E2C286?style=for-the-badge)](https://github.com/McEveritts/LyricVault)
[![License: MIT](https://img.shields.io/badge/License-MIT-E2C286?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build: Portable & Installer](https://img.shields.io/badge/Build-Portable%20%2B%20Installer-2B2D31?style=for-the-badge)](https://github.com/McEveritts/LyricVault/releases)

---

## What is LyricVault?

LyricVault is a local-first music player that combines a personal library workflow with AI-assisted lyric research.

Instead of relying on streaming metadata that can change over time, LyricVault helps you build and keep a stable local catalog.

---

## New in v0.4.3

### UI and Brand Polish
- Footer branding now reads "Designed by McEveritts".
- Sidebar collapse toggle moved into the sidebar header for stronger layout flow.
- Fixed tab-switch white flash by enforcing dark background continuity.
- Library sort dropdown z-index increased to prevent clipping.

### Playback and Queue Experience
- Integrated Queue redesigned as a docked extension of the Now Playing bar.
- Queue reveal now uses fluid expansion/collapse transitions.
- Lyrics overlay now supports click-to-seek on synced lines with hover feedback.

### Visualizer and Overlay
- Aura visualizer upgraded from block bars to fluid motion-blur wave rendering.
- Added premium title/artist overlay styling in the visualizer deck.

### Backend and Reliability
- Added lightweight Genius token validation endpoint for in-app Settings testing.
- Maintained robust worker claim/retry behavior and secure credentials persistence.
- Confirmed frontend polling and API contracts for background discovery jobs.

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
Run `LyricVault Setup 0.4.3.exe`.

Option B (Portable):
Run `LyricVault 0.4.3.exe`.

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
