import yt_dlp
import os
import shutil
import glob
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
    # 2. Dynamically discover WinGet-installed FFmpeg (works for any user)
    app_data = os.environ.get("LOCALAPPDATA", "")
    if app_data:
        winget_base = os.path.join(app_data, "Microsoft", "WinGet", "Packages")
        if os.path.isdir(winget_base):
            for pkg_dir in os.listdir(winget_base):
                if "FFmpeg" in pkg_dir:
                    bin_candidates = glob.glob(os.path.join(winget_base, pkg_dir, "**", "bin"), recursive=True)
                    for bin_dir in bin_candidates:
                        if os.path.isfile(os.path.join(bin_dir, "ffmpeg.exe")):
                            return bin_dir
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

    def search_platforms(self, query: str, platform: str):
        """Search for content on YT, Spotify, or SoundCloud using yt-dlp search"""
        search_prefix = {
            "youtube": "ytsearch5:",
            "spotify": "ytsearch5:", # yt-dlp can handle spotify links/search via YT
            "soundcloud": "scsearch5:"
        }.get(platform, "ytsearch5:")

        search_query = f"{search_prefix}{query}"
        logger.info(f"Searching {platform} with query: {search_query}")
        
        try:
            print(f"[DEBUG] search_platforms: platform={platform}, search_query={search_query}")
            with yt_dlp.YoutubeDL({'quiet': True, 'noplaylist': True, 'ffmpeg_location': FFMPEG_DIR}) as ydl:
                info = ydl.extract_info(search_query, download=False)
                print(f"[DEBUG] yt-dlp info retrieved: {bool(info)}")
                results = []
                if not info or 'entries' not in info:
                    logger.warning(f"No results found for {platform}")
                    return []

                for entry in info.get('entries', []):
                    if entry:
                        results.append({
                            "id": entry.get('id'),
                            "title": entry.get('title'),
                            "artist": entry.get('uploader') or entry.get('artist'),
                            "url": entry.get('webpage_url') or entry.get('url'),
                            "duration": entry.get('duration'),
                            "thumbnail": entry.get('thumbnail'),
                            "platform": platform
                        })
                logger.debug(f"Found {len(results)} results for {platform}")
                return results
        except Exception as e:
            msg = str(e)
            logger.error(f"Search failed for {platform}: {msg}")
            if "No supported JavaScript runtime" in msg:
                logger.warning("YT-DLP search may be limited due to missing JS runtime. Consider installing Node.js or Deno.")
            return []

ingestor = IngestionService()
