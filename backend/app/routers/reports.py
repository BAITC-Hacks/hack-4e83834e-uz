from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas, services
from app.config import UPLOADS_DIR
from app.database import get_db
from app.detection.detector import detect
from app.routers.defects import _save_upload

router = APIRouter(prefix="/reports", tags=["reports"])

# A repeat report only "clusters" onto an existing defect if that defect is
# still open and was first observed within this window - an old, already
# resolved-looking defect shouldn't silently absorb an unrelated new report.
MATCH_WINDOW_DAYS = 90


@router.post("", response_model=schemas.ReportSubmitResult)
def submit_report(
    segment_id: int = Form(...),
    note: str | None = Form(None),
    source: str = Form("citizen"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Citizen (or dashcam/inspection) defect submission. Runs detection on
    the photo; if it matches an existing open defect at the same segment
    (same class, reported recently), this becomes a repeat report - which
    feeds the repeat-report factor of the priority score. Otherwise a new
    Defect is created from the highest-confidence detection."""
    segment = db.get(models.RoadSegment, segment_id)
    if not segment:
        raise HTTPException(404, "Road segment not found")

    image_name = _save_upload(file)
    image_path = UPLOADS_DIR / image_name
    detections = detect(image_path)

    if not detections:
        return schemas.ReportSubmitResult(
            matched_existing_defect=False,
            detections_found=0,
            defect=None,
            message="No defect could be automatically detected in this photo. "
                    "It has not been added to the queue - try a clearer, closer photo of the defect.",
        )

    best = max(detections, key=lambda d: d.confidence)
    cutoff = datetime.now(timezone.utc) - timedelta(days=MATCH_WINDOW_DAYS)

    existing = (
        db.query(models.Defect)
        .filter(
            models.Defect.segment_id == segment.id,
            models.Defect.defect_class == best.defect_class,
            models.Defect.status == "open",
            models.Defect.created_at >= cutoff,
        )
        .order_by(models.Defect.created_at.desc())
        .first()
    )

    if existing:
        report = models.Report(defect_id=existing.id, segment_id=segment.id, source=source, image_path=image_name, note=note)
        db.add(report)
        db.commit()
        db.refresh(existing)
        return schemas.ReportSubmitResult(
            matched_existing_defect=True,
            detections_found=len(detections),
            defect=services.build_defect_out(db, existing),
            message="Matched to an existing open defect at this location - added as a repeat report.",
        )

    defect = models.Defect(
        segment_id=segment.id,
        defect_class=best.defect_class,
        confidence=best.confidence,
        x1=best.bbox[0], y1=best.bbox[1], x2=best.bbox[2], y2=best.bbox[3],
        area_pct=best.area_pct,
        model_source=best.model,
        image_path=image_name,
        lat=segment.lat,
        lng=segment.lng,
        status="open",
    )
    db.add(defect)
    db.flush()
    report = models.Report(defect_id=defect.id, segment_id=segment.id, source=source, image_path=image_name, note=note)
    db.add(report)
    db.commit()
    db.refresh(defect)
    return schemas.ReportSubmitResult(
        matched_existing_defect=False,
        detections_found=len(detections),
        defect=services.build_defect_out(db, defect),
        message="New defect created from this report.",
    )
