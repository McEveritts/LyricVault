import logging
import os
import sys
from logging.handlers import RotatingFileHandler

# Add current directory to sys.path to ensure local modules can be imported
# This is required for the embedded python environment which may not auto-add script dir
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

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from urllib.parse import quote
import time
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import uvicorn
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from database.database import init_db, get_db
from database import models
from services.ingestor import ingestor
from services.lyricist import lyricist
from services.gemini_service import gemini_service
from services import settings_service

app = FastAPI(title="LyricVault API", version="0.1.5")

# In-memory task tracking
active_tasks = {}

# Mount downloads directory to serve audio files
# Ensure directory exists
os.makedirs("downloads", exist_ok=True)
app.mount("/stream", StaticFiles(directory="downloads"), name="stream")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
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

class ApiKeyRequest(BaseModel):
    api_key: str

class ModelRequest(BaseModel):
    model_id: str
    mode: str = "auto"  # "auto" or "transcribe"

@app.on_event("startup")
def on_startup():
    init_db()
    
@app.post("/ingest", response_model=SongResponse)
async def ingest_song(request: IngestRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Parse URL & Identify Platform
    platform = ingestor.parse_url(request.url)
    if not platform:
         raise HTTPException(status_code=400, detail="Unsupported platform")
         
    # 2. Download Audio
    try:
        metadata = ingestor.download_audio(request.url)
    except HTTPException:
        raise  # Already a proper HTTP error — don't re-wrap
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")
        
    # check if artist exists
    artist = db.query(models.Artist).filter(models.Artist.name == metadata['artist']).first()
    if not artist:
        artist = models.Artist(name=metadata['artist'])
        db.add(artist)
        db.commit()
        db.refresh(artist)
        
    # check if song exists
    song = db.query(models.Song).filter(models.Song.file_path == metadata['file_path']).first()
    if not song:
        song = models.Song(
            title=metadata['title'],
            artist_id=artist.id,
            file_path=metadata['file_path'],
            duration=metadata['duration'],
            source_url=request.url,
            lyrics_synced=False,
            cover_url=metadata.get('cover_url')
        )
        db.add(song)
        db.commit()
        db.refresh(song)


    # 3. Fetch Lyrics (Background Task)
    task_id = f"lyrics_{song.id}"
    active_tasks[task_id] = {
        "id": task_id,
        "type": "lyrics",
        "title": song.title,
        "status": "processing",
        "progress": 10
    }

    # Pass metadata for search, including file_path for audio transcription fallback
    background_tasks.add_task(process_lyrics, song.id, metadata['title'], metadata['artist'], metadata['file_path'])
    
    # Construct stream URL
    filename = os.path.basename(metadata['file_path'])
    stream_url = f"http://localhost:8000/stream/{quote(filename)}"

    return {
        "id": song.id,
        "title": song.title,
        "artist": artist.name,
        "lyrics_status": "processing",
        "stream_url": stream_url
    }

def process_lyrics(song_id: int, title: str, artist: str, file_path: str = None):
    """Background task to fetch lyrics using multi-source approach"""
    task_id = f"lyrics_{song_id}"
    db_gen = get_db()
    db = next(db_gen)
    try:
        if task_id in active_tasks:
            active_tasks[task_id]["progress"] = 30
            active_tasks[task_id]["status"] = "Searching databases..."

        # Define callback to update task status in real-time
        def update_status(msg):
            print(f"[{task_id}] Status update: {msg}")
            if task_id in active_tasks:
                active_tasks[task_id]["status"] = msg
                # Optional: Guess progress based on message content for better UX?
                if "Uploading" in msg: active_tasks[task_id]["progress"] = 40
                if "Analyzing" in msg: active_tasks[task_id]["progress"] = 60
                if "Researching" in msg: active_tasks[task_id]["progress"] = 50

        # Pass file_path to enable audio transcription fallback
        lyrics = lyricist.transcribe(title, artist, file_path, status_callback=update_status)
        
        if task_id in active_tasks:
            active_tasks[task_id]["progress"] = 80
            active_tasks[task_id]["status"] = "Finalizing..."

        song = db.get(models.Song, song_id)
        if song:
            if lyrics:
                song.lyrics = lyrics
                song.lyrics_synced = True
                print(f"Lyrics found for {title}")
                if task_id in active_tasks:
                    active_tasks[task_id]["status"] = "Complete"
                    active_tasks[task_id]["progress"] = 100
            else:
                song.lyrics = "Lyrics not found."
                if task_id in active_tasks:
                    active_tasks[task_id]["status"] = "Failed"
                    active_tasks[task_id]["progress"] = 100
            db.commit()
    except Exception as e:
        print(f"Error processing lyrics: {e}")
        if task_id in active_tasks:
            active_tasks[task_id]["status"] = f"Error: {str(e)}"
    finally:
        # Keep task in list for a bit then remove (or just leave it)
        try:
            next(db_gen)
        except StopIteration:
            pass

@app.post("/retry_lyrics/{song_id}")
async def retry_lyrics(song_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    song = db.get(models.Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    # Reset status
    song.lyrics = None
    song.lyrics_synced = False
    db.commit()
    
    background_tasks.add_task(process_lyrics, song.id, song.title, song.artist.name)
    return {"status": "retrying", "song": song.title}

@app.post("/research_lyrics/{song_id}")
async def research_lyrics_manual(song_id: int, request: ModelRequest, db: Session = Depends(get_db)):
    """Manually trigger Gemini AI research for a song"""
    song = db.get(models.Song, song_id)
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")
    
    # 1. Try Gemini Research directly first
    print(f"Manual research triggered for: {song.title} using model {request.model_id}")
    
    # Register task for Sidebar visibility
    task_id = f"manual_{song.id}_{int(time.time())}"
    
    # Temporarily override selected model if provided
    original_model = settings_service.get_gemini_model()
    try:
        settings_service.set_gemini_model(request.model_id)
        
        lyrics = None
        # Mode: Auto (Research -> Transcribe)
        if request.mode == "auto":
            # Try Research
            if task_id in active_tasks: active_tasks[task_id]["status"] = "AI Researching..."
            lyrics = lyricist._try_gemini_research(song.title, song.artist.name)
            
            # If research failed, try transcription if audio exists
            if not lyrics and song.file_path and os.path.exists(song.file_path):
                 if task_id in active_tasks: active_tasks[task_id]["status"] = "Research failed. Transcribing..."
                 lyrics = lyricist._try_gemini_transcription(song.file_path, song.title, song.artist.name)
        
        # Mode: Transcribe (Force Audio Transcription)
        elif request.mode == "transcribe":
            if song.file_path and os.path.exists(song.file_path):
                print(f"Forcing audio transcription for: {song.title}")
                if task_id in active_tasks: active_tasks[task_id]["status"] = "Uploading & Transcribing..." 
                # We need to pass a callback here too if we want real-time updates for manual research
                # But manual research is currently synchronous in this endpoint (active_tasks is for background)
                # This endpoint returns the lyrics directly. 
                # HOWEVER, the UI might be polling tasks? 
                # Actually, `research_lyrics_manual` is POST and awaits response. 
                # The "Processing Queue" shows background tasks.
                # If we want the manual research to show up in "Processing Queue" we need to add it to `active_tasks`.
                
                # Let's register a temp task for manual research so it shows up in the sidebar!
                active_tasks[task_id] = {
                    "id": task_id,
                    "type": "manual_research",
                    "title": f"Researching: {song.title}",
                    "status": "Starting...",
                    "progress": 0
                }
                
                def manual_status_update(msg):
                    if task_id in active_tasks:
                        active_tasks[task_id]["status"] = msg
                
                try:
                    lyrics = lyricist._try_gemini_transcription(song.file_path, song.title, song.artist.name, status_callback=manual_status_update)
                finally:
                    # Clean up task
                    if task_id in active_tasks:
                         del active_tasks[task_id]
                if not lyrics:
                    # Fallback to research if transcription fails????? 
                    # User asked for transcription specifically, maybe we should just fail?
                    # Let's keep it strict for now to respect the "Force" intent.
                    pass
            else:
                return {"status": "failed", "message": "Audio file not found for transcription."}

    finally:
        # Restore original setting
        settings_service.set_gemini_model(original_model)
    
    if lyrics:

        song.lyrics = lyrics
        song.lyrics_synced = False
        db.commit()
        return {"status": "success", "lyrics": lyrics}
    else:
        return {"status": "failed", "message": "AI could not find or transcribe lyrics."}

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
            "lyrics_status": "ready" if song.lyrics else "unavailable", # Simple status mapping
            "stream_url": stream_url,
            "cover_url": song.cover_url
        })
    return response

@app.get("/song/{song_id}")
def get_song(song_id: int, db: Session = Depends(get_db)):
    """Get full song details including lyrics"""
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

# Task Status Schema for type checking
class TaskStatus(BaseModel):
    id: str
    type: str
    title: str
    status: str
    progress: int = 0

@app.get("/tasks")
def get_tasks():
    """Return current active/recent tasks"""
    return list(active_tasks.values())

@app.get("/search")
def search_music(q: str, platform: str = "youtube"):
    """Search for music across supported platforms"""
    results = ingestor.search_platforms(q, platform)
    return results

# ── Settings Endpoints ────────────────────────────────────────────────

@app.get("/settings/gemini-key")
def get_gemini_key_status():
    """Check if a Gemini API key is configured and working."""
    key = settings_service.get_gemini_api_key()
    if key:
        # Mask the key for display
        masked = key[:4] + "*" * (len(key) - 8) + key[-4:] if len(key) > 8 else "****"
        return {"configured": True, "masked_key": masked, "available": gemini_service.is_available()}
    return {"configured": False, "masked_key": None, "available": False}

@app.post("/settings/gemini-key")
def save_gemini_key(request: ApiKeyRequest):
    """Validate and save a Gemini API key."""
    key = request.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    
    # Validate the key
    is_valid = gemini_service.validate_key(key)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid API key. Please check and try again.")
    
    # Save and reload
    settings_service.set_gemini_api_key(key)
    gemini_service.reload()
    return {"status": "saved", "message": "Gemini API key saved and activated."}

@app.post("/settings/test-gemini-key")
def test_gemini_key(request: ApiKeyRequest):
    """Test a Gemini API key without saving it."""
    key = request.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    
    is_valid = gemini_service.validate_key(key)
    if is_valid:
        return {"status": "valid", "message": "API key is valid!"}
    else:
        raise HTTPException(status_code=400, detail="Invalid API key. Please check and try again.")

@app.delete("/settings/gemini-key")
def delete_gemini_key():
    """Remove the stored Gemini API key."""
    settings_service.delete_gemini_api_key()
    gemini_service.reload()
    return {"status": "deleted", "message": "Gemini API key removed."}

@app.get("/settings/models")
def get_models():
    """Return available Gemini models with rate limit info."""
    models = settings_service.get_available_models()
    current = settings_service.get_gemini_model()
    return {"models": models, "selected": current}

@app.post("/settings/models")
def set_model(request: ModelRequest):
    """Set the preferred Gemini model."""
    try:
        settings_service.set_gemini_model(request.model_id)
        return {"status": "saved", "model": request.model_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "LyricVault Backend is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
