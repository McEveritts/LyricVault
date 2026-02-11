"""
GeminiService - AI-powered lyric research and audio transcription
Uses Google's Gemini API for:
1. Text-based lyric research (when syncedlyrics fails)
2. Audio transcription using multimodal capabilities

The API key is resolved via the settings service:
  User-configured key (settings.json) → GEMINI_API_KEY env var → disabled

Rate limit handling:
  Automatic retry with exponential backoff on 429/ResourceExhausted errors.
"""

import os
import time
from google import genai
from google.genai import types
from .settings_service import get_gemini_api_key, get_gemini_model, get_available_models


# Rate limit config
MAX_RETRIES = 3
BASE_DELAY = 2  # seconds


class GeminiService:
    def __init__(self):
        self.client = None
        self._current_key = None
        self._initialize()

    @property
    def model(self):
        """Get the currently selected model from settings."""
        return get_gemini_model()

    def _initialize(self):
        """Initialize or reinitialize the Gemini client with the current key."""
        api_key = get_gemini_api_key()
        if api_key and api_key != self._current_key:
            try:
                self.client = genai.Client(api_key=api_key)
                self._current_key = api_key
                print("GeminiService initialized successfully")
            except Exception as e:
                print(f"GeminiService init error: {e}")
                self.client = None
                self._current_key = None
        elif not api_key:
            self.client = None
            self._current_key = None
            print("Warning: No Gemini API key configured. Gemini features disabled.")

    def reload(self):
        """Reload the client with the latest API key from settings."""
        self._current_key = None  # Force re-init
        self._initialize()

    def is_available(self) -> bool:
        """Check if Gemini service is configured and available."""
        if not self.client:
            self._initialize()
        return self.client is not None

    def validate_key(self, api_key: str) -> bool:
        """
        Test whether a given API key is valid by making a small request.
        Returns True if the key works, False otherwise.
        """
        try:
            test_client = genai.Client(api_key=api_key)
            response = test_client.models.generate_content(
                model="gemini-2.0-flash",
                contents="Say hello in one word."
            )
            return response.text is not None
        except Exception as e:
            print(f"Gemini key validation failed: {e}")
            return False

    def _call_with_retry(self, call_fn):
        """
        Execute a Gemini API call with automatic retry on rate limit errors.
        Uses exponential backoff: 2s, 4s, 8s.
        """
        last_error = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                return call_fn()
            except Exception as e:
                error_str = str(e).lower()
                is_rate_limit = (
                    "429" in error_str
                    or "resource exhausted" in error_str
                    or "rate limit" in error_str
                    or "quota" in error_str
                )
                last_error = e
                if is_rate_limit and attempt < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** attempt)
                    print(f"[Gemini] Rate limited (attempt {attempt + 1}/{MAX_RETRIES + 1}). "
                          f"Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    raise last_error

    def research_lyrics(self, track_name: str, artist_name: str) -> str | None:
        """
        Use Gemini to research and find published lyrics for a song.
        This is a fallback when syncedlyrics database search fails.
        """
        if not self.is_available():
            return None

        prompt = f"""You are a music research assistant. I need help finding the lyrics for:

Song: "{track_name}"
Artist: "{artist_name}"

Please search your knowledge for the complete lyrics to this song. 
If you know the lyrics, provide them in a clean format with line breaks.
If you're not certain about the exact lyrics, respond with "LYRICS_NOT_FOUND".
Do not make up or guess lyrics - only provide them if you're confident they're accurate."""

        try:
            def _call():
                return self.client.models.generate_content(
                    model=self.model,
                    contents=prompt
                )

            response = self._call_with_retry(_call)
            result = response.text.strip()

            if "LYRICS_NOT_FOUND" in result or "I don't have" in result.lower() or "i cannot" in result.lower():
                print(f"Gemini research: Lyrics not found for {track_name}")
                return None

            print(f"Gemini research: Found lyrics for {track_name}")
            return result

        except Exception as e:
            print(f"Gemini research error: {e}")
            return None

    def transcribe_audio(self, audio_file_path: str, track_name: str = None, artist_name: str = None) -> str | None:
        """
        Use Gemini's multimodal capabilities to transcribe lyrics from audio.
        """
        if not self.is_available():
            return None

        if not os.path.exists(audio_file_path):
            print(f"Audio file not found: {audio_file_path}")
            return None

        try:
            with open(audio_file_path, "rb") as f:
                audio_bytes = f.read()

            file_size_mb = len(audio_bytes) / (1024 * 1024)
            if file_size_mb > 20:
                print(f"Audio file too large for inline processing: {file_size_mb:.1f}MB")
                return None

            ext = os.path.splitext(audio_file_path)[1].lower()
            mime_types = {
                ".mp3": "audio/mpeg",
                ".wav": "audio/wav",
                ".m4a": "audio/mp4",
                ".ogg": "audio/ogg",
                ".flac": "audio/flac"
            }
            mime_type = mime_types.get(ext, "audio/mpeg")

            context = ""
            if track_name:
                context += f"Song: {track_name}\n"
            if artist_name:
                context += f"Artist: {artist_name}\n"

            prompt = f"""Listen to this audio file and transcribe the lyrics.

{context}
Please provide:
1. The complete lyrics as sung in the audio
2. Format with proper line breaks between verses
3. Include [Verse], [Chorus], [Bridge] markers if you can identify them

If the audio is instrumental or you cannot understand the lyrics clearly, respond with "TRANSCRIPTION_FAILED"."""

            audio_part = types.Part.from_bytes(
                data=audio_bytes,
                mime_type=mime_type
            )

            def _call():
                return self.client.models.generate_content(
                    model=self.model,
                    contents=[prompt, audio_part]
                )

            response = self._call_with_retry(_call)
            result = response.text.strip()

            if "TRANSCRIPTION_FAILED" in result:
                print(f"Gemini transcription: Could not transcribe {track_name or audio_file_path}")
                return None

            print(f"Gemini transcription: Successfully transcribed {track_name or audio_file_path}")
            return result

        except Exception as e:
            print(f"Gemini transcription error: {e}")
            return None


# Singleton instance
gemini_service = GeminiService()
