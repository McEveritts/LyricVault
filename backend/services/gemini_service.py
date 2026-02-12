"""
GeminiService - AI-powered lyric research and audio transcription
Uses Google's Gemini API for:
1. Text-based lyric research (when syncedlyrics fails)
2. Audio transcription using multimodal capabilities

The API key is resolved via the settings service:
  User-configured key (settings.json) → GEMINI_API_KEY env var → disabled

Rate limit handling:
  Automatic retry with exponential backoff on 429/ResourceExhausted
  and transient server errors (500/503).
"""

import os
import time
from google import genai
from google.genai import types
from .settings_service import (
    get_gemini_api_key,
    get_gemini_model,
    get_stable_gemini_model,
    set_gemini_model,
)


# ── Rate limit config ─────────────────────────────────────────────────
MAX_RETRIES = 3
BASE_DELAY = 2  # seconds


# ── Shared safety settings ────────────────────────────────────────────
# Song lyrics routinely contain profanity, violence, substance references,
# and sexually explicit language. Default safety filters silently refuse
# these requests, causing "lyrics not found" false negatives.
# BLOCK_ONLY_HIGH allows legitimate lyric content through while still
# blocking genuinely dangerous / illegal content.
_PERMISSIVE_SAFETY = [
    types.SafetySetting(
        category="HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold="BLOCK_ONLY_HIGH",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_HARASSMENT",
        threshold="BLOCK_ONLY_HIGH",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_HATE_SPEECH",
        threshold="BLOCK_ONLY_HIGH",
    ),
    types.SafetySetting(
        category="HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold="BLOCK_ONLY_HIGH",
    ),
]


# ── Per-task GenerationConfigs ────────────────────────────────────────
# System instructions are set here (not in the user prompt) so the model
# treats them as higher-priority directives and enables implicit caching.

LYRICS_RESEARCH_CONFIG = types.GenerateContentConfig(
    system_instruction=(
        "You are a precise music lyrics database. "
        "Reproduce published song lyrics exactly as written, "
        "with proper line breaks between verses. "
        "Never fabricate, paraphrase, or approximate lyrics. "
        "If you do not know the exact lyrics, respond only with: LYRICS_NOT_FOUND"
    ),
    temperature=0.2,       # Low — factual recall, not creative writing
    top_p=0.8,
    safety_settings=_PERMISSIVE_SAFETY,
)

AUDIO_TRANSCRIPTION_CONFIG = types.GenerateContentConfig(
    system_instruction=(
        "You are a professional audio transcription engine. "
        "Listen carefully and transcribe the sung lyrics verbatim. "
        "Format with proper line breaks between verses. "
        "Include [Verse], [Chorus], [Bridge] markers where identifiable. "
        "If the audio is instrumental or unintelligible, "
        "respond only with: TRANSCRIPTION_FAILED"
    ),
    temperature=0.1,       # Very low — transcription demands precision
    top_p=0.9,
    safety_settings=_PERMISSIVE_SAFETY,
)

# Ignore ambient proxy env vars (HTTP_PROXY/HTTPS_PROXY/ALL_PROXY) by default.
# This keeps Gemini connectivity stable when the shell injects a dead proxy.
GENAI_HTTP_OPTIONS = types.HttpOptions(
    clientArgs={"trust_env": False},
    asyncClientArgs={"trust_env": False},
)


