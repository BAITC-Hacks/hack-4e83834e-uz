"""Turns a defect's features + score breakdown into the human-readable
explanation shown to the analyst. Every ranked item must show one - see
constraint #2 in the project prompt: "no unexplained scores."
"""
from __future__ import annotations

from app.scoring.features import DefectFeatures

DEFECT_LABELS = {
    "pothole": "Pothole",
    "crack": "Crack",
    "broken_curb": "Broken curb",
    "faded_marking": "Faded lane marking",
}


def _severity_label(severity: float) -> str:
    if severity >= 0.66:
        return "high"
    if severity >= 0.33:
        return "medium"
    return "low"


def _severity_reason(features: DefectFeatures) -> str:
    size = "large area" if features.area_pct >= 8 else "small area"
    return f"{size}, {features.confidence:.2f} confidence"


def generate_explanation(rank: int, features: DefectFeatures, num_reports: int, report_window_days: int = 14) -> str:
    label = DEFECT_LABELS.get(features.defect_class, features.defect_class)
    severity_label = _severity_label(features.severity)
    severity_reason = _severity_reason(features)

    parts = [
        f"Ranked #{rank} — {label}, severity: {severity_label} ({severity_reason}).",
        f"Location averages {features.daily_traffic} vehicles/day.",
    ]
    if num_reports > 1:
        ordinal = _ordinal(num_reports)
        parts.append(f"{ordinal} citizen report at this location in the past {report_window_days} days.")
    else:
        parts.append("First report at this location.")
    return " ".join(parts)


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"
