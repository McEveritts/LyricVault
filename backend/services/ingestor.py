import yt_dlp
try:
    import yt_dlp.extractor.extractors
except ImportError:
    pass
import os
import shutil
import glob
import requests
import re
from urllib.parse import urlparse
from fastapi import HTTPException

# Resolve Node.js for yt-dlp (avoids JS runtime warnings)
def _find_node_path():
    return shutil.which("node")

NODE_PATH = _find_node_path()

# Configure yt-dlp options
def _find_ffmpeg_dir():
    env_dir = os.environ.get("FFMPEG_DIR")
    if env_dir and os.path.isdir(env_dir):
        return env_dir
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
    if shutil.which("ffmpeg"):
        return os.path.dirname(shutil.which("ffmpeg"))
    return None

FFMPEG_DIR = _find_ffmpeg_dir()

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

def get_ydl_opts(download=True):
    opts = {
        'format': 'bestaudio/best',
        'ffmpeg_location': FFMPEG_DIR,
        'restrictfilenames': True,
        'windowsfilenames': True,
        'quiet': False,
        'no_warnings': False,
        'logger': YtDlpLogger(),
        'noplaylist': True,
    }
    if NODE_PATH:
        opts['javascript_path'] = NODE_PATH

    if download:
        opts.update({
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(DOWNLOADS_DIR, '%(id)s.%(ext)s'),
        })
    return opts