class GeminiService:
    def __init__(self):
        self.client = None
        self._current_key = None
        self._last_validation_error = None
        self._last_failure_reason = None
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
                self.client = genai.Client(
                    api_key=api_key,
                    http_options=GENAI_HTTP_OPTIONS,
                )
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

    def get_last_failure_reason(self) -> str | None:
        return self._last_failure_reason

    def validate_key(self, api_key: str) -> bool:
        """
        Validate the API key by attempting to generate a small response.
        This confirms the key actually has permission to generate content.
        """
        try:
            test_client = genai.Client(
                api_key=api_key,
                http_options=GENAI_HTTP_OPTIONS,
            )
            test_client.models.generate_content(
                model="gemini-2.0-flash",
                contents="test"
            )
            return True
        except Exception as e:
            error_msg = str(e)
            print(f"Gemini key validation failed: {error_msg}")
            
            # Extract clean error message for ClientErrors
            if "401" in error_msg or "API key not valid" in error_msg:
                self._last_validation_error = "Authentication failed. Please check your API key."
            elif "400" in error_msg and "API key" in error_msg:
                self._last_validation_error = "Invalid API key format."
            elif "403" in error_msg:
                 self._last_validation_error = "Permission denied. API key may be restricted."
            elif "429" in error_msg or "Resource has been exhausted" in error_msg:
                 self._last_validation_error = "Quota exceeded. Check your billing or wait a moment."
            else:
                self._last_validation_error = f"Connection failed. ({error_msg[:50]}...)"
            
            return False

    def _call_with_retry(self, call_fn):
        """
        Execute a Gemini API call with automatic retry on rate limit
        and transient server errors.  Exponential backoff: 2s, 4s, 8s.
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
                is_server_error = (
                    "500" in error_str
                    or "503" in error_str
                    or "internal" in error_str
                    or "unavailable" in error_str
                )
                is_retryable = is_rate_limit or is_server_error
                last_error = e
                if is_retryable and attempt < MAX_RETRIES:
                    delay = BASE_DELAY * (2 ** attempt)
                    reason = "Rate limited" if is_rate_limit else "Server error"
                    print(f"[Gemini] {reason} (attempt {attempt + 1}/{MAX_RETRIES + 1}). "
                          f"Retrying in {delay}s...")
                    time.sleep(delay)
                else:
                    raise last_error

    @staticmethod
    def _classify_failure_reason(error_text: str) -> str:
        lowered = (error_text or "").lower()
        if (
            "429" in lowered
            or "resource exhausted" in lowered
            or "rate limit" in lowered
            or "quota" in lowered
        ):
            return "rate_limited"
        return "source_unavailable"

    @staticmethod
    def _is_model_unavailable_error(error_text: str) -> bool:
        lowered = (error_text or "").lower()
        return (
            "model" in lowered
            and (
                "not found" in lowered
                or "not supported" in lowered
                or "unsupported" in lowered
                or "deprecated" in lowered
                or "unavailable" in lowered
                or "invalid" in lowered
            )
        )

    def _call_with_model_fallback(self, call_builder, selected_model: str, status_callback=None):
        model_in_use = selected_model
        try:
            response = self._call_with_retry(lambda: call_builder(model_in_use))
            return response, model_in_use
        except Exception as e:
            error_text = str(e)
            if not self._is_model_unavailable_error(error_text):
                raise

            fallback_model = get_stable_gemini_model()
            if model_in_use == fallback_model:
                raise

            print(f"[Gemini] Model '{model_in_use}' unavailable. Falling back to '{fallback_model}'.")
            if status_callback:
                status_callback(f"Model unavailable. Retrying with {fallback_model}...")
            try:
                set_gemini_model(fallback_model)
            except Exception as persist_error:
                print(f"[Gemini] Failed to persist fallback model: {persist_error}")

            response = self._call_with_retry(lambda: call_builder(fallback_model))
            return response, fallback_model

    def research_lyrics(self, track_name: str, artist_name: str, status_callback=None, model_id: str | None = None) -> str | None:
        """
        Use Gemini to research and find published lyrics for a song.
        This is a fallback when syncedlyrics database search fails.
        """
        if not self.is_available():
            if status_callback: status_callback("Gemini API key missing")
            self._last_failure_reason = "source_unavailable"
            return None

        # User query only — system role is in LYRICS_RESEARCH_CONFIG
        prompt = f'Find the complete published lyrics for "{track_name}" by "{artist_name}".'
        selected_model = model_id or self.model

        try:
            def _call(model_name: str):
                if status_callback: status_callback(f"Researching: {track_name}...")
                return self.client.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=LYRICS_RESEARCH_CONFIG,
                )

            response, _ = self._call_with_model_fallback(_call, selected_model, status_callback=status_callback)

            # Check finish_reason before inspecting text
            if response.candidates and response.candidates[0].finish_reason != "STOP":
                reason = response.candidates[0].finish_reason if response.candidates else "UNKNOWN"
                print(f"[Gemini] Request filtered/refused (finish_reason={reason}) for {track_name}")
                self._last_failure_reason = "not_found"
                return None

            result = response.text.strip()

            # Only check refusal phrases on SHORT responses (real lyrics are >100 chars)
            if len(result) < 100:
                refusal_phrases = [
                    "lyrics_not_found",
                    "i don't have",
                    "i cannot",
                    "cannot provide",
                ]
                if any(phrase in result.lower() for phrase in refusal_phrases):
                    print(f"Gemini research: Lyrics not found for {track_name}")
                    self._last_failure_reason = "not_found"
                    return None

            print(f"Gemini research: Found lyrics for {track_name}")
            self._last_failure_reason = None
            return result

        except Exception as e:
            print(f"Gemini research error: {e}")
            self._last_failure_reason = self._classify_failure_reason(str(e))
            return None

    def transcribe_audio(self, audio_file_path: str, track_name: str = None, artist_name: str = None, status_callback=None, model_id: str | None = None) -> str | None:
        """
        Use Gemini's multimodal capabilities to transcribe lyrics from audio.
        """
        if not self.is_available():
            if status_callback: status_callback("Gemini API key missing")
            self._last_failure_reason = "source_unavailable"
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
                if status_callback: status_callback(f"Error: Audio too large ({file_size_mb:.1f}MB)")
                self._last_failure_reason = "source_unavailable"
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

            # Build a concise user query — system role is in AUDIO_TRANSCRIPTION_CONFIG
            context_parts = []
            if track_name:
                context_parts.append(track_name)
            if artist_name:
                context_parts.append(f"by {artist_name}")
            prompt = f'Transcribe: {" ".join(context_parts)}' if context_parts else "Transcribe the lyrics from this audio."

            audio_part = types.Part.from_bytes(
                data=audio_bytes,
                mime_type=mime_type
            )

            selected_model = model_id or self.model

            def _call(model_name: str):
                if status_callback: status_callback(f"Uploading audio ({file_size_mb:.1f}MB) & Analyzing...")
                return self.client.models.generate_content(
                    model=model_name,
                    contents=[prompt, audio_part],
                    config=AUDIO_TRANSCRIPTION_CONFIG,
                )

            response, _ = self._call_with_model_fallback(_call, selected_model, status_callback=status_callback)

            # Check finish_reason before inspecting text
            if response.candidates and response.candidates[0].finish_reason != "STOP":
                reason = response.candidates[0].finish_reason if response.candidates else "UNKNOWN"
                print(f"[Gemini] Transcription filtered (finish_reason={reason}) for {track_name or audio_file_path}")
                self._last_failure_reason = "not_found"
                return None

            result = response.text.strip()

            if "TRANSCRIPTION_FAILED" in result:
                print(f"Gemini transcription: Could not transcribe {track_name or audio_file_path}")
                self._last_failure_reason = "not_found"
                return None

            print(f"Gemini transcription: Successfully transcribed {track_name or audio_file_path}")
            self._last_failure_reason = None
            return result

        except Exception as e:
            print(f"Gemini transcription error: {e}")
            if status_callback: status_callback(f"Error: {str(e)[:50]}...")
            self._last_failure_reason = self._classify_failure_reason(str(e))
            return None


# Singleton instance
gemini_service = GeminiService()
