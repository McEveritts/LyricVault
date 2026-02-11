# 🎵 LyricVault v0.2.2 — The "Space Bass" & AI Refinement Update

**Release Date:** February 11, 2026  
**Version:** v0.2.2

LyricVault v0.2.2 is the culmination of a rapid development cycle focused on **Multimodal AI**, **Stability**, and a **Premium User Experience**. This release standardizes the "Space Bass" design language and introduces powerful new configuration options for power users.

---

## 🌟 What's New & Improved (Since v0.1.3)

### 🧠 Advanced AI & Model Selection

* **Model Configuration**: You can now choose specifically which Gemini model powers your research (Flash, Pro, Lite) directly from Settings.
* **Performance Badges**: Models are now categorized with "Pixel-style" badges to help you choose:
  * <span style="background: #C4E7FF33; color: #C4E7FF; border: 1px solid #C4E7FF33; padding: 2px 6px; border-radius: 99px; font-size: 0.8em;">Recommended</span> for best balance.
  * <span style="background: #D3E3FD33; color: #D3E3FD; border: 1px solid #D3E3FD33; padding: 2px 6px; border-radius: 99px; font-size: 0.8em;">Quality</span> for complex lyrics.
  * <span style="background: #FFD8E433; color: #FFD8E4; border: 1px solid #FFD8E433; padding: 2px 6px; border-radius: 99px; font-size: 0.8em;">Fast</span> for quick processing.
* **Multimodal Transcription**: Only available since v0.1.4, the engine can now *listen* to audio files to transcribe lyrics when text search fails.
* **API Key Validation**: New "Test API Key" button provides instant feedback on your Gemini key's validity before you save.

### 🎨 "Space Bass" UI & Design

* **Glassmorphism Spec**: A refined UI theme featuring deep space backgrounds, golden accents (`#E2C286`), and high-blur overlays.
* **Redesigned Settings**: A completely overhauled Settings page using the "Monet" design system with pastel accents and clear categorization.
* **Icon System**: New algorithmic generation for application icons in `scripts/`, ensuring crisp, adaptive branding across platforms.

### 🛠️ Stability & Engineering

* **Backend v0.2.1.1**: Updated FastAPI core with thread-safe task management.
* **Race Condition Fixes**: Background tasks (ingestion, research) are now protected by locks to prevent data corruption during rapid usage.
* **Smart Retries**: Network 500/503 errors and Rate Limits are handled gracefully with exponential backoff.
* **Dynamic Dependencies**: `ffmpeg` and other tools are now securely located via rigorous discovery checks (WinGet/Path) rather than hardcoding.
* **Portable Mode**: Official support for a standalone `.exe` build for USB libraries.

---

## 📜 Complete Changelog (History)

### **v0.2.2 (Current)**

* **Feat**: Introduced algorithmic icon generation in `scripts/`.
* **Feat**: Finalized "Space Bass" golden accent theming.
* **Fix**: Standardized versioning across `package.json` (0.2.2) and Backend (0.2.1.1).

### **v0.2.0 - v0.2.1**

* **Feat**: **Settings 2.0** — Complete rewrite of the configuration view.
* **Feat**: Added tiered Model Selector with performance characteristics.
* **Internal**: Migrated to `DeclarativeBase` for database models.

### **v0.1.5**

* **Fix**: Hardened API resilience (System Instructions, Safety Settings).
* **Fix**: Removed unused dependencies (`spotipy`, `bs4`).
* **Fix**: Tightened CORS policies and centralized `API_BASE` configuration.

### **v0.1.4 (The AI Update)**

* **New**: **Multimodal Transcription** support (Audio-to-Text).
* **New**: Initial "Space Bass" logo rollout.
* **New**: "Wrong Lyrics?" manual override flow.

### **v0.1.3**

* **New**: Base infrastructure for audio processing.

---

*Build your sanctuary. Own your music.*
