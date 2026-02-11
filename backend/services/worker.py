import logging
import threading
import time
import json
import socket
import os
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from database.database import SessionLocal
from database import models
from services.ingestor import ingestor
from services.lyricist import lyricist

logger = logging.getLogger(__name__)

class Worker:
    def __init__(self, worker_id=None):
        self.worker_id = worker_id or f"worker_{socket.gethostname()}_{os.getpid()}"
        self._stop_event = threading.Event()
        self._thread = None
        self.lease_duration = timedelta(minutes=5)

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="JobWorker")
        self._thread.start()
        logger.info(f"Worker {self.worker_id} started.")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join()
        logger.info(f"Worker {self.worker_id} stopped.")

    def _run(self):
        # Startup: Requeue stale jobs
        self._requeue_stale_jobs()
        
        while not self._stop_event.is_set():
            try:
                job_processed = self._process_one_job()
                if not job_processed:
                    time.sleep(2) # Back off if no work
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                time.sleep(5)

    def _requeue_stale_jobs(self):
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            stale = db.query(models.Job).filter(
                models.Job.status == "processing",
                models.Job.leased_until < now
            ).all()
            
            for job in stale:
                logger.info(f"Requeuing stale job {job.id}")
                job.status = "pending"
                job.worker_id = None
                job.leased_until = None
            db.commit()
        finally:
            db.close()

    def _process_one_job(self) -> bool:
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            lease_end = now + self.lease_duration
            
            # ATOMIC CLAIM: Update one available job with our worker_id
            # This prevents race conditions where multiple workers read the same 'pending' job.
            stmt = text("""
                UPDATE jobs 
                SET status='processing', 
                    worker_id=:worker_id, 
                    leased_until=:lease_end, 
                    started_at=:now,
                    updated_at=:now
                WHERE id = (
                    SELECT id FROM jobs 
                    WHERE (status='pending' OR status='failed')
                      AND available_at <= :now
                      AND retry_count < max_retries
                    ORDER BY created_at ASC 
                    LIMIT 1
                )
                RETURNING id
            """)
            
            result = db.execute(stmt, {
                "worker_id": self.worker_id,
                "lease_end": lease_end,
                "now": now
            })
            row = result.first()
            db.commit()

            if not row:
                return False

            job_id = row[0]
            job = db.get(models.Job, job_id)

            if not job:
                return False

            logger.info(f"[{self.worker_id}] Claimed job {job.id} ({job.type}) - {job.title or 'No Title'}")
            
            try:
                payload = json.loads(job.payload)
                
                if job.type == "ingest_audio":
                    self._handle_ingest(db, job, payload)
                elif job.type == "generate_lyrics":
                    self._handle_lyrics(db, job, payload)
                else:
                    raise ValueError(f"Unknown job type: {job.type}")

                job.status = "completed"
                job.progress = 100
                job.completed_at = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f"Job {job.id} failed: {e}")
                job.retry_count += 1
                job.last_error = str(e)
                
                if job.retry_count >= job.max_retries:
                    job.status = "failed"
                else:
                    # Exponential backoff: 30s, 2m, 10m...
                    delay = 30 * (4 ** (job.retry_count - 1))
                    job.available_at = datetime.now(timezone.utc) + timedelta(seconds=delay)
                    job.status = "pending"
            
            job.worker_id = None
            job.leased_until = None
            db.commit()
            return True
        finally:
            db.close()

    def _handle_ingest(self, db: Session, job: models.Job, payload: dict):
        from sqlalchemy.exc import IntegrityError
        url = payload.get("url")
        # Actual work
        job.progress = 20
        db.commit()

        metadata = ingestor.download_audio(url)
        
        job.progress = 60
        db.commit()

        # Update job title with metadata if available
        if metadata.get('title'):
            job.title = f"Ingesting: {metadata['artist']} - {metadata['title']}"
            db.commit()

        # Race protection for Artist
        artist = db.query(models.Artist).filter(models.Artist.name == metadata['artist']).first()
        if not artist:
            try:
                artist = models.Artist(name=metadata['artist'])
                db.add(artist)
                db.commit()
                db.refresh(artist)
            except IntegrityError:
                db.rollback()
                artist = db.query(models.Artist).filter(models.Artist.name == metadata['artist']).first()
            
        # Race protection for Song
        song = db.query(models.Song).filter(models.Song.file_path == metadata['file_path']).first()
        if not song:
            try:
                song = models.Song(
                    title=metadata['title'],
                    artist_id=artist.id,
                    file_path=metadata['file_path'],
                    duration=metadata['duration'],
                    source_url=url,
                    lyrics_synced=False,
                    cover_url=metadata.get('cover_url')
                )
                db.add(song)
                db.commit()
                db.refresh(song)
            except IntegrityError:
                db.rollback()
                song = db.query(models.Song).filter(models.Song.file_path == metadata['file_path']).first()

        job.result_json = json.dumps({"song_id": song.id, "file_path": song.file_path})
        
        # Chained job with title
        lyric_key = f"lyrics_{song.id}"
        existing_lyric = db.query(models.Job).filter(models.Job.idempotency_key == lyric_key).first()
        if not existing_lyric:
            new_job = models.Job(
                type="generate_lyrics",
                title=f"Lyrics: {artist.name} - {song.title}",
                idempotency_key=lyric_key,
                payload=json.dumps({
                    "song_id": song.id,
                    "title": song.title,
                    "artist": artist.name,
                    "file_path": song.file_path
                })
            )
            db.add(new_job)
        db.commit()

    def _handle_lyrics(self, db: Session, job: models.Job, payload: dict):
        song_id = payload.get("song_id")
        title = payload.get("title")
        artist = payload.get("artist")
        file_path = payload.get("file_path")
        mode = payload.get("mode", "auto")
        model_id = payload.get("model_id")

        if not job.title and title:
            job.title = f"Lyrics: {artist or 'Unknown'} - {title}"
            db.commit()

        if mode == "transcribe":
            if not file_path or not os.path.exists(file_path):
                raise ValueError("Audio file not found for transcription.")
            lyrics = lyricist._try_gemini_transcription(file_path, title, artist, model_id=model_id)
        elif mode == "research":
            lyrics = lyricist._try_gemini_research(title, artist, model_id=model_id)
        elif model_id:
            # Respect explicit model selection when manually queued.
            lyrics = lyricist._try_gemini_research(title, artist, model_id=model_id)
            if not lyrics and file_path and os.path.exists(file_path):
                lyrics = lyricist._try_gemini_transcription(file_path, title, artist, model_id=model_id)
        else:
            lyrics = lyricist.transcribe(title, artist, file_path)
        
        song = db.get(models.Song, song_id)
        if song:
            if lyrics:
                song.lyrics = lyrics
                song.lyrics_synced = True
                job.result_json = json.dumps({"status": "found"})
            else:
                song.lyrics = "Lyrics not found."
                job.result_json = json.dumps({"status": "not_found"})
            db.commit()

worker = Worker()
