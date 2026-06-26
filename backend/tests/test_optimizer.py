"""Greedy and ILP optimizer tests."""
from optimizer import greedy_optimizer
from ilp_optimizer import ilp_optimizer
from models import OptimizerSettings
from conflict_detector import detect_conflicts


def test_greedy_schedules_all_trains(trains, stations, legs_override):
    schedule = greedy_optimizer(trains, stations, {}, legs_override=legs_override)
    train_ids = {t.id for t in trains}
    scheduled_ids = {e.train_id for e in schedule}
    assert len(schedule) >= len(trains)
    assert train_ids.issubset(scheduled_ids)


def test_greedy_multi_leg_expansion(trains, stations, legs_override):
    schedule = greedy_optimizer(trains, stations, {}, legs_override=legs_override)
    multi_leg = [t for t in trains if t.id in legs_override]
    for train in multi_leg:
        legs = legs_override[train.id]
        for leg in legs:
            assert any(e.train_id == train.id and e.station_id == leg for e in schedule)


def test_ilp_optimizer_fallback(trains, stations, legs_override):
    settings = OptimizerSettings(mode="ilp")
    schedule = ilp_optimizer(trains, stations, {}, {}, settings, legs_override=legs_override)
    assert len(schedule) >= len(trains)


def test_conflict_detector_runs(trains, stations, legs_override):
    schedule = greedy_optimizer(trains, stations, {}, legs_override=legs_override)
    conflicts, impact = detect_conflicts(trains, stations, schedule)
    assert isinstance(conflicts, list)
    assert isinstance(impact, dict)
