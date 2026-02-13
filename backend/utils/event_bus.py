import asyncio
import json
import os
import threading
import time
from dataclasses import dataclass


@dataclass(frozen=True)
class Subscriber:
    queue: asyncio.Queue[str]
    loop: asyncio.AbstractEventLoop


_lock = threading.Lock()
_subscribers: set[Subscriber] = set()
_max_subscribers = int(os.getenv("LYRICVAULT_MAX_SSE_SUBSCRIBERS", "4"))


def subscribe(*, max_queue: int = 200) -> Subscriber:
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=max_queue)
    sub = Subscriber(queue=queue, loop=loop)
    with _lock:
        if _max_subscribers > 0 and len(_subscribers) >= _max_subscribers:
            raise RuntimeError("Too many SSE subscribers")
        _subscribers.add(sub)
    return sub


def unsubscribe(sub: Subscriber) -> None:
    with _lock:
        _subscribers.discard(sub)


def _try_put(queue: asyncio.Queue[str], payload: str) -> None:
    # Drop oldest to make room instead of blocking publisher threads.
    try:
        if queue.full():
            queue.get_nowait()
    except Exception:
        pass
    try:
        queue.put_nowait(payload)
    except Exception:
        pass


def publish(event: str, data: dict) -> None:
    """Publish a single event to all active SSE subscribers."""
    with _lock:
        subscribers = list(_subscribers)

    if not subscribers:
        return

    payload = json.dumps(
        {
            "event": event,
            "data": data,
            "ts": time.time(),
        },
        separators=(",", ":"),
    )

    for sub in subscribers:
        try:
            sub.loop.call_soon_threadsafe(_try_put, sub.queue, payload)
        except Exception:
            # Event loop closed or subscriber already gone.
            try:
                unsubscribe(sub)
            except Exception:
                pass
