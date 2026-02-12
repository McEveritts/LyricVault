import logging
import os
import sys
import json
import time
import hashlib
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from logging.handlers import RotatingFileHandler
from urllib.parse import urlparse, urlunparse

# Add current directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_DIR = os.path.join(BASE_DIR, "logs")
DOWNLOADS_DIR = os.path.join(BASE_DIR, "downloads")
sys.path.append(BASE_DIR)

# Configure Logging
os.makedirs(LOG_DIR, exist_ok=True)
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        RotatingFileHandler(os.path.join(LOG_DIR, "backend.log"), maxBytes=10*1024*1024, backupCount=5),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import uvicorn
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database.database import init_db, get_db
from database import models
from services.ingestor import ingestor
from services.lyricist import lyricist
from services.gemini_service import gemini_service
from services import settings_service
from services.worker import worker
from utils.lrc_validator import validate_lrc

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    worker.start()
    try:
        yield
    finally:
        worker.stop()


app = FastAPI(title="LyricVault API", version="0.4.2", lifespan=lifespan)

# Mount downloads directory
os.makedirs(DOWNLOADS_DIR, exist_ok=True)
app.mount("/stream", StaticFiles(directory=DOWNLOADS_DIR), name="stream")

# CORS Setup
IS_DEV = os.getenv("LYRICVAULT_ENV", "production") == "development"

allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "app://.",
]

