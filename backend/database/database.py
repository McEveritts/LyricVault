import os
import logging
import sqlite3
from datetime import datetime
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from .models import Base
from .migrations import run_migrations

# sqlite3 datetime adapter deprecation fixes for Python 3.12+
def adapt_datetime_iso(val):
    return val.isoformat()

def convert_datetime(val):
    return datetime.fromisoformat(val.decode())

sqlite3.register_adapter(datetime, adapt_datetime_iso)
sqlite3.register_converter("datetime", convert_datetime)
sqlite3.register_converter("timestamp", convert_datetime)

# Use APPDATA for database to ensure write permissions in installed builds
APP_DATA = os.environ.get("APPDATA", os.path.expanduser("~"))
DB_DIR = os.path.join(APP_DATA, "LyricVault")
os.makedirs(DB_DIR, exist_ok=True)
DATABASE_PATH = os.path.join(DB_DIR, "lyricvault_v2.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

logger = logging.getLogger(__name__)

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    try:
        # Run migrations using the engine
        migration_result = run_migrations(engine, DATABASE_PATH, dry_run=False)
        if migration_result.get("applied"):
            logger.info(
                "Applied schema migrations: %s",
                ", ".join(migration_result["applied"]),
            )
        if migration_result.get("backup_path"):
            logger.info("Created database backup before migration: %s", migration_result["backup_path"])
    except Exception as e:
        logger.error("Database migration failed: %s", e, exc_info=True)
        # We generally want to raise here so the app doesn't start with a broken DB,
        # but in some cases (like a locked DB), we might want to continue?
        # For now, raise to be safe.
        raise

    # Create tables if they don't exist (migrations should handle this, but this is a fallback for fresh installs if migrations are empty)
    # Actually, if migrations are rigorous, this might not be needed, but it's safe for now.
    # However, if we rely on migrations, we should ensure they cover everything.
    # Given the current state, `create_all` is safe as it skips existing tables.
    Base.metadata.create_all(bind=engine)
    
    # Enable WAL mode for better concurrency
    try:
        with engine.connect() as conn:
            conn.execute(text("PRAGMA journal_mode=WAL;"))
            conn.execute(text("PRAGMA busy_timeout = 30000;"))
            conn.commit()
    except Exception as e:
         logger.warning(f"Failed to set PRAGMA: {e}")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
