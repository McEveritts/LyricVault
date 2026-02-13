from datetime import datetime, timezone
import logging

from . import settings_service
from utils.ytdlp_loader import get_yt_dlp, reload_yt_dlp

SMOKE_TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate(text: str, limit: int = 400) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


class YtDlpManager:
    def get_version(self) -> str | None:
        try:
            yt_dlp = get_yt_dlp()
            return yt_dlp.version.__version__
        except Exception as e:
            logger.error("[YtDlpManager] Failed to get version: %s", e, exc_info=True)
            return None

    def _reload_module(self):
        try:
            reload_yt_dlp()
            logger.info("[YtDlpManager] Reloaded yt-dlp. New version: %s", self.get_version())
        except Exception as e:
            logger.error("[YtDlpManager] Failed to reload yt-dlp: %s", e, exc_info=True)

    def smoke_test(self, url: str = SMOKE_TEST_URL) -> bool:
        yt_dlp = get_yt_dlp()
        opts = {
            "quiet": True,
            "skip_download": True,
            "noplaylist": True,
            "socket_timeout": 15,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        return bool(info)

    def get_status(self) -> dict:
        state = settings_service.get_ytdlp_state()
        return {
            "version": self.get_version(),
            "last_known_good_version": state.get("last_known_good_version"),
            "last_checked_at": state.get("last_checked_at"),
            "last_update_status": state.get("last_update_status"),
            "last_update_error": state.get("last_update_error"),
            "last_smoke_test_ok": state.get("last_smoke_test_ok"),
        }

    def update_with_rollback(self) -> dict:
        # Desktop apps should update dependencies via signed app releases.
        # Runtime network installs (pip) are a supply-chain and code-execution risk.
        settings_service.update_ytdlp_state(
            last_checked_at=_now_iso(),
            last_update_status="unsupported",
            last_update_error="yt-dlp self-update is not supported; update LyricVault to get newer yt-dlp",
            last_smoke_test_ok=None,
        )
        return {
            "status": "unsupported",
            "current_version": self.get_version(),
            "error": "yt-dlp self-update is not supported; update LyricVault to get newer yt-dlp",
        }


ytdlp_manager = YtDlpManager()
