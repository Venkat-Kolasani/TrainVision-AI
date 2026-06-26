"""Override endpoint tests."""
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_override_then_schedule_stable():
    trains = client.get("/trains").json()
    assert trains
    train_id = trains[0]["id"]
    before = client.get("/schedule").json()
    r = client.post(
        "/override",
        json={
            "train_id": train_id,
            "station_id": "HYB",
            "new_platform": 2,
        },
    )
    assert r.status_code == 200
    after = client.get("/schedule").json()
    assert len(after["schedule"]) == len(before["schedule"])