class IngestionService:
    @staticmethod
    def _extract_host(url: str) -> str:
        try:
            host = (urlparse(url.strip()).hostname or "").lower()
            if host.startswith("www."):
                host = host[4:]
            return host
        except Exception:
            return ""

    @staticmethod
    def _host_matches(host: str, domain: str) -> bool:
        return host == domain or host.endswith(f".{domain}")

    def parse_url(self, url: str):
        host = self._extract_host(url)
        if self._host_matches(host, "youtube.com") or self._host_matches(host, "youtu.be"):
            return "youtube"
        elif self._host_matches(host, "spotify.com"):
            return "spotify"
        elif self._host_matches(host, "soundcloud.com"):
            return "soundcloud"
        elif self._host_matches(host, "music.apple.com"):
            return "apple"
        return None

    def fetch_metadata_itunes(self, term: str, limit=1):
        try:
            url = f"https://itunes.apple.com/search?term={requests.utils.quote(term)}&media=music&limit={limit}"
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data['resultCount'] > 0:
                    results = []
                    for track in data['results']:
                        artwork = track.get('artworkUrl100', '').replace('100x100', '1000x1000')
                        results.append({
                            'title': track.get('trackName'),
                            'artist': track.get('artistName'),
                            'cover_url': artwork,
                            'album': track.get('collectionName'),
                            'year': track.get('releaseDate', '')[:4],
                            'duration': track.get('trackTimeMillis', 0) / 1000,
                        })
                    return results if limit > 1 else results[0]
        except Exception as e:
            logger.error(f"iTunes metadata fetch failed: {e}")
        return [] if limit > 1 else {}

    def _resolve_spotify_to_youtube(self, url: str):
        """Robust Spotify resolution using URL parsing and iTunes metadata"""
        logger.info(f"Resolving Spotify URL: {url}")
        
        # 1. Parse metadata from URL slug
        # e.g., https://open.spotify.com/track/1vY9lzUbe75I9lQ3kL7p4X?si=...
        # If the URL contains title-artist info in the slug (sometimes happens in shares)
        # but mostly it's just IDs. So we use the iTunes API with the "slug" if available
        # OR we just use the itunes search on the track ID if we had an API, but we don't.
        # However, we can use the Spotify OEmbed fallback with a cleaner check.
        
        title, artist = None, None
        
        # 0. Handle "manual" URLs from our own search results
        if "manual_" in url:
            try:
                # https://open.spotify.com/track/manual_Title-Artist
                slug = url.split("manual_", 1)[1]
                if "-" in slug:
                    title, artist = slug.rsplit("-", 1)
                    title = title.replace("-", " ")
                    artist = artist.replace("-", " ")
                else:
                    title = slug.replace("-", " ")
                logger.info(f"Parsed manual Spotify URL: {title} by {artist}")
            except Exception as e:
                logger.warning(f"Failed to parse manual Spotify URL: {e}")

        # 1. Strategy: Use OEmbed first, but handle failures
        if not title:
            try:
                oembed_url = f"https://open.spotify.com/oembed?url={url}"
                resp = requests.get(oembed_url, timeout=5)
                if resp.status_code == 200:
                    data = resp.json()
                    full_title = data.get('title', '')
                    if " - " in full_title:
                        title, artist = full_title.rsplit(" - ", 1)
                    else:
                        title = full_title
            except:
                pass

        # Strategy: URL parsing fallback
        if not title:
            # Try to extract something from the URL if it was a share link with title info
            # e.g. open.spotify.com/track/ID/title-artist
            parts = url.split('/')
            if len(parts) > 4:
                potential_slug = parts[-1].split('?')[0].replace('-', ' ')
                if len(potential_slug) > 10:
                    title = potential_slug

        # Strategy: iTunes Search on whatever we have
        if title:
            meta = self.fetch_metadata_itunes(f"{title} {artist or ''}")
            if meta:
                title = meta.get('title')
                artist = meta.get('artist')

        if title and artist:
            search_query = f"{title} {artist}"
            logger.info(f"Resolved Spotify to: {search_query}. Searching YouTube...")
            yt_results = self.search_platforms(search_query, "youtube")
            if yt_results:
                return yt_results[0]['url']
        
        # Final fallback: generic yt-dlp search on the URL itself (experimental)
        return None

    def download_audio(self, url: str):
        platform = self.parse_url(url)
        
        if platform == "spotify":
            resolved_url = self._resolve_spotify_to_youtube(url)
            if resolved_url:
                url = resolved_url
                logger.info(f"Using resolved YouTube URL for Spotify: {url}")
            else:
                raise HTTPException(status_code=400, detail="Could not resolve Spotify track. Please search for the song manually.")

        try:
            with yt_dlp.YoutubeDL(get_ydl_opts(download=True)) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                final_filename = filename.rsplit('.', 1)[0] + '.mp3'
                
                artist = info.get('artist') or info.get('uploader')
                title = info.get('track') or info.get('title')
                itunes_meta = self.fetch_metadata_itunes(f"{title} {artist}")

                return {
                    "title": title,
                    "artist": artist,
                    "duration": info.get('duration'),
                    "file_path": os.path.abspath(final_filename),
                    "cover_url": itunes_meta.get('cover_url') if (isinstance(itunes_meta, dict) and itunes_meta.get('cover_url')) else info.get('thumbnail'),
                    "album": itunes_meta.get('album') if isinstance(itunes_meta, dict) else None
                }
        except Exception as e:
            logger.error(f"Error downloading: {e}")
            raise HTTPException(status_code=400, detail=f"Download failed: {str(e)}")

    def search_platforms(self, query: str, platform: str):
        if platform == "spotify":
            itunes_results = self.fetch_metadata_itunes(query, limit=5)
            if itunes_results:
                results = []
                for res in itunes_results:
                    # Encode metadata in the URL for our resolver to pick up
                    # This ensures "Add to Library" works for Spotify search results
                    search_slug = f"{res['title']} {res['artist']}".replace(" ", "-")
                    dummy_url = f"https://open.spotify.com/track/manual_{search_slug}"
                    results.append({
                        "id": f"itunes_{res['title']}_{res['artist']}",
                        "title": res['title'],
                        "artist": res['artist'],
                        "url": dummy_url,
                        "duration": res['duration'],
                        "thumbnail": res['cover_url'],
                        "platform": "spotify"
                    })
                return results

        search_prefix = {
            "youtube": "ytsearch5:",
            "soundcloud": "scsearch5:"
        }.get(platform, "ytsearch5:")

        search_query = f"{search_prefix}{query}"
        
        try:
            opts = get_ydl_opts(download=False)
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(search_query, download=False)
                results = []
                if not info or 'entries' not in info:
                    return []

                for entry in info.get('entries', []):
                    if entry:
                        thumbnail = entry.get('thumbnail')
                        if platform == "soundcloud" and thumbnail:
                            thumbnail = thumbnail.replace("-large.jpg", "-t500x500.jpg")
                        
                        results.append({
                            "id": entry.get('id'),
                            "title": entry.get('title'),
                            "artist": entry.get('uploader') or entry.get('artist'),
                            "url": entry.get('webpage_url') or entry.get('url'),
                            "duration": entry.get('duration'),
                            "thumbnail": thumbnail,
                            "platform": platform
                        })
                return results
        except Exception as e:
            logger.error(f"Search failed for {platform}: {str(e)}")
            return []

ingestor = IngestionService()
