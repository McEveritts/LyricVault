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
from bs4 import BeautifulSoup

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
                if "FFmpeg" in pkg_dir and re.match(r'^[a-zA-Z0-9\.-]+$', pkg_dir):
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
        elif self._host_matches(host, "tiktok.com"):
            return "tiktok"
        elif self._host_matches(host, "instagram.com"):
            return "instagram"
        elif self._host_matches(host, "facebook.com") or self._host_matches(host, "fb.watch"):
            return "facebook"
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

    @staticmethod
    def _normalize_social_sources(social_sources: str | None) -> list[str]:
        default = ["instagram", "tiktok", "facebook"]
        if not social_sources:
            return default
        selected = {
            token.strip().lower()
            for token in social_sources.split(",")
            if token and token.strip()
        }
        normalized = [source for source in default if source in selected]
        return normalized or default

    @staticmethod
    def _is_url_query(query: str) -> bool:
        try:
            parsed = urlparse(query.strip())
            return parsed.scheme in {"http", "https"} and bool(parsed.netloc)
        except Exception:
            return False

    def _search_google(self, query: str, platform: str, limit: int = 5) -> list[dict]:
        """
        Fallback search using Google to find social media links.
        This is necessary because yt-dlp does not support search for these platforms.
        """
        try:
            site_map = {
                "tiktok": "tiktok.com",
                "instagram": "instagram.com",
                "facebook": "facebook.com",
            }
            site = site_map.get(platform)
            if not site:
                return []

            search_query = f"site:{site} {query}"
            url = f"https://www.google.com/search?q={requests.utils.quote(search_query)}"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code != 200:
                logger.warning(f"Google search failed with status {resp.status_code}")
                return []

            soup = BeautifulSoup(resp.text, 'html.parser')
            results = []
            
            # This selector is fragile and may change, but it's a common valid one for Google results
            # We look for all 'a' tags and filter those that look like results
            for a in soup.find_all('a'):
                href = a.get('href')
                if not href:
                    continue
                
                # Handling Google's tracking links if processed by generic parsers, 
                # but usually with this UA we get decent HTML.
                # However, simpler to just check if href contains our site
                # Clean Google tracking links
                if "/url?" in href:
                    try:
                        from urllib.parse import parse_qs, unquote
                        parsed = urlparse(href)
                        query_params = parse_qs(parsed.query)
                        if 'q' in query_params:
                            href = query_params['q'][0]
                    except Exception:
                        pass
                
                # Check again after cleaning
                if site in href and "google.com" not in href:
                    # Clean the URL if needed, but usually it's fine
                    title_elem = a.find('h3')
                    title = title_elem.get_text() if title_elem else platform.capitalize() + " Link"
                    
                    results.append({
                        "id": href, # Use URL as ID
                        "title": title,
                        "artist": platform.capitalize(), # Placeholder
                        "uploader": platform.capitalize(),
                        "url": href,
                        "duration": None, # Cannot know duration from Google Search
                        "thumbnail": None, # Cannot know thumbnail easily
                        "platform": platform,
                    })
                    if len(results) >= limit:
                        break
            
            if len(results) == 0:
                logger.warning(f"Google search returned 0 results. Page title: {soup.title.string if soup.title else 'No Title'}")
            
            return results
        except Exception as e:
            logger.error(f"Google search error: {e}")
            return []

    def _search_with_prefix(self, query: str, prefix: str, platform: str, limit: int = 5) -> list[dict]:
        search_query = f"{prefix}{query}"
        try:
            opts = get_ydl_opts(download=False)
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(search_query, download=False)
                if not info or "entries" not in info:
                    return []

                results = []
                for entry in (info.get("entries") or [])[:limit]:
                    if not entry:
                        continue
                    thumbnail = entry.get("thumbnail")
                    if platform == "soundcloud" and thumbnail:
                        thumbnail = thumbnail.replace("-large.jpg", "-t500x500.jpg")
                    results.append({
                        "id": entry.get("id"),
                        "title": entry.get("title"),
                        "artist": entry.get("uploader") or entry.get("artist"),
                        "uploader": entry.get("uploader") or entry.get("artist"),
                        "url": entry.get("webpage_url") or entry.get("url"),
                        "duration": entry.get("duration"),
                        "thumbnail": thumbnail,
                        "platform": platform,
                    })
                return results
        except Exception as e:
            logger.warning(f"Search failed for {platform}: {str(e)}")
            return []

    def _search_direct_url(self, url: str, platform_hint: str | None = None) -> list[dict]:
        """
        Best-effort metadata extraction for direct social links.
        This is the reliable path for Social discovery in current extractor limits.
        """
        try:
            opts = get_ydl_opts(download=False)
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
        except Exception as e:
            logger.warning(f"Direct URL search failed for {url}: {e}")
            return []

        if not info:
            return []

        entries = info.get("entries") if isinstance(info, dict) else None
        extracted_platform = platform_hint or self.parse_url(url) or "social"

        def to_result(entry: dict) -> dict:
            return {
                "id": entry.get("id"),
                "title": entry.get("title"),
                "artist": entry.get("uploader") or entry.get("artist"),
                "uploader": entry.get("uploader") or entry.get("artist"),
                "url": entry.get("webpage_url") or entry.get("url") or url,
                "duration": entry.get("duration"),
                "thumbnail": entry.get("thumbnail"),
                "platform": extracted_platform,
            }

        if isinstance(entries, list):
            return [to_result(entry) for entry in entries[:5] if entry]
        if isinstance(info, dict):
            return [to_result(info)]
        return []

    def search_platforms(self, query: str, platform: str, social_sources: str | None = None):
        # Global Direct URL Handling
        # If the query is a URL for a supported platform, handle it directly regardless of the 'platform' argument.
        if self._is_url_query(query):
            detected = self.parse_url(query)
            if detected in ["tiktok", "instagram", "facebook", "youtube", "soundcloud"]:
                logger.info(f"Direct URL detected for {detected}: {query}")
                return self._search_direct_url(query, platform_hint=detected)

        if platform == "spotify":
            itunes_results = self.fetch_metadata_itunes(query, limit=5)
            if itunes_results:
                results = []
                for res in itunes_results:
                    # Encode metadata in the URL for our resolver to pick up.
                    search_slug = f"{res['title']} {res['artist']}".replace(" ", "-")
                    dummy_url = f"https://open.spotify.com/track/manual_{search_slug}"
                    results.append({
                        "id": f"itunes_{res['title']}_{res['artist']}",
                        "title": res['title'],
                        "artist": res['artist'],
                        "uploader": res['artist'],
                        "url": dummy_url,
                        "duration": res['duration'],
                        "thumbnail": res['cover_url'],
                        "platform": "spotify",
                    })
                return results

        if platform == "social":
            selected_sources = self._normalize_social_sources(social_sources)
            # URL check already handled above
            
            merged: list[dict] = []
            for source in selected_sources:
                logger.info(f"Searching {source} via Google for query '{query}'")
                results = self._search_google(query, source, limit=3)
                logger.info(f"Found {len(results)} results for {source}")
                merged.extend(results)

            # Deduplicate by URL while preserving order.
            seen_urls: set[str] = set()
            deduped = []
            for item in merged:
                url = item.get("url")
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                deduped.append(item)
            return deduped

        if platform in ["tiktok", "instagram", "facebook"]:
            return self._search_google(query, platform, limit=5)

        search_prefix = {
            "youtube": "ytsearch5:",
            "soundcloud": "scsearch5:",
        }.get(platform, "ytsearch5:")
        return self._search_with_prefix(query, search_prefix, platform, limit=5)

ingestor = IngestionService()
