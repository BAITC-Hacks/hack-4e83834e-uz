"""Time-decayed repeat-report scoring.

A location that keeps getting reported by different citizens/inspections is
a stronger signal than a single stale report. We model that with
exponential time-decay: a report `age_days` old contributes
`exp(-ln(2) * age_days / HALF_LIFE_DAYS)` to the cluster score - i.e. a
report from exactly one half-life ago counts for half as much as one filed
today, and old reports fade out smoothly rather than being cut off with a
hard window.

Reports are clustered by "same location" using a fixed-radius proximity
check (see config.REPEAT_REPORT_RADIUS_METERS) rather than requiring exact
coordinate matches, since citizen-submitted GPS/pin locations for the same
physical defect will vary by a few meters.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

from app.config import REPEAT_REPORT_HALF_LIFE_DAYS

EARTH_RADIUS_M = 6_371_000.0


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def decay_weight(age_days: float, half_life_days: float = REPEAT_REPORT_HALF_LIFE_DAYS) -> float:
    if age_days < 0:
        age_days = 0
    return math.exp(-math.log(2) * age_days / half_life_days)


def repeat_report_score(report_ages_days: list[float]) -> float:
    """Sum of time-decayed weights for all reports clustered at a location.

    A single report today scores 1.0. Three reports in the past two weeks
    (the README example) score noticeably higher than one old report,
    because each recent report contributes close to its full weight.
    """
    return sum(decay_weight(age) for age in report_ages_days)


def normalize_repeat_score(raw_score: float, reference_max: float = 5.0) -> float:
    """Map the raw decayed-sum score onto 0-1 for combination with other factors."""
    return max(0.0, min(1.0, raw_score / reference_max))


def age_in_days(reported_at: datetime, now: datetime | None = None) -> float:
    now = now or datetime.now(timezone.utc)
    if reported_at.tzinfo is None:
        reported_at = reported_at.replace(tzinfo=timezone.utc)
    return max(0.0, (now - reported_at).total_seconds() / 86400.0)
