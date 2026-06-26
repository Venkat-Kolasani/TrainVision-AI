"""API integration tests for read-only schedule and endpoints."""
from fastapi.testclient import TestClient

import main


client = TestClient(main.app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200


def test_schedule_read_only_stable():
    r1 = client.get("/schedule")
    r2 = client.get("/schedule")
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert len(r1.json()["schedule"]) == len(r2.json()["schedule"])


def test_stations_include_metadata():
    r = client.get("/stations")
    assert r.status_code == 200
    data = r.json()
    assert any(s.get("station_name") for s in data)


def test_analytics_trends():
    client.get("/analytics/summary")
    r = client.get("/analytics/trends")
    assert r.status_code == 200
    assert "points" in r.json()


def test_track_status():
    r = client.get("/track-status")
    assert r.status_code == 200
    assert "track_occupancy" in r.json()
