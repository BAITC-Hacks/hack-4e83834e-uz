import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models, schemas, services
from app.config import UPLOADS_DIR
from app.database import get_db
from app.detection.detector import detect

router = APIRouter(prefix="/defects", tags=["defects"])

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _save_upload(file: UploadFile) -> str:
    ext = Path(file.filename or "upload.jpg").suffix or ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    dest = UPLOADS_DIR / name
    with dest.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return name


@router.post("/detect", response_model=list[schemas.DefectOut])
def detect_defects(
    segment_id: int = Form(...),
    source: str = Form("inspection"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Upload an inspection/dashcam photo, run YOLOv8 detection, and create
    one open Defect record per detection found. Does not create a Report -
    use POST /reports for citizen submissions, which also handles
    repeat-report matching."""
    segment = db.get(models.RoadSegment, segment_id)
    if not segment:
        raise HTTPException(404, "Road segment not found")

    image_name = _save_upload(file)
    image_path = UPLOADS_DIR / image_name
    detections = detect(image_path)
    if not detections:
        raise HTTPException(422, "No defects detected in this image (below confidence threshold or unsupported class).")

    created = []
    for d in detections:
        defect = models.Defect(
            segment_id=segment.id,
            defect_class=d.defect_class,
            confidence=d.confidence,
            x1=d.bbox[0], y1=d.bbox[1], x2=d.bbox[2], y2=d.bbox[3],
            area_pct=d.area_pct,
            model_source=d.model,
            image_path=image_name,
            lat=segment.lat,
            lng=segment.lng,
            status="open",
        )
        db.add(defect)
        db.flush()
        report = models.Report(defect_id=defect.id, segment_id=segment.id, source=source, image_path=image_name)
        db.add(report)
        created.append(defect)
    db.commit()
    for defect in created:
        db.refresh(defect)
    return [services.build_defect_out(db, d) for d in created]


@router.get("", response_model=list[schemas.DefectOut])
def list_defects(
    defect_class: str | None = None,
    district: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Defect)
    if defect_class:
        query = query.filter(models.Defect.defect_class == defect_class)
    if status:
        query = query.filter(models.Defect.status == status)
    defects = query.all()
    if district:
        defects = [d for d in defects if d.segment.district == district]
    return [services.build_defect_out(db, d) for d in defects]


@router.get("/{defect_id}", response_model=schemas.DefectOut)
def get_defect(defect_id: int, db: Session = Depends(get_db)):
    defect = db.get(models.Defect, defect_id)
    if not defect:
        raise HTTPException(404, "Defect not found")
    return services.build_defect_out(db, defect)
