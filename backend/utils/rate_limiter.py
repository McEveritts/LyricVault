import threading
import time


class TokenBucket:
    """
    Minimal in-memory token bucket rate limiter.

    Desktop/local backend note: this is best-effort abuse resistance, not a security boundary.
    It resets when the process restarts and does not coordinate across processes.
    """

    def __init__(self):
        self._lock = threading.Lock()
        # key -> (tokens, last_refill_monotonic)
        self._state: dict[str, tuple[float, float]] = {}

    def allow(self, key: str, *, capacity: int, refill_per_sec: float, cost: float = 1.0) -> bool:
        now = time.monotonic()
        with self._lock:
            tokens, last = self._state.get(key, (float(capacity), now))
            elapsed = max(0.0, now - last)
            tokens = min(float(capacity), tokens + elapsed * refill_per_sec)
            if tokens < cost:
                self._state[key] = (tokens, now)
                return False
            tokens -= cost
            self._state[key] = (tokens, now)
            return True

