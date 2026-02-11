import asyncio
import inspect
import time
from pathlib import Path
from types import SimpleNamespace
import sys


BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from main import ResearchRequest, research_lyrics_manual
from services.lyricist import lyricist


class FakeDB:
    def __init__(self, song):
        self._song = song
        self.commit_calls = 0

    def get(self, _model, song_id):
        if song_id == 1:
            return self._song
        return None

    def commit(self):
        self.commit_calls += 1


def test_research_lyrics_endpoint_uses_threadpool():
    source = inspect.getsource(research_lyrics_manual)
    assert "run_in_threadpool" in source


def test_research_lyrics_keeps_event_loop_responsive(monkeypatch):
    song = SimpleNamespace(
        title="Test Song",
        file_path=None,
        lyrics=None,
        lyrics_synced=False,
        artist=SimpleNamespace(name="Test Artist"),
    )
    db = FakeDB(song)

    def blocking_research(*_args, **_kwargs):
        time.sleep(0.25)
        return "Line 1\nLine 2"

    monkeypatch.setattr(lyricist, "_try_gemini_research", blocking_research)

    async def _run_case():
        job = asyncio.create_task(
            research_lyrics_manual(1, ResearchRequest(mode="research"), db)
        )
        ticks = 0
        start = time.perf_counter()
        while time.perf_counter() - start < 0.15:
            ticks += 1
            await asyncio.sleep(0.01)
        result = await job
        return ticks, result

    ticks, result = asyncio.run(_run_case())
    assert ticks >= 8
    assert result["status"] == "success"
    assert db.commit_calls == 1
