"""Feasibility check API tests."""
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_feasibility_returns_score():
    trains = client.get("/trains").json()
    assert trains
    r = client.post(
        "/feasibility",
        json={
            "train_id": trains[0]["id"],
            "station_id": "HYB",
            "new_platform": 1,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert "safety_score" in data
    assert "impact_score" in data
    assert data["status"] in ("ok", "warning", "rejected")
