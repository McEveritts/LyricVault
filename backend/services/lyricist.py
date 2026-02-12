"""
LyricistService - Multi-source lyric fetching with AI fallback

Lyric fetching chain:
1. syncedlyrics (fast, accurate synced lyrics from databases)
2. Gemini AI research (text-based knowledge lookup)
3. Gemini AI audio transcription (analyze actual audio file)
"""

import syncedlyrics
import re
from .gemini_service import gemini_service
from utils.lrc_validator import validate_lrc

class LyricistService:
    def __init__(self):
        pass

    def clean_text(self, text: str) -> str:
        """Remove feat. and other noise from track names for better search"""
        # Remove (feat. ...) [feat. ...]
        text = re.sub(r"[\(\[]feat\.?.*?[\)\]]", "", text, flags=re.IGNORECASE)
        # Remove empty parens
        text = re.sub(r"\(\s*\)", "", text)
        return text.strip()

    def transcribe(self, track_name: str, artist_name: str, file_path: str = None, status_callback=None) -> str | None:
        """
        Fetch lyrics using a multi-source approach:
        1. Try syncedlyrics databases first (Musixmatch, Netease, etc.)
        2. Fall back to Gemini AI research
        3. Fall back to Gemini AI audio transcription
        
        Args:
            track_name: Title of the song
            artist_name: Artist name
            file_path: Path to audio file (for transcription fallback)
        
        Returns: LRC/lyrics string or None
        """
        
        # === Step 1: Try syncedlyrics ===
        if status_callback: status_callback("Searching lyric databases...")
        lyrics = self._try_syncedlyrics(track_name, artist_name, status_callback)
        if lyrics and validate_lrc(lyrics):
            return lyrics
        
        # === Step 2: Try Gemini AI research ===
        print(f"syncedlyrics failed or invalid, trying Gemini research...")
        if status_callback: status_callback("Databases failed. Researching with AI...")
        lyrics = self._try_gemini_research(track_name, artist_name, status_callback)
        if lyrics and validate_lrc(lyrics):
            return lyrics
        
        # === Step 3: Try Gemini audio transcription ===
        if file_path:
            print(f"Gemini research failed, trying audio transcription...")
            if status_callback: status_callback("Research failed. Listening to audio...")
            lyrics = self._try_gemini_transcription(file_path, track_name, artist_name, status_callback)
            if lyrics and validate_lrc(lyrics):
                return lyrics
        
        print(f"All lyric sources exhausted for: {track_name}")
        return None
    
    def _try_syncedlyrics(self, track_name: str, artist_name: str, status_callback=None) -> str | None:
        """Try multiple search variations with syncedlyrics"""
        search_terms = [
            f"{track_name} {artist_name}",
            f"{self.clean_text(track_name)} {artist_name}",
            f"{track_name}"
        ]
        
        # Remove duplicates while preserving order
        unique_terms = []
        [unique_terms.append(x) for x in search_terms if x not in unique_terms]

        for term in unique_terms:
            print(f"[syncedlyrics] Searching: {term}")
            try:
                lrc = syncedlyrics.search(term)
                if lrc:
                    # Validate immediately? Or let main loop do it. 
                    # Main loop does it, but we could do it here to retry other terms?
                    # Minimal change: let main loop handle validation failure by proceeding to next source.
                    # But syncedlyrics usually returns one result. If it's invalid, we probably want to try next source, not next term?
                    # Syncedlyrics usually returns good LRC or nothing.
                    print(f"[syncedlyrics] Found lyrics!")
                    return lrc
            except Exception as e:
                print(f"[syncedlyrics] Error: {e}")
                
        return None
    
    def _try_gemini_research(self, track_name: str, artist_name: str, status_callback=None, model_id: str | None = None) -> str | None:
        """Try Gemini AI knowledge-based lyric lookup"""
        if not gemini_service.is_available():
            print("[Gemini] Service not available (API key not set)")
            return None
            
        print(f"[Gemini] Researching lyrics for: {track_name} by {artist_name}")
        return gemini_service.research_lyrics(track_name, artist_name, status_callback, model_id=model_id)
    
    def _try_gemini_transcription(self, file_path: str, track_name: str, artist_name: str, status_callback=None, model_id: str | None = None) -> str | None:
        """Try Gemini AI audio transcription"""
        if not gemini_service.is_available():
            print("[Gemini] Service not available (API key not set)")
            return None
            
        print(f"[Gemini] Transcribing audio: {file_path}")
        return gemini_service.transcribe_audio(file_path, track_name, artist_name, status_callback, model_id=model_id)

lyricist = LyricistService()
