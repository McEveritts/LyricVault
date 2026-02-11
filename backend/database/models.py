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
    album_id = Column(Integer, ForeignKey("albums.id"), nullable=True)
    
    file_path = Column(String, unique=True)  # Path to local audio file
    duration = Column(Integer, nullable=True) # In seconds
    
    lyrics = Column(Text, nullable=True) # Raw text or LRC content
    lyrics_synced = Column(Boolean, default=False) # True if LRC
    
    source_url = Column(String, nullable=True) # Original YouTube/SoundCloud link
    platform_id = Column(String, nullable=True) # Spotify/Apple ID if applicable
    cover_url = Column(String, nullable=True) # URL to album art
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    artist = relationship("Artist", back_populates="songs")
    album = relationship("Album", back_populates="songs")
