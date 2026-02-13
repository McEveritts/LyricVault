import importlib
import sys
import threading
from functools import lru_cache
from types import ModuleType


_LOCK = threading.RLock()


def _purge_yt_dlp_modules() -> None:
    for key in list(sys.modules.keys()):
        if key == "yt_dlp" or key.startswith("yt_dlp."):
            sys.modules.pop(key, None)


def _import_yt_dlp() -> ModuleType:
    # Intentionally import from the bundled/site environment only.
    # Avoid user-writable import paths to reduce local code-execution risk.
    mod = importlib.import_module("yt_dlp")
    importlib.import_module("yt_dlp.extractor.extractors")
    return mod


@lru_cache(maxsize=1)
def get_yt_dlp() -> ModuleType:
    with _LOCK:
        return _import_yt_dlp()


def reload_yt_dlp() -> ModuleType:
    with _LOCK:
        importlib.invalidate_caches()
        _purge_yt_dlp_modules()
        get_yt_dlp.cache_clear()
        return get_yt_dlp()
