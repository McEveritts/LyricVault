import sys
import uuid
from pathlib import Path
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from database import models
from database.database import SessionLocal
from main import app


def _create_job(status: str) -> int:
    db = SessionLocal()
    try:
        job = models.Job(
            type="generate_lyrics",
            status=status,
            title=f"queue-split-{status}",
            idempotency_key=f"queue-split-{status}-{uuid.uuid4().hex}",
            payload='{"song_id": 0}',
            available_at=datetime.now(timezone.utc) + timedelta(hours=1),
        )
        db.add(job)
        db.commit()
        db.refresh(job)
        return job.id
    finally:
        db.close()


def _delete_jobs(job_ids: list[int]):
    db = SessionLocal()
    try:
        for job_id in job_ids:
            job = db.get(models.Job, job_id)
            if job:
                db.delete(job)
        db.commit()
    finally:
        db.close()


def test_jobs_active_and_history_endpoints_are_strictly_split():
    pending_id = _create_job("pending")
    processing_id = _create_job("processing")
    retrying_id = _create_job("retrying")
    completed_id = _create_job("completed")
    failed_id = _create_job("failed")

    created_ids = [pending_id, processing_id, retrying_id, completed_id, failed_id]
    try:
        with TestClient(app) as client:
            active_res = client.get("/jobs/active")
            history_res = client.get("/jobs/history")

        assert active_res.status_code == 200
        assert history_res.status_code == 200

        active_ids = {job["id"] for job in active_res.json()}
        history_ids = {job["id"] for job in history_res.json()}

        assert pending_id in active_ids
        assert processing_id in active_ids
        assert retrying_id in active_ids
        assert completed_id not in active_ids
        assert failed_id not in active_ids

        assert completed_id in history_ids
        assert failed_id in history_ids
        assert pending_id not in history_ids
        assert processing_id not in history_ids
        assert retrying_id not in history_ids
    finally:
        _delete_jobs(created_ids)
