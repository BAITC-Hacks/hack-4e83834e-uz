"""Transparent weighted-sum priority scorer.

This is the fully inspectable baseline: priority = sum(weight_i * feature_i)
using the fixed weights in config.WEIGHTED_SCORE_WEIGHTS (severity 45%,
traffic 35%, repeat-reports 20% by default). No training, no black box -
an analyst can recompute this by hand from the three feature values.

The learned ranker (scoring/ranker_model.py) is what actually drives the
production queue ranking (see /model/README.md and /README.md for why:
the prompt explicitly wants a genuine learned model, not just this
if/else-style function) - this weighted score is kept as a transparent
point of comparison and as a graceful fallback if the ranker model file is
ever missing.
"""
from __future__ import annotations

from app.config import WEIGHTED_SCORE_WEIGHTS
from app.scoring.features import DefectFeatures


def weighted_score(features: DefectFeatures) -> float:
    return round(
        WEIGHTED_SCORE_WEIGHTS["severity"] * features.severity
        + WEIGHTED_SCORE_WEIGHTS["traffic"] * features.traffic
        + WEIGHTED_SCORE_WEIGHTS["repeat_reports"] * features.repeat_reports,
        4,
    )


def weighted_breakdown(features: DefectFeatures) -> dict[str, float]:
    """Percent contribution of each factor to the weighted score, for display."""
    contributions = {
        "severity": WEIGHTED_SCORE_WEIGHTS["severity"] * features.severity,
        "traffic": WEIGHTED_SCORE_WEIGHTS["traffic"] * features.traffic,
        "repeat_reports": WEIGHTED_SCORE_WEIGHTS["repeat_reports"] * features.repeat_reports,
    }
    total = sum(contributions.values()) or 1e-9
    return {k: round(100 * v / total, 1) for k, v in contributions.items()}
