"""Turns a defect's features + score breakdown into the human-readable
explanation shown to the analyst. Every ranked item must show one - see
constraint #2 in the project prompt: "no unexplained scores."

Generates both an English and a Russian sentence for every ranked item
(`generate_explanation` / `generate_explanation_ru`) so the dashboard's
lang toggle (ru default, en secondary - see frontend/src/i18n.js) never has
to fall back to an untranslated explanation - see /README.md's RU
localization note.
"""
from __future__ import annotations

from app.scoring.features import DefectFeatures

DEFECT_LABELS = {
    "pothole": "Pothole",
    "crack": "Crack",
    "broken_curb": "Broken curb",
    "faded_marking": "Faded lane marking",
}

DEFECT_LABELS_RU = {
    "pothole": "Выбоина",
    "crack": "Трещина",
    "broken_curb": "Повреждённый бордюр",
    "faded_marking": "Стёртая разметка",
}


def _severity_label(severity: float) -> str:
    if severity >= 0.66:
        return "high"
    if severity >= 0.33:
        return "medium"
    return "low"


def _severity_label_ru(severity: float) -> str:
    if severity >= 0.66:
        return "высокая"
    if severity >= 0.33:
        return "средняя"
    return "низкая"


def _severity_reason(features: DefectFeatures) -> str:
    size = "large area" if features.area_pct >= 8 else "small area"
    return f"{size}, {features.confidence:.2f} confidence"


def _severity_reason_ru(features: DefectFeatures) -> str:
    size = "большая площадь" if features.area_pct >= 8 else "небольшая площадь"
    return f"{size}, уверенность {features.confidence:.2f}"


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


def generate_explanation_ru(rank: int, features: DefectFeatures, num_reports: int, report_window_days: int = 14) -> str:
    label = DEFECT_LABELS_RU.get(features.defect_class, features.defect_class)
    severity_label = _severity_label_ru(features.severity)
    severity_reason = _severity_reason_ru(features)

    parts = [
        f"Ранг №{rank} — {label}, серьёзность: {severity_label} ({severity_reason}).",
        f"На этом участке в среднем {features.daily_traffic} автомобилей/день.",
    ]
    if num_reports > 1:
        parts.append(f"{_ordinal_ru(num_reports)} обращение по этому месту за последние {report_window_days} дней.")
    else:
        parts.append("Первое обращение по этому месту.")
    return " ".join(parts)


def _ordinal(n: int) -> str:
    if 10 <= n % 100 <= 20:
        suffix = "th"
    else:
        suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
    return f"{n}{suffix}"


def _ordinal_ru(n: int) -> str:
    return f"{n}-е"
