from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship, DeclarativeBase
from datetime import datetime, timezone


class Base(DeclarativeBase):
    pass

class Artist(Base):
    __tablename__ = "artists"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    image_url = Column(String, nullable=True)
    
    songs = relationship("Song", back_populates="artist")

class Album(Base):
    __tablename__ = "albums"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    artist_id = Column(Integer, ForeignKey("artists.id"))
    cover_url = Column(String, nullable=True)
    year = Column(Integer, nullable=True)

    artist = relationship("Artist")
    songs = relationship("Song", back_populates="album")

class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    artist_id = Column(Integer, ForeignKey("artists.id"))

    artist = relationship("Artist", back_populates="songs")
    album = relationship("Album", back_populates="songs")

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, index=True) # ingest_audio | generate_lyrics | maintenance_update_ytdlp
    status = Column(String, default="pending", index=True) # pending | processing | retrying | completed | failed
    title = Column(String, nullable=True) # For UI visibility
    idempotency_key = Column(String, unique=True, index=True) # e.g. URL or Path hash
    
    payload = Column(Text) # JSON string for arguments
    result_json = Column(Text, nullable=True) # JSON output
    
    progress = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    last_error = Column(Text, nullable=True)
    
    worker_id = Column(String, nullable=True)
    leased_until = Column(DateTime, nullable=True)
    available_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