if IS_DEV:
    # Allow permissive origins only in development
    allowed_origins.extend(["file://", "null"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestRequest(BaseModel):
    url: str
    rehydrate: bool = False
    song_id: int | None = None

class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    status: str
    lyrics_status: str
    lyrics_synced: bool
    stream_url: str
    source_url: str | None = None
    cover_url: str | None = None
    duration: int | None = None

class JobResponse(BaseModel):
    id: int
    status: str
    type: str

class ApiKeyRequest(BaseModel):
    api_key: str

class ModelRequest(BaseModel):
    model_id: str
    mode: str = "auto"
    
class ResearchRequest(BaseModel):
    model_id: str = "gemini-2.0-flash"
    mode: str = "auto"


class LyricsModeRequest(BaseModel):
    strict_lrc: bool

def _duration_seconds(value) -> int | None:
    """Normalize duration values to integer seconds for API responses."""
    if value is None:
        return None
    try:
        seconds = float(value)
        if seconds < 0:
            return None
        return int(round(seconds))
    except (TypeError, ValueError):
        return None


def _host_matches(host: str, domain: str) -> bool:
    return host == domain or host.endswith(f".{domain}")


def normalize_url(url: str) -> str:
    """Normalize URL for idempotency without mutating case-sensitive IDs."""
    try:
        parsed = urlparse(url.strip())
        scheme = (parsed.scheme or "").lower()
        host = (parsed.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        port = f":{parsed.port}" if parsed.port else ""
        netloc = f"{host}{port}" if host else (parsed.netloc or "").lower()

        path = parsed.path or ""
        if path.endswith("/") and len(path) > 1:
            path = path[:-1]

        query = ""
        if _host_matches(host, "youtube.com"):
            from urllib.parse import parse_qs, urlencode
            v = parse_qs(parsed.query).get("v")
            if v:
                query = urlencode({"v": v[0]})

        return urlunparse((scheme, netloc, path, "", query, ""))
    except Exception:
        return url.strip()


def _active_lyrics_song_ids(db: Session) -> set[int]:
    """Return song ids with queued/running lyric generation jobs."""
    ids: set[int] = set()
    jobs = db.query(models.Job).filter(
        models.Job.type == "generate_lyrics",
        models.Job.status.in_(["pending", "processing", "retrying"])
    ).all()

    for job in jobs:
        try:
            payload = json.loads(job.payload or "{}")
            raw_song_id = payload.get("song_id")
            if isinstance(raw_song_id, int):
                ids.add(raw_song_id)
            elif isinstance(raw_song_id, str) and raw_song_id.isdigit():
                ids.add(int(raw_song_id))
        except Exception:
            continue
    return ids


def _lyrics_status(song: models.Song, processing_song_ids: set[int], strict_lrc: bool) -> str:
    if song.lyrics_synced and song.lyrics and validate_lrc(song.lyrics):
        return "ready"
    if song.id in processing_song_ids:
        return "processing"
    has_unsynced_text = bool(song.lyrics and song.lyrics.strip() and song.lyrics != "Lyrics not found.")
    if not strict_lrc and has_unsynced_text:
        return "unsynced"
    return "unavailable"


def _active_ingest_urls(db: Session) -> set[str]:
    urls: set[str] = set()
    jobs = db.query(models.Job).filter(
        models.Job.type == "ingest_audio",
        models.Job.status.in_(["pending", "processing"])
    ).all()

    for job in jobs:
        try:
            payload = json.loads(job.payload or "{}")
            raw_url = payload.get("url")
            if isinstance(raw_url, str) and raw_url.strip():
                urls.add(normalize_url(raw_url))
        except Exception:
            continue
    return urls


def _normalize_song_source(song: models.Song) -> str | None:
    if not song.source_url:
        return None
    return normalize_url(song.source_url)


def _invalidate_missing_file_path(song: models.Song) -> bool:
    if song.file_path and not os.path.exists(song.file_path):
        song.file_path = None
        return True
    return False


def _audio_status(song: models.Song, active_ingest_urls: set[str]) -> str:
    if song.file_path and os.path.exists(song.file_path):
        return "cached"
    normalized_source = _normalize_song_source(song)
    if normalized_source and normalized_source in active_ingest_urls:
        return "re-downloading"
    return "expired"


def _stream_url(request: Request, filename: str | None) -> str:
    if not filename:
        return ""
    return str(request.url_for("stream", path=filename))


def _enqueue_ingest_job(
    db: Session,
    *,
    url: str,
    title: str,
    song_id: int | None = None,
    allow_requeue: bool = False,
) -> models.Job:
    normalized = normalize_url(url)
    url_hash = hashlib.md5(normalized.encode()).hexdigest()
    idempotency_key = f"ingest_{url_hash}"

    existing_job = db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).first()
    payload: dict[str, object] = {"url": url}
    if song_id is not None:
        payload["song_id"] = song_id

    if existing_job:
        if existing_job.status in ("pending", "processing"):
            return existing_job
        if not allow_requeue:
            return existing_job

        now = datetime.now(timezone.utc)
        existing_job.type = "ingest_audio"
        existing_job.title = title
        existing_job.status = "pending"
        existing_job.payload = json.dumps(payload)
        existing_job.result_json = None
        existing_job.progress = 0
        existing_job.retry_count = 0
        existing_job.last_error = None
        existing_job.worker_id = None
        existing_job.leased_until = None
        existing_job.available_at = now
        existing_job.started_at = None
        existing_job.completed_at = None
        db.commit()
        db.refresh(existing_job)
        return existing_job

    job = models.Job(
        type="ingest_audio",
        title=title,
        status="pending",
        idempotency_key=idempotency_key,
        payload=json.dumps(payload)
    )
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing_job = db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).first()
        if existing_job:
            return existing_job
        raise
    db.refresh(job)
    return job

@app.post("/ingest", response_model=JobResponse, status_code=202)
async def ingest_song(request: IngestRequest, db: Session = Depends(get_db)):
    try:
        url = request.url.strip()
        if not url:
            raise HTTPException(status_code=400, detail="URL cannot be empty")
        if not ingestor.parse_url(url):
            raise HTTPException(status_code=400, detail="Unsupported platform")

        job = _enqueue_ingest_job(
            db,
            url=url,
            title=f"Ingesting: {url[:50]}...",
            song_id=request.song_id,
            allow_requeue=request.rehydrate
        )
        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ingest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
def search_music(q: str, platform: str = "youtube", social_sources: str | None = None):
    try:
        results = ingestor.search_platforms(q, platform, social_sources=social_sources)
        return results
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/research_lyrics/{song_id}")
async def research_lyrics_manual(song_id: int, request: ResearchRequest, db: Session = Depends(get_db)):
    song = db.get(models.Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    artist_name = song.artist.name if song.artist else "Unknown"
    lyrics = None

    if request.mode == "transcribe":
        if not song.file_path or not os.path.exists(song.file_path):
            return {"status": "failed", "message": "Audio file not found for transcription."}
        lyrics = await run_in_threadpool(
            lyricist._try_gemini_transcription,
            song.file_path,
            song.title,
            artist_name,
            model_id=request.model_id,
        )
    elif request.mode == "research":
        lyrics = await run_in_threadpool(
            lyricist._try_gemini_research,
            song.title,
            artist_name,
            model_id=request.model_id,
        )
    else:
        lyrics = await run_in_threadpool(
            lyricist._try_gemini_research,
            song.title,
            artist_name,
            model_id=request.model_id,
        )
        if not lyrics and song.file_path and os.path.exists(song.file_path):
            lyrics = await run_in_threadpool(
                lyricist._try_gemini_transcription,
                song.file_path,
                song.title,
                artist_name,
                model_id=request.model_id,
            )

    strict_lrc = settings_service.get_strict_lrc_mode()
    existing_synced = bool(song.lyrics_synced and song.lyrics and validate_lrc(song.lyrics))
    is_synced = bool(lyrics and validate_lrc(lyrics))

    if lyrics and is_synced:
        song.lyrics = lyrics
        song.lyrics_synced = True
        db.commit()
        return {"status": "success", "synced": True, "lyrics": lyrics}

    if lyrics and not strict_lrc:
        song.lyrics = lyrics
        song.lyrics_synced = False
        db.commit()
        return {"status": "success", "synced": False, "lyrics": lyrics}

    if not existing_synced:
        song.lyrics = "Lyrics not found."
        song.lyrics_synced = False
        db.commit()
    return {"status": "failed", "message": "AI could not find valid synced lyrics."}

@app.get("/jobs/active")
def list_active_jobs(db: Session = Depends(get_db)):
    """Return only active jobs (pending, processing, retrying) for the Processing Queue."""
    return db.query(models.Job).filter(
        models.Job.status.in_(["pending", "processing", "retrying"])
    ).order_by(models.Job.created_at.asc()).all()

@app.get("/jobs/history")
def list_job_history(db: Session = Depends(get_db)):
    """Return only completed/failed jobs for the Activity Log."""
    return db.query(models.Job).filter(
        models.Job.status.in_(["completed", "failed"])
    ).order_by(models.Job.updated_at.desc()).limit(50).all()

@app.get("/tasks")
@app.get("/jobs")
def list_jobs(status: str = None, db: Session = Depends(get_db)):
    query = db.query(models.Job)
    if status:
        query = query.filter(models.Job.status == status)
    return query.order_by(models.Job.created_at.desc()).limit(50).all()

@app.get("/tasks/{job_id}")
@app.get("/jobs/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.get(models.Job, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.post("/retry_lyrics/{song_id}")
async def retry_lyrics(song_id: int, db: Session = Depends(get_db)):
    song = db.get(models.Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    song.lyrics = None
    song.lyrics_synced = False
    db.commit()
    
    idempotency_key = f"lyrics_retry_{song.id}_{int(time.time())}"
    job = models.Job(
        type="generate_lyrics",
        title=f"Retrying Lyrics: {song.title}",
        idempotency_key=idempotency_key,
        payload=json.dumps({
            "song_id": song.id,
            "title": song.title,
            "artist": song.artist.name if song.artist else "Unknown",
            "file_path": song.file_path
        })
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job

@app.get("/library", response_model=list[SongResponse])
def get_library(request: Request, db: Session = Depends(get_db)):
    songs = db.query(models.Song).order_by(models.Song.id.desc()).all()
    processing_song_ids = _active_lyrics_song_ids(db)
    active_ingest_urls = _active_ingest_urls(db)
    strict_lrc = settings_service.get_strict_lrc_mode()

    changed = False
    for song in songs:
        if _invalidate_missing_file_path(song):
            changed = True
    if changed:
        db.commit()

    response = []
    for song in songs:
        status = _audio_status(song, active_ingest_urls)
        filename = os.path.basename(song.file_path) if status == "cached" and song.file_path else ""
        stream_url = _stream_url(request, filename)
        
        response.append({
            "id": song.id,
            "title": song.title,
            "artist": song.artist.name if song.artist else "Unknown",
            "status": status,
            "lyrics_status": _lyrics_status(song, processing_song_ids, strict_lrc),
            "lyrics_synced": bool(song.lyrics_synced and song.lyrics and validate_lrc(song.lyrics)),
            "stream_url": stream_url,
            "source_url": song.source_url,
            "cover_url": song.cover_url,
            "duration": _duration_seconds(song.duration)
        })
    return response

@app.get("/song/{song_id}")
def get_song(song_id: int, request: Request, db: Session = Depends(get_db)):
    song = db.get(models.Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    if _invalidate_missing_file_path(song):
        db.commit()
        db.refresh(song)

    active_ingest_urls = _active_ingest_urls(db)
    status = _audio_status(song, active_ingest_urls)

    filename = os.path.basename(song.file_path) if status == "cached" and song.file_path else ""
    stream_url = _stream_url(request, filename)
    processing_song_ids = _active_lyrics_song_ids(db)
    strict_lrc = settings_service.get_strict_lrc_mode()

    return {
        "id": song.id,
        "title": song.title,
        "artist": song.artist.name if song.artist else "Unknown",
        "status": status,
        "lyrics_status": _lyrics_status(song, processing_song_ids, strict_lrc),
        "lyrics": song.lyrics,
        "lyrics_synced": bool(song.lyrics_synced and song.lyrics and validate_lrc(song.lyrics)),
        "file_path": song.file_path,
        "stream_url": stream_url,
        "source_url": song.source_url,
        "cover_url": song.cover_url,
        "duration": _duration_seconds(song.duration)
    }

# Settings Endpoints
@app.get("/settings/gemini-key")
def get_gemini_key_status():
    key = settings_service.get_gemini_api_key()
    if key:
        masked = key[:4] + "*" * (max(0, len(key) - 8)) + key[-4:] if len(key) > 8 else "****"
        return {"configured": True, "masked_key": masked, "available": gemini_service.is_available()}
    return {"configured": False, "masked_key": None, "available": False}

@app.post("/settings/gemini-key")
def save_gemini_key(request: ApiKeyRequest):
    key = request.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    is_valid = gemini_service.validate_key(key)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid API key")
    try:
        settings_service.set_gemini_api_key(key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save API key: {e}")
    gemini_service.reload()
    return {"status": "saved", "message": "API key validated and saved successfully"}

@app.delete("/settings/gemini-key")
def delete_gemini_key():
    try:
        settings_service.delete_gemini_api_key()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove API key: {e}")
    gemini_service.reload()
    return {"status": "deleted", "message": "API key removed"}

@app.post("/settings/test-gemini-key")
def test_gemini_key(request: ApiKeyRequest):
    key = request.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    is_valid = gemini_service.validate_key(key)
    if is_valid:
        return {"status": "success", "message": "API key is valid!"}
    else:
        raise HTTPException(status_code=400, detail="Invalid API key")

@app.get("/settings/genius-key")
def get_genius_key_status():
    key = settings_service.get_genius_api_key()
    if key:
        masked = key[:4] + "*" * (max(0, len(key) - 8)) + key[-4:] if len(key) > 8 else "****"
        return {"configured": True, "masked_key": masked}
    return {"configured": False, "masked_key": None}

@app.post("/settings/genius-key")
def save_genius_key(request: ApiKeyRequest):
    key = request.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    # Genius keys are typically 64 chars alphanumeric, but we'll just check non-empty
    try:
        settings_service.set_genius_api_key(key)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save API key: {e}")
    # Force reload of lyricist service if needed (currently it reads env/settings on demand)
    return {"status": "saved", "message": "Genius API key saved successfully"}

@app.delete("/settings/genius-key")
def delete_genius_key():
    try:
        settings_service.delete_genius_api_key()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to remove API key: {e}")
    return {"status": "deleted", "message": "API key removed"}


@app.get("/settings/lyrics-mode")
def get_lyrics_mode():
    return {"strict_lrc": settings_service.get_strict_lrc_mode()}


@app.post("/settings/lyrics-mode")
def set_lyrics_mode(request: LyricsModeRequest):
    try:
        settings_service.set_strict_lrc_mode(request.strict_lrc)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save lyrics mode: {e}")
    return {"status": "saved", "strict_lrc": bool(request.strict_lrc)}

@app.get("/settings/models")
def get_models():
    models_list = settings_service.get_available_models()
    current = settings_service.get_gemini_model()
    return {"models": models_list, "selected": current}

@app.post("/settings/models")
def set_model(request: ModelRequest):
    try:
        settings_service.set_gemini_model(request.model_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "saved"}

@app.get("/")
def read_root():
    return {"message": "LyricVault Backend v0.4.2 is running"}

if __name__ == "__main__":
    reload_enabled = os.getenv("LYRICVAULT_BACKEND_RELOAD", "0") == "1"
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=reload_enabled)
