import sys
from pathlib import Path

from fastapi.testclient import TestClient


BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from main import DOWNLOADS_DIR, app
from services.ingestor import DOWNLOADS_DIR as INGESTOR_DOWNLOADS_DIR


def _downloads_file() -> Path:
    return Path(DOWNLOADS_DIR).resolve() / "test.txt"


def test_stream_mount_uses_backend_downloads_directory():
    expected = (BACKEND_DIR / "downloads").resolve()
    assert Path(DOWNLOADS_DIR).resolve() == expected
    assert Path(DOWNLOADS_DIR).resolve() == Path(INGESTOR_DOWNLOADS_DIR).resolve()


def test_stream_serves_valid_file_from_downloads():
    test_file = _downloads_file()
    previous = test_file.read_text(encoding="utf-8") if test_file.exists() else None
    test_file.parent.mkdir(parents=True, exist_ok=True)
    test_file.write_text("stream-ok", encoding="utf-8")

    try:
        with TestClient(app) as client:
            response = client.get("/stream/test.txt")
        assert response.status_code == 200
        assert response.text == "stream-ok"
    finally:
        if previous is None and test_file.exists():
            test_file.unlink()
        elif previous is not None:
            test_file.write_text(previous, encoding="utf-8")


def test_stream_blocks_path_traversal():
    traversal_paths = [
        "../main.py",
        "..%2Fmain.py",
        "%2E%2E%2Fmain.py",
        r"..\\main.py",
        "..%5cmain.py",
        "%2e%2e%5cmain.py",
        "..%255cmain.py",
        "..%2F..%2Fmain.py",
        "..%5C..%5Clyricvault_v2.db",
    ]
    with TestClient(app) as client:
        for path in traversal_paths:
            response = client.get(f"/stream/{path}")
            assert response.status_code in (400, 404)
