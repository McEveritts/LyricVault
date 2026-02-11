# 🚀 LyricVault v0.1.4 — The AI Multimodal Update

Welcome to the most intelligent version of LyricVault yet. This release transitions from simple text-based research to a true **Multimodal AI Experience**, ensuring your music library is never without its soul (the lyrics).

## ✨ Highlight Features

### 🎧 Multimodal AI Transcription (Gemini 2.0 Flash)

If a text search for lyrics fails, LyricVault doesn't give up. It now leverages Gemini's multimodal capabilities to **listen** to your audio files directly and transcribe them with human-level accuracy. Perfect for rare tracks, remixes, and live recordings.

### 🎨 Brand New Visual Identity

We have officially unveiled the **Space Bass** logo!

- **New Logo**: A sleek, golden-accented mark that reflects our premium "sanctuary" aesthetic.
- **UI Refinements**: Glassmorphism and gold highlights (`#E2C286`) have been tuned for better legibility across all views.

### 💼 Enhanced Distribution

- **Portable Mode**: Official support for standalone `.exe` execution. Carry your library on a USB without needing an installer.
- **Improved Installer**: Streamlined setup process for Windows.

### 📜 Synced Lyrics & UI

- **Live Sync Improvement**: Real-time auto-scrolling with high-blur background effects for a focused reading experience.
- **Status Badges**: New "Synced Lyrics" indicator in the detailing view.
- **Manual Overrides**: Added "Wrong Lyrics?" and "Redo Research" buttons to the track view for total control.

### 🔑 API Key Testing

- **Instant Validation**: Added a new **Test API Key** button in Settings. You can now verify your Gemini API key works perfectly before saving it, with instant feedback on its validity.

## 🛠️ Technical Changelog

- **Backend**: New `/research_lyrics` endpoints supporting multimodal transcription modes.
- **Services**: Enhanced `gemini_service.py` with audio processing capabilities.
- **Frontend**: Significant component updates to `SongDetailView.jsx` and `Sidebar.jsx`.

---
*Build your sanctuary. Own your music.*
