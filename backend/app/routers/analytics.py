from collections import Counter
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.database import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    defects = db.query(models.Defect).all()
    status_counts = Counter(d.status for d in defects)
    return {
        "total_defects": len(defects),
        "open": status_counts.get("open", 0),
        "scheduled": status_counts.get("scheduled", 0),
        "rejected": status_counts.get("rejected", 0),
        "deferred": status_counts.get("deferred", 0),
        "total_reports": db.query(models.Report).count(),
    }


@router.get("/by-type")
def by_type(db: Session = Depends(get_db)):
    defects = db.query(models.Defect).all()
    counts = Counter(d.defect_class for d in defects)
    return [{"defect_class": k, "count": v} for k, v in counts.items()]


@router.get("/by-district")
def by_district(db: Session = Depends(get_db)):
    defects = db.query(models.Defect).all()
    counts = Counter(d.segment.district for d in defects)
    return [{"district": k, "count": v} for k, v in counts.items()]


@router.get("/trend")
def trend(db: Session = Depends(get_db)):
    """Defects created per day, oldest to newest."""
    defects = db.query(models.Defect).order_by(models.Defect.created_at).all()
    counts: dict[str, int] = {}
    for d in defects:
        day = d.created_at.date().isoformat()
        counts[day] = counts.get(day, 0) + 1
    return [{"date": k, "count": v} for k, v in sorted(counts.items())]


@router.get("/approval-funnel")
def approval_funnel(db: Session = Depends(get_db)):
    logs = db.query(models.ApprovalLog).all()
    counts = Counter(log.action for log in logs)
    return [{"action": k, "count": v} for k, v in counts.items()]
