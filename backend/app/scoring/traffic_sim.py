"""Synthetic daily traffic volume generator.

No open per-road-segment traffic count dataset was reachable in this
environment (city open-data portals typically require registration or are
not machine-readable without a specific API key we don't have here), so
traffic volume is **synthetically generated** and clearly documented as
such, per the project's data-honesty requirement (see /data/README.md).

Generation logic (deliberately simple and inspectable):
  - Each road segment is assigned a `road_class` (arterial / collector /
    local), which sets the *center* of a lognormal distribution of daily
    vehicle counts. Arterials carry more traffic than local streets, which
    mirrors how real road hierarchies work.
  - A per-district multiplier nudges central/business districts a bit
    busier than outer residential districts - a coarse proxy for the real
    correlation between traffic and land use, without claiming to model it
    precisely.
  - A fixed random seed makes the demo dataset reproducible across runs.

None of this is fit to real counts. It exists purely so the priority-score
pipeline has a traffic feature to combine with severity and repeat-reports.
"""
from __future__ import annotations

import random

ROAD_CLASS_BASE_TRAFFIC = {
    "arterial": 12000,
    "collector": 4000,
    "local": 900,
}

# Coarse land-use proxy: districts closer to the city center / CBD skew busier.
DISTRICT_TRAFFIC_MULTIPLIER = {
    "Medeu": 1.3,
    "Bostandyk": 1.1,
    "Almaly": 1.4,
    "Auezov": 1.0,
    "Nauryzbay": 0.75,
    "Turksib": 0.85,
}

LOGNORMAL_SIGMA = 0.35  # controls spread around the road-class base


def synthetic_daily_traffic(road_class: str, district: str, seed: int) -> int:
    """Return a synthetic average-daily-traffic (vehicles/day) estimate.

    `seed` should be stable per road segment (e.g. derived from its id) so
    repeated calls for the same segment return the same value.
    """
    base = ROAD_CLASS_BASE_TRAFFIC.get(road_class, ROAD_CLASS_BASE_TRAFFIC["local"])
    multiplier = DISTRICT_TRAFFIC_MULTIPLIER.get(district, 1.0)
    rng = random.Random(seed)
    # lognormal centered so the median matches base * multiplier
    mu = 0.0
    value = base * multiplier * rng.lognormvariate(mu, LOGNORMAL_SIGMA)
    return max(50, round(value))


def normalize_traffic(daily_traffic: int, reference_max: float = 15000.0) -> float:
    """Map a raw daily-traffic count onto a 0-1 scale for scoring.

    `reference_max` is the traffic volume treated as "maximally busy" for
    scoring purposes (roughly the top of the arterial range above) - values
    beyond it are clamped to 1.0 rather than let a single extreme segment
    dominate the score.
    """
    return max(0.0, min(1.0, daily_traffic / reference_max))
