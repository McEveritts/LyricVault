import importlib
import subprocess
import sys
import os
from datetime import datetime, timezone

import yt_dlp

from . import settings_service

SMOKE_TEST_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
PIP_TIMEOUT_SECONDS = 600

def _get_user_lib_dir() -> str:
    """Return the user-writable library directory for yt-dlp updates."""
    app_data = os.environ.get("APPDATA", os.path.expanduser("~"))
    lib_dir = os.path.join(app_data, "LyricVault", "py_libs")
    os.makedirs(lib_dir, exist_ok=True)
    return lib_dir

# Ensure user lib dir is in sys.path so we can import updated modules
USER_LIB_DIR = _get_user_lib_dir()
if USER_LIB_DIR not in sys.path:
    sys.path.insert(0, USER_LIB_DIR)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _truncate(text: str, limit: int = 400) -> str:
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."


class YtDlpManager:
    def get_version(self) -> str | None:
        try:
            # Check if yt_dlp is actually imported
            if 'yt_dlp' not in sys.modules:
                print("[YtDlpManager] yt_dlp module not in sys.modules!")
                return None
            return yt_dlp.version.__version__
        except Exception as e:
            print(f"[YtDlpManager] Failed to get version: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _reload_module(self):
        global yt_dlp
        importlib.invalidate_caches()
        try:
            yt_dlp = importlib.reload(yt_dlp)
            print(f"[YtDlpManager] Reloaded yt-dlp. New version: {self.get_version()}")
        except Exception as e:
             print(f"[YtDlpManager] Failed to reload yt-dlp: {e}")

    def smoke_test(self, url: str = SMOKE_TEST_URL) -> bool:
        opts = {
            "quiet": True,
            "skip_download": True,
            "noplaylist": True,
            "socket_timeout": 15,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        return bool(info)

    def _run_pip_install(self, package_spec: str, *, upgrade: bool = False) -> subprocess.CompletedProcess:
        command = [sys.executable, "-m", "pip", "install"]
        if upgrade:
            command.append("--upgrade")
        
        # Target the user-writable directory
        command.extend(["--target", USER_LIB_DIR])
        
        command.append(package_spec)
        return subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=PIP_TIMEOUT_SECONDS,
            check=False,
        )

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
        previous_version = self.get_version()
        state = settings_service.get_ytdlp_state()
        last_known_good = state.get("last_known_good_version") or previous_version

        settings_service.update_ytdlp_state(
            last_checked_at=_now_iso(),
            last_update_status="updating",
            last_update_error=None,
        )

        try:
            upgrade_result = self._run_pip_install("yt-dlp", upgrade=True)
        except Exception as e:
            err = f"yt-dlp upgrade command failed: {e}"
            settings_service.update_ytdlp_state(
                last_checked_at=_now_iso(),
                last_update_status="failed",
                last_update_error=_truncate(err),
                last_smoke_test_ok=False,
            )
            return {
                "status": "failed",
                "previous_version": previous_version,
                "current_version": self.get_version(),
                "error": err,
            }

        if upgrade_result.returncode != 0:
            stderr = (upgrade_result.stderr or "").strip()
            stdout = (upgrade_result.stdout or "").strip()
            err = _truncate(stderr or stdout or "pip returned a non-zero exit code")
            settings_service.update_ytdlp_state(
                last_checked_at=_now_iso(),
                last_update_status="failed",
                last_update_error=err,
                last_smoke_test_ok=False,
            )
            return {
                "status": "failed",
                "previous_version": previous_version,
                "current_version": self.get_version(),
                "error": err,
            }

        self._reload_module()
        upgraded_version = self.get_version()

        smoke_error = None
        smoke_ok = False
        try:
            smoke_ok = self.smoke_test()
        except Exception as e:
            smoke_error = f"Post-update smoke test failed: {e}"
            smoke_ok = False

        if smoke_ok:
            settings_service.update_ytdlp_state(
                last_known_good_version=upgraded_version,
                last_checked_at=_now_iso(),
                last_update_status="success",
                last_update_error=None,
                last_smoke_test_ok=True,
            )
            return {
                "status": "success",
                "previous_version": previous_version,
                "current_version": upgraded_version,
                "rolled_back": False,
            }

        rollback_target = last_known_good
        rollback_error = None
        rolled_back = False
        if rollback_target:
            try:
                rollback_result = self._run_pip_install(f"yt-dlp=={rollback_target}", upgrade=False)
                if rollback_result.returncode == 0:
                    self._reload_module()
                    rolled_back = True
                else:
                    rollback_error = _truncate(
                        (rollback_result.stderr or "").strip()
                        or (rollback_result.stdout or "").strip()
                        or "rollback command returned non-zero exit code"
                    )
            except Exception as e:
                rollback_error = _truncate(f"yt-dlp rollback command failed: {e}")

        final_version = self.get_version()
        error_message = _truncate(smoke_error or rollback_error or "smoke test failed after upgrade")
        status = "rolled_back" if rolled_back else "failed"
        settings_service.update_ytdlp_state(
            last_known_good_version=rollback_target if rolled_back else last_known_good,
            last_checked_at=_now_iso(),
            last_update_status=status,
            last_update_error=error_message,
            last_smoke_test_ok=False,
        )
        return {
            "status": status,
            "previous_version": previous_version,
            "current_version": final_version,
            "rolled_back": rolled_back,
            "error": error_message,
        }


ytdlp_manager = YtDlpManager()
