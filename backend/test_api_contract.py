import hashlib
import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from database import models
from database.database import SessionLocal
from main import DOWNLOADS_DIR, app, normalize_url


def _create_song(*, source_url: str | None, file_path: str | None):
    db = SessionLocal()
    artist = models.Artist(name=f"contract-artist-{uuid.uuid4().hex}")
    db.add(artist)
    db.flush()

    song = models.Song(
        title=f"contract-song-{uuid.uuid4().hex}",
        artist_id=artist.id,
        file_path=file_path,
        source_url=source_url,
        lyrics_synced=False,
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


def test_cors_allows_desktop_origins():
    from main import IS_DEV
    with TestClient(app) as client:
        # These are always allowed
        for origin in ("http://localhost:5173", "app://."):
            response = client.options(
                "/library",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            assert response.status_code == 200
            assert response.headers.get("access-control-allow-origin") == origin

        # These are gated by environment
        for origin in ("file://", "null"):
            response = client.options(
                "/library",
                headers={
                    "Origin": origin,
                    "Access-Control-Request-Method": "GET",
                },
            )
            if IS_DEV:
                assert response.status_code == 200
                assert response.headers.get("access-control-allow-origin") == origin
            else:
                # FastAPI/CORSMiddleware returns 400 or lacks the header if origin not allowed
                assert response.status_code != 200


def test_song_stream_url_uses_request_host():
    test_file = Path(DOWNLOADS_DIR) / f"contract-stream-{uuid.uuid4().hex}.mp3"
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_bytes(b"contract-stream")

    song_id = None
    artist_id = None
    try:
        song_id, artist_id = _create_song(source_url=None, file_path=str(test_file.resolve()))
        with TestClient(app) as client:
            response = client.get(f"/song/{song_id}")
        assert response.status_code == 200
        payload = response.json()
        assert payload["stream_url"].startswith("http://testserver/stream/")
        assert "localhost:8000/stream/" not in payload["stream_url"]
    finally:
        if song_id is not None and artist_id is not None:
            _delete_song(song_id, artist_id)
        if test_file.exists():
            test_file.unlink()


def test_get_song_does_not_auto_enqueue_rehydrate():
    source_url = f"https://www.youtube.com/watch?v={uuid.uuid4().hex[:11]}"
    normalized = normalize_url(source_url)
    idempotency_key = f"ingest_{hashlib.md5(normalized.encode()).hexdigest()}"

    missing_file_path = str((Path(DOWNLOADS_DIR) / f"missing-{uuid.uuid4().hex}.mp3").resolve())
    song_id = None
    artist_id = None

    db = SessionLocal()
    try:
        before_count = db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).count()
    finally:
        db.close()

    try:
        song_id, artist_id = _create_song(source_url=source_url, file_path=missing_file_path)
        with TestClient(app) as client:
            response = client.get(f"/song/{song_id}")
        assert response.status_code == 200
        assert response.json()["status"] == "expired"

        db = SessionLocal()
        try:
            after_count = db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).count()
        finally:
            db.close()
        assert after_count == before_count
    finally:
        if song_id is not None and artist_id is not None:
            _delete_song(song_id, artist_id)
