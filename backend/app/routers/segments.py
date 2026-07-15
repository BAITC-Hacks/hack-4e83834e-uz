from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/segments", tags=["segments"])


@router.get("", response_model=list[schemas.SegmentOut])
def list_segments(db: Session = Depends(get_db)):
    return db.query(models.RoadSegment).all()
