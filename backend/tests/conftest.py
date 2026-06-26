"""Shared fixtures for backend tests."""
import json
from pathlib import Path

import pytest

from models import Station, Train


@pytest.fixture
def dataset():
    path = Path(__file__).resolve().parents[1] / "data" / "prototype_trains.json"
    with open(path) as f:
        return json.load(f)


@pytest.fixture
def stations(dataset):
    return {s["id"]: Station(**{k: v for k, v in s.items() if k in ("id", "platforms")}) for s in dataset["stations"]}


@pytest.fixture
def trains(dataset):
    return [Train(**t) for t in dataset["trains"]]


@pytest.fixture
def legs_override(dataset):
    return dataset.get("train_legs", {})
