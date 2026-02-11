"""
End-to-end Gemini integration tests for LyricVault.

These tests validate:
1. Service initialization
2. Lyric research
3. Audio transcription (when an mp3 exists in backend/downloads)
"""

import os
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
load_dotenv()

from services.gemini_service import gemini_service


def _print_header(title: str) -> None:
    print("\n" + "=" * 50)
    print(title)
    print("=" * 50)


def _first_audio_file() -> str | None:
    downloads_dir = Path(__file__).resolve().parent / "downloads"
    if not downloads_dir.exists():
        return None

    for path in sorted(downloads_dir.glob("*.mp3")):
        return str(path)
    return None


def _require_service_or_skip() -> None:
    if not gemini_service.is_available():
        pytest.skip("Gemini service is not available (missing/invalid API key).")


def test_initialization():
    _print_header("TEST 1: Service Initialization")
    _require_service_or_skip()

    assert gemini_service.is_available()
    assert gemini_service.model
    print("PASS: GeminiService initialized successfully")
    print(f"Model: {gemini_service.model}")


def test_lyric_research():
    _print_header("TEST 2: Lyric Research")
    _require_service_or_skip()

    lyrics = gemini_service.research_lyrics("Bohemian Rhapsody", "Queen")
    assert lyrics is not None, "No lyrics returned from Gemini research."
    assert len(lyrics) >= 100, "Lyrics output is unexpectedly short."
    print("PASS: Successfully retrieved lyrics")
    print(f"Length: {len(lyrics)} characters")
    print(f"Preview: {lyrics[:100]}...")


def test_audio_transcription():
    _print_header("TEST 3: Audio Transcription")
    _require_service_or_skip()

    audio_file = _first_audio_file()
    if not audio_file:
        pytest.skip("No mp3 file found in backend/downloads for transcription test.")

    print(f"Testing with: {Path(audio_file).name}")
    lyrics = gemini_service.transcribe_audio(audio_file, "Test Song", "Test Artist")
    assert lyrics is not None, "No transcription returned from Gemini."
    assert len(lyrics) >= 50, "Transcription output is unexpectedly short."
    print("PASS: Successfully transcribed audio")
    print(f"Length: {len(lyrics)} characters")
    print(f"Preview: {lyrics[:100]}...")


def _run_test(func) -> bool | None:
    """Run one check in script mode and return tri-state result."""
    try:
        func()
        return True
    except pytest.skip.Exception:
        return None
    except AssertionError as exc:
        print(f"FAIL: {exc}")
        return False
    except Exception as exc:  # pragma: no cover - script mode safety
        print(f"FAIL: {type(exc).__name__}: {exc}")
        return False


def run_all_tests() -> bool:
    """Run tests in script mode with a concise summary."""
    print("\n" + "=" * 50)
    print("GEMINI INTEGRATION TEST SUITE")
    print("=" * 50)

    results = {
        "initialization": _run_test(test_initialization),
        "lyric_research": _run_test(test_lyric_research),
        "audio_transcription": _run_test(test_audio_transcription),
    }

    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    for name, result in results.items():
        if result is True:
            status = "PASS"
        elif result is False:
            status = "FAIL"
        else:
            status = "SKIP"
        print(f"{name.replace('_', ' ').title()}: {status}")

    passed = sum(1 for r in results.values() if r is True)
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed")

    return all(r is not False for r in results.values())


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
