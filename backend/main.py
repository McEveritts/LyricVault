import logging
import os
import sys
import json
import time
import threading
import hashlib
from logging.handlers import RotatingFileHandler
from urllib.parse import quote

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

from fastapi import FastAPI, Depends, HTTPException, Response, status
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from database.database import init_db, get_db, SessionLocal
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

class JobResponse(BaseModel):
    id: int
    status: str
    type: str

class ApiKeyRequest(BaseModel):
    api_key: str

class ModelRequest(BaseModel):
    model_id: str
    mode: str = "auto"

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

        url_hash = hashlib.md5(url.encode()).hexdigest()
        idempotency_key = f"ingest_{url_hash}"
        
        # Check for existing job (idempotency)
        existing_job = db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).first()
        if existing_job:
            return existing_job

        # Create new ingest job
        job = models.Job(
            type="ingest_audio",
            status="pending",
            idempotency_key=idempotency_key,
            payload=json.dumps({"url": url})
        )
        db.add(job)
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.warning(f"Idempotency race condition for {url}: {e}")
            return db.query(models.Job).filter(models.Job.idempotency_key == idempotency_key).first()
            
        db.refresh(job)
        return job
    except Exception as e:
        logger.error(f"Ingest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

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
    songs = db.query(models.Song).all()
    response = []
    for song in songs:
        filename = os.path.basename(song.file_path) if song.file_path else ""
        stream_url = f"http://localhost:8000/stream/{quote(filename)}" if filename else ""
        
        response.append({
            "id": song.id,
            "title": song.title,
            "artist": song.artist.name if song.artist else "Unknown",
            "lyrics_status": "ready" if song.lyrics else "unavailable",
            "stream_url": stream_url,
            "cover_url": song.cover_url
        })
    return response

@app.get("/song/{song_id}")
def get_song(song_id: int, db: Session = Depends(get_db)):
    song = db.get(models.Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    filename = os.path.basename(song.file_path) if song.file_path else ""
    stream_url = f"http://localhost:8000/stream/{quote(filename)}" if filename else ""
    
    return {
        "id": song.id,
        "title": song.title,
        "artist": song.artist.name if song.artist else "Unknown",
        "lyrics": song.lyrics,
        "lyrics_synced": song.lyrics_synced,
        "stream_url": stream_url,
        "cover_url": song.cover_url,
        "duration": song.duration
    }

# Settings Endpoints
@app.get("/settings/gemini-key")
def get_gemini_key_status():
    key = settings_service.get_gemini_api_key()
    if key:
        masked = key[:4] + "*" * (len(key) - 8) + key[-4:] if len(key) > 8 else "****"
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
    settings_service.set_gemini_api_key(key)
    gemini_service.reload()
    return {"status": "saved"}

@app.get("/settings/models")
def get_models():
    models = settings_service.get_available_models()
    current = settings_service.get_gemini_model()
    return {"models": models, "selected": current}

@app.post("/settings/models")
def set_model(request: ModelRequest):
    settings_service.set_gemini_model(request.model_id)
    return {"status": "saved"}

@app.get("/")
def read_root():
    return {"message": "LyricVault Backend v0.3.0 is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
