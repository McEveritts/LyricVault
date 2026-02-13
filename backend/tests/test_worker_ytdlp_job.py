import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import models
import services.worker as worker_module
from services.worker import Worker


def test_worker_processes_ytdlp_maintenance_job(monkeypatch, tmp_path):
    db_path = tmp_path / "worker_ytdlp.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    monkeypatch.setattr(worker_module, "SessionLocal", session_local)

    db = session_local()
    try:
        now = datetime.now(timezone.utc)
        job = models.Job(
            type="maintenance_update_ytdlp",
            status="pending",
            title="Maintenance: Update yt-dlp",
            idempotency_key=f"maintenance_update_ytdlp_{uuid.uuid4().hex}",
            payload="{}",
            available_at=now,
        )
        db.add(job)
        db.commit()
        job_id = job.id
    finally:
        db.close()

    worker = Worker(worker_id="test_worker_ytdlp")
    processed = worker._process_one_job()
    assert processed is True

    db = session_local()
    try:
        refreshed = db.get(models.Job, job_id)
        assert refreshed is not None
        assert refreshed.status == "failed"
        result = json.loads(refreshed.result_json or "{}")
        assert result.get("status") == "unsupported"
    finally:
        db.close()
