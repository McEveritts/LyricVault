import sys
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import services.gemini_service as gemini_module
from services.gemini_service import GeminiService


def test_model_fallback_retries_with_stable_model(monkeypatch):
    service = GeminiService()

    monkeypatch.setattr(service, "_call_with_retry", lambda fn: fn())
    monkeypatch.setattr(gemini_module, "get_stable_gemini_model", lambda: "gemini-2.0-flash")
    persisted = []
    monkeypatch.setattr(gemini_module, "set_gemini_model", lambda model_id: persisted.append(model_id))

    attempted_models = []

    def call_builder(model_name):
        attempted_models.append(model_name)
        if model_name == "gemini-3-pro-preview":
            raise Exception("Model gemini-3-pro-preview is deprecated")
        return {"ok": True}

    response, model_used = service._call_with_model_fallback(call_builder, "gemini-3-pro-preview")
    assert response == {"ok": True}
    assert model_used == "gemini-2.0-flash"
    assert attempted_models == ["gemini-3-pro-preview", "gemini-2.0-flash"]
    assert persisted == ["gemini-2.0-flash"]


def test_failure_reason_classification():
    assert GeminiService._classify_failure_reason("429 Resource exhausted") == "rate_limited"
    assert GeminiService._classify_failure_reason("connection failed") == "source_unavailable"
