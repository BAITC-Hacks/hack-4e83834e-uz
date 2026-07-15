"""Shared logic for turning a Defect ORM row into the fully-scored,
fully-explained API representation. Used by the defects, queue, and
reports routers so they can never disagree on how a score was computed.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app import models, schemas
from app.config import UPLOADS_DIR
from app.scoring.explain import generate_explanation, generate_explanation_ru
from app.scoring.features import DefectFeatures
from app.scoring.ranker_model import score as ranker_score


def _report_ages_days(defect: models.Defect, now: datetime | None = None) -> list[float]:
    now = now or datetime.now(timezone.utc)
    ages = []
    for r in defect.reports:
        submitted = r.submitted_at
        if submitted.tzinfo is None:
            submitted = submitted.replace(tzinfo=timezone.utc)
        ages.append(max(0.0, (now - submitted).total_seconds() / 86400.0))
    return ages


def build_defect_out(db: Session, defect: models.Defect, rank: int | None = None) -> schemas.DefectOut:
    ages = _report_ages_days(defect)
    features = DefectFeatures(
        defect_class=defect.defect_class,
        confidence=defect.confidence,
        area_pct=defect.area_pct,
        daily_traffic=defect.segment.daily_traffic,
        report_ages_days=ages,
    )
    priority, breakdown, scorer_used = ranker_score(features)
    num_reports = len(defect.reports) or 1  # the detection itself counts as the first observation
    explanation = generate_explanation(rank or 1, features, num_reports)
    explanation_ru = generate_explanation_ru(rank or 1, features, num_reports)

    image_name = defect.image_path
    image_url = f"/media/{image_name}"

    return schemas.DefectOut(
        id=defect.id,
        defect_class=defect.defect_class,
        confidence=defect.confidence,
        bbox=(defect.x1, defect.y1, defect.x2, defect.y2),
        area_pct=defect.area_pct,
        model_source=defect.model_source,
        image_url=image_url,
        status=defect.status,
        created_at=defect.created_at,
        segment=schemas.SegmentOut.model_validate(defect.segment),
        num_reports=num_reports,
        priority_score=priority,
        scorer_used=scorer_used,
        score_breakdown_pct=schemas.ScoreBreakdown(**breakdown),
        explanation=explanation,
        explanation_ru=explanation_ru,
        approval_logs=[schemas.ApprovalLogOut.model_validate(a) for a in defect.approval_logs],
    )


def priority_sort_key(db: Session, defect: models.Defect) -> float:
    ages = _report_ages_days(defect)
    features = DefectFeatures(
        defect_class=defect.defect_class,
        confidence=defect.confidence,
        area_pct=defect.area_pct,
        daily_traffic=defect.segment.daily_traffic,
        report_ages_days=ages,
    )
    priority, _, _ = ranker_score(features)
    return priority
