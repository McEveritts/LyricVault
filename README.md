# ![LyricVault Logo](./frontend/public/logo.svg) LyricVault v0.1.4

## The Ultimate Local Music Sanctuary — Powered by AI

[![Version](https://img.shields.io/badge/version-0.1.4-E2C286?style=for-the-badge)](https://github.com/McEveritts/LyricVault)
[![License: MIT](https://img.shields.io/badge/License-MIT-E2C286?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Build: Portable & Installer](https://img.shields.io/badge/Build-Portable%20%2B%20Installer-2B2D31?style=for-the-badge)](https://github.com/McEveritts/LyricVault/releases)

---

## ✨ What is LyricVault?

**LyricVault** is a reimagined music player for the modern audiophile. It combines a local-first philosophy with the power of generative AI to ensure your music library is beautiful, complete, and fully yours.

Stop relying on streaming services that change metadata or remove tracks. Build your **sanctuary**.

---

## 🚀 New in v0.1.4

### 🎧 Multimodal AI Transcription (Gemini 2.0)

If a text search for lyrics fails, LyricVault now leverages Gemini's multimodal capabilities to **listen** to your audio files directly and transcribe them with human-level accuracy. Perfect for rare tracks, remixes, and live recordings.

### 🔑 API Key Testing

- **Instant Validation**: Verify your Gemini API key works perfectly before saving it, with a new **Test API Key** button in Settings.

### 🎨 Brand New Visual Identity

We have officially unveiled the **Space Bass** logo!

- **New Logo**: A sleek, golden-accented mark that reflects our premium "sanctuary" aesthetic.
- **UI Refinements**: Glassmorphism and gold highlights (`#E2C286`) have been tuned for better legibility across all views.

### ⚡ Live Processing Engine

Watch your library come alive.

- **Real-Time Progress**: The updated **Processing View** shows live progress bars for every task—from downloading audio to AI lyric transcription.
- **Background Workers**: Queue up dozens of songs and let LyricVault handle the heavy lifting.

### 💼 Enhanced Distribution

- **Portable .exe**: Official support for standalone execution. Carry your library on a USB without needing an installer.
- **Improved Installer**: Streamlined setup process for Windows.

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
Run `LyricVault Setup 0.1.4.exe` to install to your system.

**Option B: Portable**
Run `LyricVault 0.1.4.exe` to launch instantly.

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
