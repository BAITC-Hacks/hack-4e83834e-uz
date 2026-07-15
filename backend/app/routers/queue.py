from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas, services
from app.database import get_db

router = APIRouter(prefix="/queue", tags=["queue"])


@router.get("", response_model=list[schemas.QueueItemOut])
def get_queue(
    defect_class: str | None = None,
    district: str | None = None,
    status: str = "open",
    db: Session = Depends(get_db),
):
    """The ranked repair queue: open defects sorted by learned priority
    score, descending. This is the human-in-the-loop review surface - every
    item here is a *recommendation*, not a scheduled action (see
    /defects/{id}/review, the only endpoint that can change status)."""
    query = db.query(models.Defect).filter(models.Defect.status == status)
    if defect_class:
        query = query.filter(models.Defect.defect_class == defect_class)
    defects = query.all()
    if district:
        defects = [d for d in defects if d.segment.district == district]

    scored = [(services.priority_sort_key(db, d), d) for d in defects]
    scored.sort(key=lambda pair: pair[0], reverse=True)

    return [
        schemas.QueueItemOut(rank=i + 1, defect=services.build_defect_out(db, d, rank=i + 1))
        for i, (_, d) in enumerate(scored)
    ]
