import logging
import os
import sys
import json
import time
import hashlib
from logging.handlers import RotatingFileHandler
from urllib.parse import quote, urlparse, urlunparse

# Add current directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Configure Logging
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        RotatingFileHandler("logs/backend.log", maxBytes=10*1024*1024, backupCount=5),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
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

app = FastAPI(title="LyricVault API", version="0.3.0")

# Mount downloads directory
os.makedirs("downloads", exist_ok=True)
app.mount("/stream", StaticFiles(directory="downloads"), name="stream")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000", "app://."],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class IngestRequest(BaseModel):
    url: str

class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    lyrics_status: str
    stream_url: str
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

def normalize_url(url: str) -> str:
    """Normalize URL for idempotency without mutating case-sensitive IDs."""
    try:
        parsed = urlparse(url.strip())
        scheme = (parsed.scheme or "").lower()
        netloc = (parsed.netloc or "").lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]

        path = parsed.path or ""
        if path.endswith("/") and len(path) > 1:
            path = path[:-1]

        query = ""
        if "youtube.com" in netloc:
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
        models.Job.status.in_(["pending", "processing"])
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


def _lyrics_status(song: models.Song, processing_song_ids: set[int]) -> str:
    if song.lyrics and song.lyrics != "Lyrics not found.":
        return "ready"
    if song.id in processing_song_ids:
        return "processing"
    return "unavailable"

@app.on_event("startup")
def on_startup():
    init_db()
    worker.start()

@app.on_event("shutdown")
def on_shutdown():
    worker.stop()

@app.post("/ingest", response_model=JobResponse, status_code=202)
async def ingest_song(request: IngestRequest, db: Session = Depends(get_db)):
    try:
        url = request.url.strip()
        if not url:
            raise HTTPException(status_code=400, detail="URL cannot be empty")
        if not ingestor.parse_url(url):
            raise HTTPException(status_code=400, detail="Unsupported platform")

        norm_url = normalize_url(url)
        url_hash = hashlib.md5(norm_url.encode()).hexdigest()
        idempotency_key = f"ingest_{url_hash}"
        
        # Check for existing job (idempotency)
        existing_job = db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).first()
        if existing_job:
            return existing_job

        # Create new ingest job
        job = models.Job(
            type="ingest_audio",
            title=f"Ingesting: {url[:50]}...",
            status="pending",
            idempotency_key=idempotency_key,
            payload=json.dumps({"url": url})
        )
        db.add(job)
        try:
            db.commit()
        except Exception:
            db.rollback()
            return db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).first()
            
        db.refresh(job)
        return job
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ingest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/search")
def search_music(q: str, platform: str = "youtube"):
    try:
        results = ingestor.search_platforms(q, platform)
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
        lyrics = lyricist._try_gemini_transcription(
            song.file_path, song.title, artist_name, model_id=request.model_id
        )
    elif request.mode == "research":
        lyrics = lyricist._try_gemini_research(song.title, artist_name, model_id=request.model_id)
    else:
        lyrics = lyricist._try_gemini_research(song.title, artist_name, model_id=request.model_id)
        if not lyrics and song.file_path and os.path.exists(song.file_path):
            lyrics = lyricist._try_gemini_transcription(
                song.file_path, song.title, artist_name, model_id=request.model_id
            )

    if lyrics:
        song.lyrics = lyrics
        song.lyrics_synced = False
        db.commit()
        return {"status": "success", "lyrics": lyrics}
    return {"status": "failed", "message": "AI could not find or transcribe lyrics."}

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
def get_library(db: Session = Depends(get_db)):
    songs = db.query(models.Song).order_by(models.Song.id.desc()).all()
    processing_song_ids = _active_lyrics_song_ids(db)
    response = []
    for song in songs:
        filename = os.path.basename(song.file_path) if song.file_path else ""
        stream_url = f"http://localhost:8000/stream/{quote(filename)}" if filename else ""
        
        response.append({
            "id": song.id,
            "title": song.title,
            "artist": song.artist.name if song.artist else "Unknown",
            "lyrics_status": _lyrics_status(song, processing_song_ids),
            "stream_url": stream_url,
            "cover_url": song.cover_url,
            "duration": _duration_seconds(song.duration)
        })
    return response

@app.get("/song/{song_id}")
def get_song(song_id: int, db: Session = Depends(get_db)):
    song = db.get(models.Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    filename = os.path.basename(song.file_path) if song.file_path else ""
    stream_url = f"http://localhost:8000/stream/{quote(filename)}" if filename else ""
    processing_song_ids = _active_lyrics_song_ids(db)
    
    return {
        "id": song.id,
        "title": song.title,
        "artist": song.artist.name if song.artist else "Unknown",
        "lyrics_status": _lyrics_status(song, processing_song_ids),
        "lyrics": song.lyrics,
        "lyrics_synced": song.lyrics_synced,
        "file_path": song.file_path,
        "stream_url": stream_url,
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

@app.get("/settings/models")
def get_models():
    models_list = settings_service.get_available_models()
    current = settings_service.get_gemini_model()
    return {"models": models_list, "selected": current}

@app.post("/settings/models")
def set_model(request: ModelRequest):
    settings_service.set_gemini_model(request.model_id)
    return {"status": "saved"}

@app.get("/")
def read_root():
    return {"message": "LyricVault Backend v0.3.0 is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
