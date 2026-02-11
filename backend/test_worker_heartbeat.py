import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from database import models
import services.worker as worker_module
from services.worker import Worker


def _utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def test_worker_heartbeat_renews_lease(monkeypatch, tmp_path):
    db_path = tmp_path / "heartbeat_test.db"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    models.Base.metadata.create_all(bind=engine)

    monkeypatch.setattr(worker_module, "SessionLocal", session_local)

    worker = Worker(worker_id="heartbeat_test_worker")
    worker.lease_duration = timedelta(seconds=5)
    worker.heartbeat_interval_seconds = 1

    db = session_local()
    try:
        now = datetime.now(timezone.utc)
        job = models.Job(
            type="ingest_audio",
            status="processing",
            title="Heartbeat Test",
            idempotency_key="heartbeat_test_job",
            payload="{}",
            worker_id=worker.worker_id,
            leased_until=now + timedelta(seconds=1),
            available_at=now,
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        job_id = job.id
        initial_lease = _utc(job.leased_until)
    finally:
        db.close()

    stop_event = threading.Event()
    heartbeat_thread = threading.Thread(
        target=worker._heartbeat_loop,
        args=(job_id, stop_event),
        daemon=True,
    )
    heartbeat_thread.start()
    time.sleep(2.2)
    stop_event.set()
    heartbeat_thread.join(timeout=2)

    db = session_local()
    refreshed = None
    try:
        refreshed = db.get(models.Job, job_id)
        assert refreshed is not None
        assert refreshed.leased_until is not None
        assert _utc(refreshed.leased_until) > initial_lease
    finally:
        if refreshed is not None:
            db.delete(refreshed)
            db.commit()
        db.close()
