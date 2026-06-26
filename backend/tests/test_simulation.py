"""Simulation API tests."""
from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_simulate_delay_returns_scenario():
    trains = client.get("/trains").json()
    assert trains
    r = client.post(
        "/simulate/delay",
        json={
            "scenario_type": "delay",
            "train_id": trains[0]["id"],
            "delay_minutes": 10,
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert "scenario_id" in data
    assert "predicted_schedule" in data
    assert "kpi_delta" in data
    assert isinstance(data["predicted_schedule"], list)
    assert len(data["predicted_schedule"]) > 0
