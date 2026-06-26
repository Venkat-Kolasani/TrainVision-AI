"""In-memory KPI snapshots for trend charts."""
from __future__ import annotations

from collections import deque
from datetime import datetime
from typing import Deque, Dict, List

MAX_BUCKETS = 288  # ~24h at 5-min intervals
BUCKET_MINUTES = 5


def _bucket_key(now: datetime) -> str:
    minute = (now.minute // BUCKET_MINUTES) * BUCKET_MINUTES
    bucket = now.replace(minute=minute, second=0, microsecond=0)
    return bucket.isoformat()


class AnalyticsTrendStore:
    def __init__(self) -> None:
        self._buckets: Deque[Dict] = deque(maxlen=MAX_BUCKETS)

    def record(self, snapshot: Dict) -> None:
        key = _bucket_key(datetime.now())
        payload = {**snapshot, "timestamp": key, "bucket_key": key}
        if self._buckets and self._buckets[-1].get("bucket_key") == key:
            self._buckets[-1] = payload
        else:
            self._buckets.append(payload)

    def list(self) -> List[Dict]:
        return list(self._buckets)


trend_store = AnalyticsTrendStore()
