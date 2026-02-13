import os
import shutil
from datetime import datetime, timezone

from sqlalchemy import text

MIGRATIONS = [
    "0001_jobs_title_column",
    "0002_songs_album_id",
    "0003_restore_song_columns",
]


def _utc_now_suffix() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _ensure_migration_table(conn):
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR PRIMARY KEY,
            applied_at DATETIME NOT NULL
        )
    """))


def _applied_versions(conn) -> set[str]:
    rows = conn.execute(text("SELECT version FROM schema_migrations")).fetchall()
    return {row[0] for row in rows}


def _migration_0001_jobs_title_column(conn) -> bool:
    inspector = conn.execute(text("PRAGMA table_info(jobs);")).fetchall()
    if not inspector:
        return False
    columns = [col[1] for col in inspector]
    if "title" not in columns:
        conn.execute(text("ALTER TABLE jobs ADD COLUMN title VARCHAR;"))
        return True
    return False



def _migration_0002_songs_album_id(conn) -> bool:
    inspector = conn.execute(text("PRAGMA table_info(songs);")).fetchall()
    if not inspector:
        return False
    columns = [col[1] for col in inspector]
    if "album_id" not in columns:
        conn.execute(text("ALTER TABLE songs ADD COLUMN album_id INTEGER REFERENCES albums(id);"))
        return True
    return False


def _migration_0003_restore_song_columns(conn) -> bool:
    inspector = conn.execute(text("PRAGMA table_info(songs);")).fetchall()
    if not inspector:
        return False
    columns = [col[1] for col in inspector]
    
    changed = False
    if "lyrics" not in columns:
        conn.execute(text("ALTER TABLE songs ADD COLUMN lyrics TEXT;"))
        changed = True
    if "lyrics_synced" not in columns:
        # SQLite doesn't have a specific BOOLEAN type, INTERGER 0/1 is standard.
        # But SQLAlchemy emits BOOLEAN which maps to INTEGER usually.
        # Let's use BOOLEAN in the SQL to be safe (SQLite accepts it as affinity).
        conn.execute(text("ALTER TABLE songs ADD COLUMN lyrics_synced BOOLEAN DEFAULT 0;"))
        changed = True
    if "source_url" not in columns:
        conn.execute(text("ALTER TABLE songs ADD COLUMN source_url VARCHAR;"))
        changed = True
    if "cover_url" not in columns:
        conn.execute(text("ALTER TABLE songs ADD COLUMN cover_url VARCHAR;"))
        changed = True
    if "duration" not in columns:
        conn.execute(text("ALTER TABLE songs ADD COLUMN duration INTEGER;"))
        changed = True
    if "lyrics_source" not in columns:
        conn.execute(text("ALTER TABLE songs ADD COLUMN lyrics_source VARCHAR;"))
        changed = True
    if "file_path" not in columns:
        conn.execute(text("ALTER TABLE songs ADD COLUMN file_path VARCHAR;"))
        changed = True
        
    return changed


def _apply_migration(conn, version: str) -> bool:
    if version == "0001_jobs_title_column":
        changed = _migration_0001_jobs_title_column(conn)
        conn.execute(
            text("INSERT INTO schema_migrations(version, applied_at) VALUES (:version, :applied_at)"),
            {"version": version, "applied_at": datetime.now(timezone.utc)},
        )
        return changed
    if version == "0002_songs_album_id":
        changed = _migration_0002_songs_album_id(conn)
        conn.execute(
            text("INSERT INTO schema_migrations(version, applied_at) VALUES (:version, :applied_at)"),
            {"version": version, "applied_at": datetime.now(timezone.utc)},
        )
        return changed
    if version == "0003_restore_song_columns":
        changed = _migration_0003_restore_song_columns(conn)
        conn.execute(
            text("INSERT INTO schema_migrations(version, applied_at) VALUES (:version, :applied_at)"),
            {"version": version, "applied_at": datetime.now(timezone.utc)},
        )
        return changed
    raise ValueError(f"Unknown migration version: {version}")


def run_migrations(engine, database_path: str, *, dry_run: bool = False) -> dict:
    with engine.connect() as conn:
        _ensure_migration_table(conn)
        already_applied = _applied_versions(conn)
        pending = [version for version in MIGRATIONS if version not in already_applied]

    if not pending:
        return {"pending": [], "applied": [], "backup_path": None, "dry_run": dry_run}

    if dry_run:
        return {"pending": pending, "applied": [], "backup_path": None, "dry_run": True}

    backup_path = None
    if os.path.isfile(database_path):
        backup_path = f"{database_path}.bak.{_utc_now_suffix()}"
        shutil.copy2(database_path, backup_path)

    applied: list[str] = []
    with engine.begin() as conn:
        _ensure_migration_table(conn)
        already_applied = _applied_versions(conn)
        for version in pending:
            if version in already_applied:
                continue
            _apply_migration(conn, version)
            applied.append(version)

    return {"pending": pending, "applied": applied, "backup_path": backup_path, "dry_run": False}
