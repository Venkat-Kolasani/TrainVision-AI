"""Optional Redis pub/sub for WebSocket fan-out across Gunicorn workers."""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

CHANNEL = "trainvision:events"
_client = None
_pubsub = None
_enabled = False


def is_enabled() -> bool:
    return _enabled


def status() -> str:
    return "connected" if _enabled else "disabled"


def init_redis() -> None:
    global _client, _enabled
    url = os.getenv("REDIS_URL")
    if not url:
        logger.info("REDIS_URL not set — pub/sub disabled (single-worker mode)")
        return
    try:
        import redis  # type: ignore

        _client = redis.from_url(url, decode_responses=True)
        _client.ping()
        _enabled = True
        logger.info("Redis pub/sub connected")
    except Exception as exc:
        logger.warning("Redis unavailable: %s", exc)
        _client = None
        _enabled = False


def publish_event(event_type: str, payload: Any) -> None:
    if not _enabled or _client is None:
        return
    try:
        _client.publish(CHANNEL, json.dumps({"type": event_type, "data": payload}))
    except Exception as exc:
        logger.warning("Redis publish failed: %s", exc)


def subscribe(handler: Callable[[str, Any], None]) -> Optional[Any]:
    """Subscribe in a background thread; returns pubsub or None."""
    global _pubsub
    if not _enabled or _client is None:
        return None

    import threading

    _pubsub = _client.pubsub(ignore_subscribe_messages=True)
    _pubsub.subscribe(CHANNEL)

    def _listen() -> None:
        assert _pubsub is not None
        for message in _pubsub.listen():
            if message.get("type") != "message":
                continue
            try:
                body = json.loads(message["data"])
                handler(body.get("type", ""), body.get("data"))
            except Exception as exc:
                logger.warning("Redis message parse error: %s", exc)

    thread = threading.Thread(target=_listen, daemon=True)
    thread.start()
    return _pubsub
