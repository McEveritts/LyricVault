import logging
import threading
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
from services.ytdlp_manager import ytdlp_manager
from services import settings_service
from utils.lrc_validator import validate_lrc

logger = logging.getLogger(__name__)

def _normalize_duration_seconds(value):
    """Store duration as integer seconds in DB."""
    if value is None:
        return None
    try:
        seconds = float(value)
        if seconds < 0:
            return None
        return int(round(seconds))
    except (TypeError, ValueError):
        return None

class Worker:
    def __init__(self, worker_id=None):
        self.worker_id = worker_id or f"worker_{socket.gethostname()}_{os.getpid()}"
        self._stop_event = threading.Event()
        self._thread = None
        self._cleanup_thread = None
        self.lease_duration = timedelta(minutes=5)
        self.heartbeat_interval_seconds = 60
        self.cleanup_interval_seconds = 10 * 60
        self.audio_ttl_seconds = 60 * 60
        self.legacy_lyrics_batch_size = 25
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.downloads_dir = os.path.join(backend_dir, "downloads")
        self._audio_extensions = {
            ".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".opus", ".webm", ".mp4"
        }
        self.ytdlp_check_interval = timedelta(hours=24)

    def start(self):
        if self._thread and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="JobWorker")
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True, name="AudioCleanupWorker")
        self._thread.start()
        self._cleanup_thread.start()
        logger.info(f"Worker {self.worker_id} started.")

    def stop(self):
        self._stop_event.set()
        if self._thread:
            self._thread.join()
        if self._cleanup_thread:
            self._cleanup_thread.join()
        logger.info(f"Worker {self.worker_id} stopped.")

    def _run(self):
        # Startup: Requeue stale jobs
        self._requeue_stale_jobs()
        self._queue_legacy_unsynced_lyrics()
        
        while not self._stop_event.is_set():
            try:
                job_processed = self._process_one_job()
                if not job_processed:
                    self._stop_event.wait(2)  # Back off if no work
            except Exception as e:
                logger.error(f"Worker loop error: {e}")
                self._stop_event.wait(5)

    def _heartbeat(self, job_id: int) -> bool:
        """Extend a claimed job lease while it is actively being processed."""
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            lease_end = now + self.lease_duration
            stmt = text("""
                UPDATE jobs
                SET leased_until = :lease_end,
                    updated_at = :now
                WHERE id = :job_id
                  AND status = 'processing'
                  AND worker_id = :worker_id
                RETURNING id
            """)
            row = db.execute(stmt, {
                "lease_end": lease_end,
                "now": now,
                "job_id": job_id,
                "worker_id": self.worker_id,
            }).first()
            db.commit()
            return row is not None
        finally:
            db.close()

    def _heartbeat_loop(self, job_id: int, stop_event: threading.Event):
        while not stop_event.wait(self.heartbeat_interval_seconds):
            if self._stop_event.is_set():
                break
            try:
                renewed = self._heartbeat(job_id)
            except Exception as e:
                logger.warning(f"Heartbeat update failed for job {job_id}: {e}")
                continue
            if not renewed:
                logger.warning(f"Heartbeat stopped for job {job_id}; lease is no longer owned by {self.worker_id}.")
                break

    def _cleanup_loop(self):
        # Run once at startup, then every cleanup interval.
        self._cleanup_cached_audio()
        self._check_auto_maintenance()
        while not self._stop_event.wait(self.cleanup_interval_seconds):
            try:
                self._cleanup_cached_audio()
                self._check_auto_maintenance()
            except Exception as e:
                logger.error(f"Audio cleanup loop error: {e}", exc_info=True)

    def _cleanup_cached_audio(self):
        if not os.path.isdir(self.downloads_dir):
            return

        now_ts = datetime.now(timezone.utc).timestamp()
        removed_paths: list[str] = []

        for entry in os.scandir(self.downloads_dir):
            if not entry.is_file():
                continue
            _, ext = os.path.splitext(entry.name)
            if ext.lower() not in self._audio_extensions:
                continue

            try:
                modified_ts = entry.stat().st_mtime
            except OSError:
                continue

            if (now_ts - modified_ts) < self.audio_ttl_seconds:
                continue

            absolute_path = os.path.abspath(entry.path)
            try:
                os.remove(absolute_path)
                removed_paths.append(absolute_path)
                logger.info(f"Removed expired cached audio: {absolute_path}")
            except FileNotFoundError:
                continue
            except OSError as e:
                logger.warning(f"Failed to remove expired audio {absolute_path}: {e}")

        if not removed_paths:
            return

        db = SessionLocal()
        try:
            songs = db.query(models.Song).filter(models.Song.file_path.in_(removed_paths)).all()
            for song in songs:
                song.file_path = None
            if songs:
                db.commit()
                logger.info(f"Marked {len(songs)} song record(s) as expired after cache cleanup.")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update song cache metadata after cleanup: {e}", exc_info=True)
        finally:
            db.close()

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

    @staticmethod
    def _extract_song_id_from_payload(payload: str | None) -> int | None:
        if not payload:
            return None
        try:
            parsed = json.loads(payload)
        except Exception:
            return None
        raw_song_id = parsed.get("song_id")
        if isinstance(raw_song_id, int):
            return raw_song_id
        if isinstance(raw_song_id, str) and raw_song_id.isdigit():
            return int(raw_song_id)
        return None

    def _queue_legacy_unsynced_lyrics(self):
        """
        On startup, queue bounded lyric-regeneration jobs for legacy songs that
        still contain non-LRC text.
        """
        if not settings_service.get_strict_lrc_mode():
            return

        db = SessionLocal()
        try:
            active_song_ids: set[int] = set()
            active_jobs = db.query(models.Job).filter(
                models.Job.type == "generate_lyrics",
                models.Job.status.in_(["pending", "processing", "retrying"])
            ).all()
            for job in active_jobs:
                song_id = self._extract_song_id_from_payload(job.payload)
                if song_id is not None:
                    active_song_ids.add(song_id)

            candidates = db.query(models.Song).filter(
                models.Song.lyrics_synced == False,  # noqa: E712 - SQLAlchemy comparison
                models.Song.lyrics.isnot(None),
                models.Song.lyrics != "",
                models.Song.lyrics != "Lyrics not found.",
            ).order_by(models.Song.id.asc()).all()

            healed_count = 0
            queued_count = 0
            processed_count = 0
            for song in candidates:
                if processed_count >= self.legacy_lyrics_batch_size:
                    break

                lyrics_text = song.lyrics or ""
                if validate_lrc(lyrics_text):
                    song.lyrics_synced = True
                    healed_count += 1
                    processed_count += 1
                    continue

                if song.id in active_song_ids:
                    continue

                idempotency_key = f"lyrics_legacy_migrate_{song.id}"
                existing = db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).first()
                if existing:
                    continue

                payload = {
                    "song_id": song.id,
                    "title": song.title,
                    "artist": song.artist.name if song.artist else "Unknown",
                    "file_path": song.file_path,
                }
                db.add(models.Job(
                    type="generate_lyrics",
                    status="pending",
                    title=f"Lyrics Migration: {payload['artist']} - {payload['title']}",
                    idempotency_key=idempotency_key,
                    payload=json.dumps(payload),
                ))
                queued_count += 1
                processed_count += 1

            if healed_count or queued_count:
                db.commit()
                logger.info(
                    "Legacy lyric migration pass completed: healed=%s queued=%s batch_limit=%s",
                    healed_count,
                    queued_count,
                    self.legacy_lyrics_batch_size,
                )
        except Exception as e:
            db.rollback()
            logger.error(f"Legacy lyric migration pass failed: {e}", exc_info=True)
        finally:
            db.close()

    def _check_auto_maintenance(self):
        """Periodically check if yt-dlp needs an update."""
        try:
            state = settings_service.get_ytdlp_state()
            last_checked = state.get("last_checked_at")
            should_update = False
            now = datetime.now(timezone.utc)

            if not last_checked:
                should_update = True
            else:
                try:
                    last_dt = datetime.fromisoformat(last_checked)
                    # Handle legacy timestamps without execution
                    if last_dt.tzinfo is None:
                        last_dt = last_dt.replace(tzinfo=timezone.utc)
                    
                    if (now - last_dt) > self.ytdlp_check_interval:
                        should_update = True
                except ValueError:
                    should_update = True

            if should_update:
                db = SessionLocal()
                try:
                    idempotency_key = "maintenance_update_ytdlp"
                    existing = db.query(models.Job).filter(
                        models.Job.idempotency_key == idempotency_key,
                        models.Job.status.in_(["pending", "processing", "retrying"])
                    ).first()

                    if not existing:
                        payload = {"requested_at": now.isoformat(), "auto_trigger": True}
                        job = models.Job(
                            type="maintenance_update_ytdlp",
                            title="Auto-Maintenance: Update yt-dlp",
                            status="pending",
                            idempotency_key=idempotency_key,
                            payload=json.dumps(payload),
                        )
                        db.add(job)
                        db.commit()
                        logger.info("Enqueued auto-maintenance yt-dlp update job.")
                finally:
                    db.close()
        except Exception as e:
            logger.error(f"Auto-maintenance check failed: {e}")

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
                    WHERE (status='pending' OR status='retrying')
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

            heartbeat_stop = threading.Event()
            heartbeat_thread = threading.Thread(
                target=self._heartbeat_loop,
                args=(job.id, heartbeat_stop),
                daemon=True,
                name=f"JobHeartbeat-{job.id}",
            )
            heartbeat_thread.start()

            try:
                payload = json.loads(job.payload)
                
                if job.type == "ingest_audio":
                    self._handle_ingest(db, job, payload)
                elif job.type == "generate_lyrics":
                    self._handle_lyrics(db, job, payload)
                elif job.type == "maintenance_update_ytdlp":
                    self._handle_ytdlp_update(db, job, payload)
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
                    job.status = "retrying"
            finally:
                heartbeat_stop.set()
                heartbeat_thread.join(timeout=2)
            job.worker_id = None
            job.leased_until = None
            db.commit()
            return True
        finally:
            db.close()

    def _handle_ingest(self, db: Session, job: models.Job, payload: dict):
        from sqlalchemy.exc import IntegrityError
        url = payload.get("url")
        payload_song_id = payload.get("song_id")
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
                with db.begin_nested():
                    artist = models.Artist(name=metadata['artist'])
                    db.add(artist)
                    db.flush()
            except IntegrityError:
                artist = db.query(models.Artist).filter(models.Artist.name == metadata['artist']).first()
            
        song = None
        if isinstance(payload_song_id, int):
            song = db.get(models.Song, payload_song_id)
        elif isinstance(payload_song_id, str) and payload_song_id.isdigit():
            song = db.get(models.Song, int(payload_song_id))

        if not song and url:
            song = (
                db.query(models.Song)
                .filter(models.Song.source_url == url)
                .order_by(models.Song.id.desc())
                .first()
            )

        if not song:
            song = db.query(models.Song).filter(models.Song.file_path == metadata['file_path']).first()

        if song:
            song.title = metadata.get('title') or song.title
            song.artist_id = artist.id
            song.file_path = metadata['file_path']
            song.duration = _normalize_duration_seconds(metadata.get('duration'))
            song.source_url = url
            song.cover_url = metadata.get('cover_url') or song.cover_url
            try:
                with db.begin_nested():
                    db.flush()
            except IntegrityError:
                existing_by_path = db.query(models.Song).filter(models.Song.file_path == metadata['file_path']).first()
                if existing_by_path and existing_by_path.id != song.id:
                    song = existing_by_path
                    song.title = metadata.get('title') or song.title
                    song.artist_id = artist.id
                    song.duration = _normalize_duration_seconds(metadata.get('duration'))
                    song.source_url = url
                    song.cover_url = metadata.get('cover_url') or song.cover_url
                    db.flush()
                else:
                    raise
        else:
            try:
                with db.begin_nested():
                    song = models.Song(
                        title=metadata['title'],
                        artist_id=artist.id,
                        file_path=metadata['file_path'],
                        duration=_normalize_duration_seconds(metadata.get('duration')),
                        source_url=url,
                        lyrics_synced=False,
                        cover_url=metadata.get('cover_url')
                    )
                    db.add(song)
                    db.flush()
            except IntegrityError:
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
        db.flush()

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
        strict_lrc = settings_service.get_strict_lrc_mode()

        lyrics = None
        source = "unknown"
        is_synced = False
        failure_reason = None

        if mode == "transcribe":
            if not file_path or not os.path.exists(file_path):
                raise ValueError("Audio file not found for transcription.")
            lyrics = lyricist._try_gemini_transcription(file_path, title, artist, model_id=model_id)
            source = "gemini_transcription"
            is_synced = bool(lyrics and validate_lrc(lyrics))
            if not lyrics:
                failure_reason = lyricist._last_gemini_transcription_reason
        elif mode == "research":
            lyrics = lyricist._try_gemini_research(title, artist, model_id=model_id)
            source = "gemini_research"
            is_synced = bool(lyrics and validate_lrc(lyrics))
            if not lyrics:
                failure_reason = lyricist._last_gemini_research_reason
        elif model_id:
            # Respect explicit model selection when manually queued.
            lyrics = lyricist._try_gemini_research(title, artist, model_id=model_id)
            source = "gemini_research"
            is_synced = bool(lyrics and validate_lrc(lyrics))
            if not lyrics:
                failure_reason = lyricist._last_gemini_research_reason
            if not lyrics and file_path and os.path.exists(file_path):
                lyrics = lyricist._try_gemini_transcription(file_path, title, artist, model_id=model_id)
                source = "gemini_transcription"
                is_synced = bool(lyrics and validate_lrc(lyrics))
                if not lyrics:
                    failure_reason = lyricist._last_gemini_transcription_reason
        else:
            outcome = lyricist.transcribe(title, artist, file_path)
            if isinstance(outcome, dict):
                lyrics = outcome.get("lyrics")
                source = outcome.get("source", "auto")
                is_synced = bool(outcome.get("is_synced"))
                failure_reason = outcome.get("failure_reason")
            elif isinstance(outcome, str):
                # Backward-compatible fallback
                lyrics = outcome
                source = "auto"
                is_synced = validate_lrc(lyrics)

        song = db.get(models.Song, song_id)
        if song:
            existing_synced = bool(song.lyrics_synced and song.lyrics and validate_lrc(song.lyrics))
            if lyrics and is_synced:
                song.lyrics = lyrics
                song.lyrics_synced = True
                job.result_json = json.dumps({"status": "found", "synced": True, "source": source})
            elif lyrics and not strict_lrc:
                song.lyrics = lyrics
                song.lyrics_synced = False
                job.result_json = json.dumps({"status": "found_unsynced", "synced": False, "source": source})
            else:
                if existing_synced:
                    # Preserve previously valid synced lyrics on failed retries.
                    job.result_json = json.dumps({
                        "status": "kept_existing_synced",
                        "synced": True,
                        "failure_reason": failure_reason or "not_found",
                    })
                else:
                    song.lyrics = "Lyrics not found."
                    song.lyrics_synced = False
                    job.result_json = json.dumps({
                        "status": "not_found",
                        "synced": False,
                        "failure_reason": failure_reason or "not_found",
                    })
            db.commit()

    def _handle_ytdlp_update(self, db: Session, job: models.Job, payload: dict):
        job.progress = 10
        db.commit()

        update_result = ytdlp_manager.update_with_rollback()

        job.progress = 100
        job.result_json = json.dumps(update_result)
        db.commit()

worker = Worker()
