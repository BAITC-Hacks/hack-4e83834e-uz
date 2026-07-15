"""Loads the trained LogisticRegression ranker and scores defects.

This is the priority score actually used to rank the queue (see
/model/README.md for why a learned model was used instead of only the
transparent weighted sum, and scoring/weighted_model.py for the fallback).

Explainability: a logistic regression's per-feature contribution to the
decision is `coef_i * scaled_feature_i` (the scaled feature times its
learned weight). We surface the absolute value of each contribution,
normalized to percentages, as the factor breakdown - this is a faithful
reading of the coefficients (Reasoned directly from the fitted linear
model), not a fabricated post-hoc explanation.
"""
from __future__ import annotations

import threading

import joblib
import numpy as np

from app.config import RANKER_MODEL_PATH
from app.scoring.features import DefectFeatures
from app.scoring.weighted_model import weighted_breakdown, weighted_score

_lock = threading.Lock()
_bundle = None


def _load():
    global _bundle
    with _lock:
        if _bundle is None:
            if not RANKER_MODEL_PATH.exists():
                raise FileNotFoundError(
                    f"Ranker model not found at {RANKER_MODEL_PATH}. "
                    "Run `python -m app.scoring.train_ranker` first."
                )
            _bundle = joblib.load(RANKER_MODEL_PATH)
        return _bundle


def ranker_available() -> bool:
    return RANKER_MODEL_PATH.exists()


def score(features: DefectFeatures) -> tuple[float, dict[str, float], str]:
    """Returns (priority_score 0-1, factor_breakdown_pct, scorer_used)."""
    if not ranker_available():
        return weighted_score(features), weighted_breakdown(features), "weighted-fallback"

    bundle = _load()
    pipeline = bundle["pipeline"]
    x = np.array([features.as_vector()])
    proba = float(pipeline.predict_proba(x)[0, 1])

    scaler = pipeline.named_steps["standardscaler"]
    clf = pipeline.named_steps["logisticregression"]
    scaled = scaler.transform(x)[0]
    contributions = clf.coef_[0] * scaled
    abs_contributions = np.abs(contributions)
    total = abs_contributions.sum() or 1e-9
    breakdown = {
        name: round(float(100 * abs_contributions[i] / total), 1)
        for i, name in enumerate(bundle["feature_order"])
    }
    return round(proba, 4), breakdown, "logistic-ranker"
