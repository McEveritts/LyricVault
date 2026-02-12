import os
import logging
import sqlite3
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from .models import Base

# sqlite3 datetime adapter deprecation fixes for Python 3.12+
def adapt_datetime_iso(val):
    return val.isoformat()

def convert_datetime(val):
    return datetime.fromisoformat(val.decode())

sqlite3.register_adapter(datetime, adapt_datetime_iso)
sqlite3.register_converter("DATETIME", convert_datetime)
sqlite3.register_converter("timestamp", convert_datetime)

logger = logging.getLogger(__name__)

# Resolve absolute path for database
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_PATH = os.path.join(BACKEND_DIR, "lyricvault_v2.db")
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False, "timeout": 30}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Enable WAL mode for better concurrency
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL;"))
        conn.execute(text("PRAGMA busy_timeout = 30000;"))
        
        # Simple migration: Add 'title' column to 'jobs' if it doesn't exist
        try:
            # Check existing columns
            inspector = conn.execute(text("PRAGMA table_info(jobs);")).fetchall()
            columns = [col[1] for col in inspector]
            if "title" not in columns:
                logger.info("Migrating: Adding 'title' column to 'jobs' table")
                conn.execute(text("ALTER TABLE jobs ADD COLUMN title VARCHAR;"))
        except Exception as e:
            logger.warning(f"Migration check failed (normal if first run): {e}")
            
        conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
