from pathlib import Path
import sys
import uuid

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import models
import services.worker as worker_module
from services.worker import Worker


def _build_test_session(tmp_path):
    db_path = tmp_path / "migration_requeue_test.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)
    return session_local


def _seed_song(db, artist_id: int, idx: int, lyrics: str | None, lyrics_synced: bool):
    song = models.Song(
        title=f"migration-song-{idx}-{uuid.uuid4().hex[:8]}",
        artist_id=artist_id,
        file_path=f"C:/tmp/migration-{idx}-{uuid.uuid4().hex[:8]}.mp3",
        lyrics=lyrics,
        lyrics_synced=lyrics_synced,
        source_url=f"https://example.com/{uuid.uuid4().hex}",
    )
    db.add(song)
    db.flush()
    return song.id


def test_legacy_migration_queues_jobs_and_deduplicates(monkeypatch, tmp_path):
    session_local = _build_test_session(tmp_path)
    monkeypatch.setattr(worker_module, "SessionLocal", session_local)
    monkeypatch.setattr(worker_module.settings_service, "get_strict_lrc_mode", lambda: True)

    db = session_local()
    artist = models.Artist(name=f"migration-artist-{uuid.uuid4().hex}")
    db.add(artist)
    db.flush()

    valid_lrc_song_id = _seed_song(
        db,
        artist.id,
        1,
        "[00:01.00] A\n[00:02.00] B\n[00:03.00] C\n[00:04.00] D\n[00:05.00] E",
        False,
    )
    _seed_song(db, artist.id, 2, "plain text one\nline two", False)
    _seed_song(db, artist.id, 3, "plain text alpha\nline beta", False)
    db.commit()
    db.close()

    worker = Worker(worker_id="migration_test_worker")
    worker.legacy_lyrics_batch_size = 25
    worker._queue_legacy_unsynced_lyrics()
    worker._queue_legacy_unsynced_lyrics()  # Run twice to validate dedupe behavior

    db = session_local()
    try:
        valid_song = db.get(models.Song, valid_lrc_song_id)
        assert valid_song is not None
        assert valid_song.lyrics_synced is True

        jobs = db.query(models.Job).all()
        keys = [job.idempotency_key for job in jobs]
        assert len(keys) == len(set(keys))
        assert len([key for key in keys if key.startswith("lyrics_legacy_migrate_")]) == 2
    finally:
        db.close()


def test_legacy_migration_honors_batch_cap(monkeypatch, tmp_path):
    session_local = _build_test_session(tmp_path)
    monkeypatch.setattr(worker_module, "SessionLocal", session_local)
    monkeypatch.setattr(worker_module.settings_service, "get_strict_lrc_mode", lambda: True)

    db = session_local()
    artist = models.Artist(name=f"batch-artist-{uuid.uuid4().hex}")
    db.add(artist)
    db.flush()
    for i in range(30):
        _seed_song(db, artist.id, i, "legacy plain text\nline two", False)
    db.commit()
    db.close()

    worker = Worker(worker_id="migration_batch_worker")
    worker.legacy_lyrics_batch_size = 25
    worker._queue_legacy_unsynced_lyrics()

    db = session_local()
    try:
        jobs = db.query(models.Job).filter(
            models.Job.idempotency_key.like("lyrics_legacy_migrate_%")
        ).all()
        assert len(jobs) == 25
    finally:
        db.close()
