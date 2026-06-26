"""Derive per-train station legs for multi-stop scheduling."""
from __future__ import annotations

from typing import Dict, List, Tuple

from models import Train

# Corridor paths between HYB, SC, KCG
ROUTE_PATHS: Dict[Tuple[str, str], List[str]] = {
    ("HYB", "SC"): ["HYB"],
    ("SC", "HYB"): ["SC"],
    ("HYB", "KCG"): ["HYB", "SC", "KCG"],
    ("KCG", "HYB"): ["KCG", "SC", "HYB"],
    ("SC", "KCG"): ["SC", "KCG"],
    ("KCG", "SC"): ["KCG", "SC"],
    ("HYB", "HYB"): ["HYB"],
    ("SC", "SC"): ["SC"],
    ("KCG", "KCG"): ["KCG"],
}


def get_train_legs(train: Train, legs_override: Dict[str, List[str]] | None = None) -> List[str]:
    if legs_override and train.id in legs_override:
        return legs_override[train.id]
    key = (train.origin, train.destination)
    if key in ROUTE_PATHS:
        return ROUTE_PATHS[key]
    return [train.origin]
