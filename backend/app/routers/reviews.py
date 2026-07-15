from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas, services
from app.database import get_db

router = APIRouter(prefix="/defects", tags=["reviews"])

ACTION_TO_STATUS = {
    "approve": "scheduled",
    "reject": "rejected",
    "defer": "deferred",
}


@router.post("/{defect_id}/review", response_model=schemas.DefectOut)
def review_defect(defect_id: int, review: schemas.ReviewIn, db: Session = Depends(get_db)):
    """The ONLY endpoint that can move a defect out of the open queue.
    Requires an explicit reviewer identity and action, and writes an
    immutable, timestamped ApprovalLog row - this is what satisfies the
    human-in-the-loop constraint: the AI ranks, a named human decides."""
    defect = db.get(models.Defect, defect_id)
    if not defect:
        raise HTTPException(404, "Defect not found")
    if review.action not in ACTION_TO_STATUS:
        raise HTTPException(400, f"action must be one of {list(ACTION_TO_STATUS)}")
    if not review.reviewer_name.strip():
        raise HTTPException(400, "reviewer_name is required")

    log = models.ApprovalLog(
        defect_id=defect.id,
        action=review.action,
        reviewer_name=review.reviewer_name.strip(),
        comment=review.comment,
    )
    db.add(log)
    defect.status = ACTION_TO_STATUS[review.action]
    db.commit()
    db.refresh(defect)
    return services.build_defect_out(db, defect)


@router.get("/{defect_id}/history", response_model=list[schemas.ApprovalLogOut])
def review_history(defect_id: int, db: Session = Depends(get_db)):
    defect = db.get(models.Defect, defect_id)
    if not defect:
        raise HTTPException(404, "Defect not found")
    return [schemas.ApprovalLogOut.model_validate(a) for a in defect.approval_logs]
