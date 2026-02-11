import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BACKEND_DIR))

from main import normalize_url
from services.ingestor import ingestor


def test_parse_url_rejects_lookalike_domain():
    # Regression: substring checks used to accept notyoutube.com as YouTube.
    assert ingestor.parse_url("https://notyoutube.com/watch?v=abc12345678") is None


def test_parse_url_handles_uppercase_host():
    assert ingestor.parse_url("HTTPS://YOUTU.BE/abc12345678") == "youtube"


def test_normalize_url_does_not_apply_youtube_rules_to_lookalike_domain():
    # Regression: lookalike domains previously kept only the `v` parameter.
    raw = "https://notyoutube.com/watch?v=abc123&list=PL123"
    assert normalize_url(raw) == "https://notyoutube.com/watch"
