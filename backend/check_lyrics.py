from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.models import Song, Base

DATABASE_URL = "sqlite:///./lyricvault_v2.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

songs = db.query(Song).all()
print(f"Found {len(songs)} songs.")
for song in songs:
    print(f"ID: {song.id} | Title: {song.title} | Lyrics Length: {len(song.lyrics) if song.lyrics else 0}")
    if song.lyrics:
        print(f"Sample: {song.lyrics[:50]}...")
    else:
        print("No lyrics found.")
