#!/usr/bin/env python
"""
Bridge CLI used by the Tauri/Rust runtime to call proven Python services
without reintroducing a localhost backend API.

Contract:
- Input: JSON object from stdin
- Output (stdout):
  - success: {"ok": true, "data": ...}
  - error:   {"ok": false, "error": "..."}
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any


def _bootstrap_import_path() -> None:
    backend_dir = Path(__file__).resolve().parents[1]
    backend_dir_str = str(backend_dir)
    if backend_dir_str not in sys.path:
        sys.path.insert(0, backend_dir_str)


_bootstrap_import_path()

from services.ingestor import ingestor  # noqa: E402
from services.lyricist import lyricist  # noqa: E402
from utils.lrc_validator import validate_lrc  # noqa: E402


def _read_payload() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON payload: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")
    return payload


def _action_search_music(payload: dict[str, Any]) -> list[dict[str, Any]]:
    query = str(payload.get("q", "")).strip()
    if not query:
        return []
    platform = str(payload.get("platform", "youtube")).strip() or "youtube"
    social_sources = payload.get("social_sources")
    if social_sources is not None:
        social_sources = str(social_sources)
    return ingestor.search_platforms(query, platform, social_sources=social_sources)


def _action_download_audio(payload: dict[str, Any]) -> dict[str, Any]:
    url = str(payload.get("url", "")).strip()
    if not url:
        raise ValueError("Missing required field: url")
    result = ingestor.download_audio(url)
    if not isinstance(result, dict):
        raise RuntimeError("Unexpected download_audio response type")
    return result


def _normalize_lyrics_result(
    lyrics: str | None,
    source: str,
    failure_reason: str | None,
) -> dict[str, Any]:
    text = lyrics if isinstance(lyrics, str) and lyrics.strip() else None
    synced = bool(text and validate_lrc(text))
    return {
        "lyrics": text,
        "source": source,
        "synced": synced,
        "failure_reason": failure_reason,
    }


def _action_research_lyrics(payload: dict[str, Any]) -> dict[str, Any]:
    title = str(payload.get("title", "")).strip()
    artist = str(payload.get("artist", "Unknown")).strip() or "Unknown"
    file_path_value = payload.get("file_path")
    file_path = str(file_path_value).strip() if file_path_value else None
    mode = str(payload.get("mode", "auto")).strip().lower() or "auto"
    model_id_value = payload.get("model_id")
    model_id = str(model_id_value).strip() if model_id_value else None

    if not title:
        raise ValueError("Missing required field: title")

    if mode == "transcribe":
        if not file_path or not os.path.exists(file_path):
            return _normalize_lyrics_result(
                lyrics=None,
                source="gemini_transcription",
                failure_reason="source_unavailable",
            )
        lyrics = lyricist._try_gemini_transcription(
            file_path,
            title,
            artist,
            model_id=model_id,
        )
        return _normalize_lyrics_result(
            lyrics=lyrics,
            source="gemini_transcription",
            failure_reason=lyricist._last_gemini_transcription_reason if not lyrics else None,
        )

    if mode == "research":
        lyrics = lyricist._try_gemini_research(
            title,
            artist,
            model_id=model_id,
        )
        return _normalize_lyrics_result(
            lyrics=lyrics,
            source="gemini_research",
            failure_reason=lyricist._last_gemini_research_reason if not lyrics else None,
        )

    if model_id:
        lyrics = lyricist._try_gemini_research(
            title,
            artist,
            model_id=model_id,
        )
        if lyrics:
            return _normalize_lyrics_result(
                lyrics=lyrics,
                source="gemini_research",
                failure_reason=None,
            )
        if file_path and os.path.exists(file_path):
            lyrics = lyricist._try_gemini_transcription(
                file_path,
                title,
                artist,
                model_id=model_id,
            )
            return _normalize_lyrics_result(
                lyrics=lyrics,
                source="gemini_transcription",
                failure_reason=lyricist._last_gemini_transcription_reason if not lyrics else None,
            )
        return _normalize_lyrics_result(
            lyrics=None,
            source="gemini_research",
            failure_reason=lyricist._last_gemini_research_reason,
        )

    outcome = lyricist.transcribe(title, artist, file_path)
    if isinstance(outcome, dict):
        return _normalize_lyrics_result(
            lyrics=outcome.get("lyrics"),
            source=str(outcome.get("source", "auto")),
            failure_reason=outcome.get("failure_reason"),
        )
    if isinstance(outcome, str):
        return _normalize_lyrics_result(
            lyrics=outcome,
            source="auto",
            failure_reason=None,
        )
    return _normalize_lyrics_result(
        lyrics=None,
        source="none",
        failure_reason="not_found",
    )


ACTIONS = {
    "search_music": _action_search_music,
    "download_audio": _action_download_audio,
    "research_lyrics": _action_research_lyrics,
}


def main() -> int:
    parser = argparse.ArgumentParser(description="LyricVault Python bridge CLI")
    parser.add_argument(
        "action",
        choices=sorted(ACTIONS.keys()),
        help="Bridge action to execute",
    )
    args = parser.parse_args()

    try:
        payload = _read_payload()
        data = ACTIONS[args.action](payload)
        print(json.dumps({"ok": True, "data": data}, ensure_ascii=True))
        return 0
    except Exception as exc:  # pragma: no cover - explicit bridge error contract
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=True))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
