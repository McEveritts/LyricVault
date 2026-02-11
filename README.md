# 🌌 LyricVault

## Your Personal Music Sanctuary — AI-Powered Lyric Research & Local Library

[![Version](https://img.shields.io/badge/version-0.1.1-E2C286?style=for-the-badge)](https://github.com/McEveritts/LyricVault)
[![License: MIT](https://img.shields.io/badge/License-MIT-E2C286?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![Tech: Electron](https://img.shields.io/badge/Tech-Electron-2B2D31?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![Tech: FastAPI](https://img.shields.io/badge/Tech-FastAPI-2B2D31?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)

---

## ✨ The Vision

**LyricVault** isn't just a music player; it's a **sanctuary**. In a world of fleeting streams and missing lyrics, LyricVault provides a home for your music. Inspired by the deep, immersive vibes of **Space Bass** and the rhythmic pulse of **House**, the interface is designed to be a premium, glassmorphic haven for audiophiles who crave more than just a play button.

Built with the sleek design language of the **Google Pixel 10 Pro**, LyricVault combines industrial minimalism with cosmic warmth.

---

## 🚀 Key Features

### 🪄 Magic Paste

Found a track on YouTube, Spotify, or SoundCloud? Just paste the URL. LyricVault handles the rest—fetching high-quality audio, cover art, and metadata automatically.

### 🧠 AI-Powered Lyricist (Gemini 2.0)

Standard lyric databases fail you? LyricVault doesn't.

- **Deep Research**: If lyrics aren't in the database, our AI agent scours its vast knowledge to find them.
- **Multimodal Transcription**: As a last resort, the AI *listens* to your audio file and transcribes the lyrics with incredible accuracy, preserving the artist's intent.

### 🎹 Immersive Experience

- **LRC Synced Lyrics**: Watch your lyrics flow in real-time with the music.
- **Space Bass Aesthetics**: A UI that pulses and floats, featuring gold accents, glass panels, and smooth transitions.
- **Local-First Library**: Your music stays on your machine. Fast, private, and always available.

### 🔍 Health & Stability

Built-in **API Monitor** provides a real-time dashboard for all your services—FastAPI, Gemini, and the iTunes metadata engine—ensuring your sanctuary is always online.

---

## 🛠️ Tech Stack

LyricVault is built with a modern, high-performance stack:

| Component | Technology |
| :--- | :--- |
| **Frontend** | React + Vite + Tailwind CSS |
| **Desktop Shell** | Electron |
| **Backend API** | FastAPI (Python) |
| **Database** | SQLite + SQLAlchemy |
| **AI Engine** | Google Gemini 2.0 Flash |
| **Audio Processing** | yt-dlp + FFmpeg |

---

## 🚦 Getting Started

### Prerequisites

- **Node.js** (v18+)
- **Python** (3.12+)
- **FFmpeg** (Included in setup script)

### Installation

1. **Clone the Sanctuary**

   ```bash
   git clone https://github.com/McEveritts/LyricVault.git
   cd LyricVault
   ```

2. **Run the Divine Setup**
   Our automated script sets up a portable Python environment and downloads FFmpeg for you.

   ```bash
   npm run setup:python
   ```

3. **Install UI Dependencies**

   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

4. **Launch the Experience**

   ```bash
   npm run dev
   ```

---

## ⚙️ Configuration

To unlock the full power of the **AI Lyricist**, you'll need a Google Gemini API Key.

1. Get a free key from the [Google AI Studio](https://aistudio.google.com/).
2. Open **Settings** in the LyricVault app.
3. Paste your key and choose your preferred model (Gemini 2.0 Flash recommended).

---

## 🎨 Vibe Check

Lyrics should feel like a part of the song, not an afterthought. LyricVault's design uses:

- **Google Gold (`#E2C286`)**: For that premium, royal touch.
- **Material Design 3**: Ultra-rounded corners and pill-shaped interactive elements.
- **Glassmorphism**: High-blur background panels that give a sense of depth and space.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

---

> *Created with ❤️ for the music obsessed.*
