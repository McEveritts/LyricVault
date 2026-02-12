import sqlite3
import sys
from pathlib import Path

from sqlalchemy import create_engine, text


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database.migrations import run_migrations


def _create_legacy_jobs_schema(db_path: Path):
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            """
            CREATE TABLE jobs (
                id INTEGER PRIMARY KEY,
                type TEXT,
                status TEXT
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def test_migration_registry_applies_and_is_idempotent(tmp_path):
    db_path = tmp_path / "migration_registry.db"
    _create_legacy_jobs_schema(db_path)

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

    dry_run = run_migrations(engine, str(db_path), dry_run=True)
    assert "0001_jobs_title_column" in dry_run["pending"]
    assert dry_run["applied"] == []

    applied = run_migrations(engine, str(db_path), dry_run=False)
    assert "0001_jobs_title_column" in applied["applied"]
    assert applied["backup_path"] is not None
    assert Path(applied["backup_path"]).exists()

    with engine.connect() as conn:
        columns = [row[1] for row in conn.execute(text("PRAGMA table_info(jobs)")).fetchall()]
        assert "title" in columns
        versions = [row[0] for row in conn.execute(text("SELECT version FROM schema_migrations")).fetchall()]
        assert "0001_jobs_title_column" in versions

    second = run_migrations(engine, str(db_path), dry_run=False)
    assert second["pending"] == []
    assert second["applied"] == []
