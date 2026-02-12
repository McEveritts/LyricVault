import os
import shutil
from datetime import datetime, timezone

from sqlalchemy import text

MIGRATIONS = [
    "0001_jobs_title_column",
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


def _apply_migration(conn, version: str) -> bool:
    if version == "0001_jobs_title_column":
        changed = _migration_0001_jobs_title_column(conn)
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
