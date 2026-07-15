"""Assembles the 3-factor feature vector (severity, traffic, repeat-reports)
that both the weighted baseline scorer and the learned ranker consume.

Keeping this in one place means the two scorers are guaranteed to see the
same numbers, so comparing them is meaningful.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.config import (
    DEFECT_CLASS_SEVERITY_WEIGHT,
    SEVERITY_AREA_REFERENCE_PCT,
    SEVERITY_AREA_WEIGHT,
    SEVERITY_CONFIDENCE_WEIGHT,
)
from app.scoring.repeat_reports import normalize_repeat_score, repeat_report_score
from app.scoring.traffic_sim import normalize_traffic


@dataclass
class DefectFeatures:
    defect_class: str
    confidence: float
    area_pct: float
    daily_traffic: int
    report_ages_days: list[float]

    severity: float = 0.0
    traffic: float = 0.0
    repeat_reports: float = 0.0

    def __post_init__(self) -> None:
        self.severity = severity_score(self.defect_class, self.confidence, self.area_pct)
        self.traffic = normalize_traffic(self.daily_traffic)
        self.repeat_reports = normalize_repeat_score(repeat_report_score(self.report_ages_days))

    def as_vector(self) -> list[float]:
        """Feature order must match scoring/train_ranker.py's training vectors."""
        return [self.severity, self.traffic, self.repeat_reports]


def severity_score(defect_class: str, confidence: float, area_pct: float) -> float:
    area_norm = min(1.0, max(0.0, area_pct) / SEVERITY_AREA_REFERENCE_PCT)
    base = SEVERITY_CONFIDENCE_WEIGHT * confidence + SEVERITY_AREA_WEIGHT * area_norm
    class_weight = DEFECT_CLASS_SEVERITY_WEIGHT.get(defect_class, 0.5)
    return round(min(1.0, base * class_weight), 4)
