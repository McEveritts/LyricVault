# ![LyricVault Logo](./frontend/public/logo.svg) LyricVault v0.1.5

## The Ultimate Local Music Sanctuary — Powered by AI

[![Version](https://img.shields.io/badge/version-0.1.5-E2C286?style=for-the-badge)](https://github.com/McEveritts/LyricVault)
[![License: MIT](https://img.shields.io/badge/License-MIT-E2C286?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build: Portable & Installer](https://img.shields.io/badge/Build-Portable%20%2B%20Installer-2B2D31?style=for-the-badge)](https://github.com/McEveritts/LyricVault/releases)

---

## ✨ What is LyricVault?

**LyricVault** is a reimagined music player for the modern audiophile. It combines a local-first philosophy with the power of generative AI to ensure your music library is beautiful, complete, and fully yours.

Stop relying on streaming services that change metadata or remove tracks. Build your **sanctuary**.

---

## 🚀 New in v0.1.5

### 🧠 Smarter AI Communication

- **System Instructions**: Dedicated prompts for Research vs. Transcription improve accuracy and cut token waste.
- **Safety Settings**: Explicit lyrics are no longer silently blocked by content filters.
- **Server Error Retries**: Gemini 500/503 errors are now auto-retried alongside rate limits.

### 🔒 Backend Resilience

- **Thread-Safe Tasks**: Background processing is now guarded by a threading lock — no more race conditions.
- **Duplicate Detection**: Re-pasting a URL returns the existing song instead of duplicating it.
- **Dynamic FFmpeg**: Auto-discovered from WinGet packages on any Windows machine.
- **Tightened CORS**: Wildcard origin replaced with a specific allowlist.

### 🎨 Frontend Polish

- **Centralized API Config**: Single `API_BASE` constant replaces all hardcoded URLs.
- **Player UI**: Prev/Next buttons visually disabled with "coming soon" tooltips.
- **Discovery View**: Graceful `--:--` when duration is unavailable.

### 🧹 Housekeeping

- Removed `beautifulsoup4` and `spotipy` dependencies.
- Migrated deprecated SQLAlchemy `declarative_base()` and `datetime.utcnow`.

---

## 🎨 The Aesthetic: "Space Bass"

Inspired by the Google Pixel 10 Pro and deep house vibes:

- **Glassmorphism**: High-blur, translucent panels.
- **Gold Accents**: Signature `#E2C286` highlights against a deep void background.
- **Fluid Motion**: Animations that breathe with the music.

---

## 🛠️ Tech Stack

| Core | Technology |
| :--- | :--- |
| **Frontend** | React 19 + Vite + Tailwind v4 |
| **Backend** | Python FastAPI + SQLAlchemy |
| **AI** | Google Gemini 2.0 Flash (Stable) |
| **Audio** | yt-dlp + FFmpeg (Auto-managed) |
| **Shell** | Electron 35 |

---

## 🚦 Getting Started

### 1. Installation

Grab the latest release from the `releases` folder or build it yourself.

**Option A: Installer**
Run `LyricVault Setup 0.1.5.exe` to install to your system.

**Option B: Portable**
Run `LyricVault 0.1.5.exe` to launch instantly.

### 2. Configuration

To enable AI features:

1. Go to **Settings**.
2. Enter your [Google Gemini API Key](https://aistudio.google.com/).
3. Select **Gemini 2.0 Flash** (Recommended).

---

## 🤝 Contributing

We welcome fellow audiophiles and coders!

1. Fork the repo.
2. `npm run setup:python` to initialize the backend.
3. `npm run dev` to launch the development environment.

---

> *Created with ❤️ by McEveritts.*
