import importlib
import os
from pathlib import Path

from services import ingestor


def _touch_ffmpeg(bin_dir: Path):
    bin_dir.mkdir(parents=True, exist_ok=True)
    (bin_dir / "ffmpeg.exe").write_text("dummy", encoding="utf-8")


def test_winget_resolution_skips_invalid_package_names(monkeypatch, tmp_path):
    """
    Windows edge case: ensure _find_ffmpeg_dir ignores WinGet package folders
    with characters outside the strict whitelist (prevents crafted names
    such as 'FFmpeg;evil' from being used as an executable search path).
    """
    winget_base = tmp_path / "Microsoft" / "WinGet" / "Packages"

    # Valid, should be selected
    valid_bin = winget_base / "FFmpeg.Safe" / "bin"
    _touch_ffmpeg(valid_bin)

    # Invalid package name (semicolon would be rejected by the regex)
    invalid_bin = winget_base / "FFmpeg;evil" / "bin"
    _touch_ffmpeg(invalid_bin)

    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path))

    # Recompute using fresh environment
    importlib.reload(ingestor)

    path = ingestor._find_ffmpeg_dir()
    assert path is not None
    assert Path(path).resolve() == valid_bin.resolve()
    # Ensure the invalid package was ignored
    assert ";evil" not in str(path)
