import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import models
from database.database import SessionLocal
from main import app
from services import settings_service


def _create_song(*, lyrics: str | None, lyrics_synced: bool):
    db = SessionLocal()
    artist = models.Artist(name=f"status-artist-{uuid.uuid4().hex}")
    db.add(artist)
    db.flush()

    song = models.Song(
        title=f"status-song-{uuid.uuid4().hex}",
        artist_id=artist.id,
        file_path=None,
        source_url=f"https://example.com/{uuid.uuid4().hex}",
        lyrics=lyrics,
        lyrics_synced=lyrics_synced,
    )
    db.add(song)
    db.commit()
    db.refresh(song)
    song_id = song.id
    artist_id = artist.id
    db.close()
    return song_id, artist_id


def _delete_song(song_id: int, artist_id: int):
    db = SessionLocal()
    try:
        song = db.get(models.Song, song_id)
        if song:
            db.delete(song)
        artist = db.get(models.Artist, artist_id)
        if artist:
            db.delete(artist)
        db.commit()
    finally:
        db.close()


def test_song_status_unavailable_when_strict_mode_enabled_for_plain_text():
    original_mode = settings_service.get_strict_lrc_mode()
    song_id, artist_id = _create_song(
        lyrics="This is plain text\nNot synced\nAt all",
        lyrics_synced=False,
    )
    try:
        settings_service.set_strict_lrc_mode(True)
        with TestClient(app) as client:
            response = client.get(f"/song/{song_id}")
        assert response.status_code == 200
        payload = response.json()
        assert payload["lyrics_status"] == "unavailable"
        assert payload["lyrics_synced"] is False
    finally:
        settings_service.set_strict_lrc_mode(original_mode)
        _delete_song(song_id, artist_id)


def test_song_status_unsynced_when_fallback_mode_enabled():
    original_mode = settings_service.get_strict_lrc_mode()
    song_id, artist_id = _create_song(
        lyrics="This is plain text\nNot synced\nAt all",
        lyrics_synced=False,
    )
    try:
        settings_service.set_strict_lrc_mode(False)
        with TestClient(app) as client:
            response = client.get(f"/song/{song_id}")
        assert response.status_code == 200
        payload = response.json()
        assert payload["lyrics_status"] == "unsynced"
        assert payload["lyrics_synced"] is False
    finally:
        settings_service.set_strict_lrc_mode(original_mode)
        _delete_song(song_id, artist_id)


def test_song_status_ready_for_valid_lrc():
    original_mode = settings_service.get_strict_lrc_mode()
    song_id, artist_id = _create_song(
        lyrics=(
            "[00:01.00] Line 1\n"
            "[00:02.00] Line 2\n"
            "[00:03.00] Line 3\n"
            "[00:04.00] Line 4\n"
            "[00:05.00] Line 5"
        ),
        lyrics_synced=True,
    )
    try:
        settings_service.set_strict_lrc_mode(True)
        with TestClient(app) as client:
            response = client.get(f"/song/{song_id}")
        assert response.status_code == 200
        payload = response.json()
        assert payload["lyrics_status"] == "ready"
        assert payload["lyrics_synced"] is True
    finally:
        settings_service.set_strict_lrc_mode(original_mode)
        _delete_song(song_id, artist_id)
