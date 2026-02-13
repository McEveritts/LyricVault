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

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    try:
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
        raise

    Base.metadata.create_all(bind=engine)
    
    # Enable WAL mode for better concurrency
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL;"))
        conn.execute(text("PRAGMA busy_timeout = 30000;"))
        
        conn.commit()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
