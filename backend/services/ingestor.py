import yt_dlp
import os
import shutil
import requests
import re
from fastapi import HTTPException

# Configure yt-dlp options
# Resolve ffmpeg: FFMPEG_DIR env (set by Electron) → WinGet install → system PATH
def _find_ffmpeg_dir():
    # 1. Environment variable (set by Electron's main.js for packaged app)
    env_dir = os.environ.get("FFMPEG_DIR")
    if env_dir and os.path.isdir(env_dir):
        return env_dir
    # 2. Known WinGet installation path (development)
    winget_path = r"C:\Users\McEveritts\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin"
    if os.path.isdir(winget_path):
        return winget_path
    # 3. System PATH
    if shutil.which("ffmpeg"):
        return os.path.dirname(shutil.which("ffmpeg"))
    return None

FFMPEG_DIR = _find_ffmpeg_dir()

# Resolve downloads directory to an absolute path so it works regardless of CWD
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOWNLOADS_DIR = os.path.join(BACKEND_DIR, "downloads")
os.makedirs(DOWNLOADS_DIR, exist_ok=True)

import logging

logger = logging.getLogger(__name__)

class YtDlpLogger:
    def debug(self, msg):
        if not msg.startswith('[debug] '):
            logger.debug(msg)

    def warning(self, msg):
        logger.warning(msg)

    def error(self, msg):
        logger.error(msg)

YDL_OPTIONS = {
    'format': 'bestaudio/best',
    'ffmpeg_location': FFMPEG_DIR,
    'restrictfilenames': True,
    'windowsfilenames': True,
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
    'outtmpl': os.path.join(DOWNLOADS_DIR, '%(id)s.%(ext)s'),
    'quiet': False,
    'no_warnings': False,
    'logger': YtDlpLogger(),
    'noplaylist': True,
}

class IngestionService:
    def parse_url(self, url: str):
        """
        Identify the platform from the URL.
        Returns: 'youtube', 'spotify', 'soundcloud', 'apple', or None.
        """
        if "youtube.com" in url or "youtu.be" in url:
            return "youtube"
        elif "spotify.com" in url:
            return "spotify"
        elif "soundcloud.com" in url:
            return "soundcloud"
        elif "music.apple.com" in url:
            return "apple"
        return None

    def fetch_metadata_itunes(self, term: str):
        """Fetch metadata including cover art from iTunes API"""
        try:
            url = f"https://itunes.apple.com/search?term={requests.utils.quote(term)}&media=music&limit=1"
            response = requests.get(url)
            if response.status_code == 200:
                data = response.json()
                if data['resultCount'] > 0:
                    track = data['results'][0]
                    # Get high-res image (100x100 -> 600x600)
                    artwork = track.get('artworkUrl100', '').replace('100x100', '600x600')
                    return {
                        'cover_url': artwork,
                        'album': track.get('collectionName'),
                        'year': track.get('releaseDate', '')[:4]
                    }
        except Exception as e:
            print(f"iTunes metadata fetch failed: {e}")
        return {}

    def download_audio(self, url: str):
        """
        Download audio using yt-dlp.
        Returns the path to the downloaded file and metadata.
        """
        try:
            with yt_dlp.YoutubeDL(YDL_OPTIONS) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                # yt-dlp converts the ext to mp3 post-process, so we need to adjust
                final_filename = filename.rsplit('.', 1)[0] + '.mp3'
                
                # Metadata refinement
                artist = info.get('artist') or info.get('uploader')
                title = info.get('track') or info.get('title')
                
                # Fetch richer metadata
                itunes_meta = self.fetch_metadata_itunes(f"{title} {artist}")

                return {
                    "title": title,
                    "artist": artist,
                    "duration": info.get('duration'),
                    "file_path": os.path.abspath(final_filename),
                    "cover_url": itunes_meta.get('cover_url'),
                    "album": itunes_meta.get('album')
                }
        except Exception as e:
            # Cleanup if partially downloaded?
            print(f"Error downloading: {e}")
            raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}")

ingestor = IngestionService()
