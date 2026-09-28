from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas, services
from app.config import UPLOADS_DIR
from app.database import get_db
from app.detection.detector import detect
from app.firebase_auth import verify_firebase_user
from app.routers.defects import _save_upload
from app.scoring.geo import find_nearest_segment

router = APIRouter(prefix="/reports", tags=["reports"])

# A repeat report only "clusters" onto an existing defect if that defect is
# still open and was first observed within this window - an old, already
# resolved-looking defect shouldn't silently absorb an unrelated new report.
MATCH_WINDOW_DAYS = 90


@router.post("", response_model=schemas.ReportSubmitResult)
def submit_report(
    # segment_id is optional so that future API clients (e.g. a native mobile
    # app) can omit the manual dropdown selection when they supply GPS coords.
    # The frontend still always sends it (from the confirmable dropdown), so
    # the omission path is primarily for direct API callers.
    segment_id: int | None = Form(None),
    note: str | None = Form(None),
    source: str = Form("citizen"),
    # Optional GPS coordinates captured by the client at photo-taking time.
    # When present these give the Defect a precise pin rather than the
    # segment centroid; segment_id is still required for the priority scorer
    # because district, road_class, and daily_traffic live on RoadSegment.
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: dict = Depends(verify_firebase_user),
):
    """Citizen (or dashcam/inspection) defect submission. Runs detection on
    the photo; if it matches an existing open defect at the same segment
    (same class, reported recently), this becomes a repeat report - which
    feeds the repeat-report factor of the priority score. Otherwise a new
    Defect is created from the highest-confidence detection.

    Segment resolution order
    ------------------------
    1. segment_id provided → use it directly (normal frontend path).
    2. segment_id absent, lat/lng present → resolve via find_nearest_segment();
       if nothing is within 150 m, return no_segment_matched=True so the
       caller can prompt the user rather than silently guessing.
    3. Neither segment_id nor lat/lng → HTTP 422 (no location signal at all).

    The defect's geographic coordinates are set to the caller-supplied GPS
    fix when available, falling back to the segment centroid so the column
    is never null."""
    # ── Segment resolution ───────────────────────────────────────────────
    if segment_id is not None:
        segment = db.get(models.RoadSegment, segment_id)
        if not segment:
            raise HTTPException(404, "Road segment not found")
    elif lat is not None and lng is not None:
        segment = find_nearest_segment(lat, lng, db)
        if segment is None:
            return schemas.ReportSubmitResult(
                matched_existing_defect=False,
                detections_found=0,
                defect=None,
                no_segment_matched=True,
                message="Your GPS location didn't match any tracked road segment. "
                        "Please select the nearest one manually and resubmit.",
                message_ru="Ваши GPS-координаты не совпали ни с одним известным участком дороги. "
                           "Пожалуйста, выберите ближайший участок вручную и попробуйте снова.",
            )
    else:
        raise HTTPException(
            422,
            "Either segment_id or GPS coordinates (lat + lng) must be provided.",
        )

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
            message_ru="Не удалось автоматически распознать дефект на этом фото. "
                       "Оно не добавлено в очередь - попробуйте более чёткое и близкое фото дефекта.",
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
            message_ru="Совпало с уже открытым дефектом на этом месте - добавлено как повторное обращение.",
        )

    # Prefer the caller's GPS fix; fall back to the segment centroid so the
    # column is never null even when the client doesn't support geolocation.
    defect_lat = lat if lat is not None else segment.lat
    defect_lng = lng if lng is not None else segment.lng

    defect = models.Defect(
        segment_id=segment.id,
        defect_class=best.defect_class,
        confidence=best.confidence,
        x1=best.bbox[0], y1=best.bbox[1], x2=best.bbox[2], y2=best.bbox[3],
        area_pct=best.area_pct,
        model_source=best.model,
        image_path=image_name,
        lat=defect_lat,
        lng=defect_lng,
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
        message_ru="Создан новый дефект по этому обращению.",
    )
