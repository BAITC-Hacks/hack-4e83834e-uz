from datetime import datetime, timezone

from sqlalchemy import Float, ForeignKey, Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RoadSegment(Base):
    __tablename__ = "road_segments"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    district: Mapped[str] = mapped_column(String, nullable=False)
    road_class: Mapped[str] = mapped_column(String, nullable=False)  # arterial / collector / local
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)
    daily_traffic: Mapped[int] = mapped_column(Integer, nullable=False)

    defects: Mapped[list["Defect"]] = relationship(back_populates="segment")
    reports: Mapped[list["Report"]] = relationship(back_populates="segment")


class Defect(Base):
    __tablename__ = "defects"

    id: Mapped[int] = mapped_column(primary_key=True)
    segment_id: Mapped[int] = mapped_column(ForeignKey("road_segments.id"), nullable=False)

    defect_class: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    x1: Mapped[float] = mapped_column(Float, nullable=False)
    y1: Mapped[float] = mapped_column(Float, nullable=False)
    x2: Mapped[float] = mapped_column(Float, nullable=False)
    y2: Mapped[float] = mapped_column(Float, nullable=False)
    area_pct: Mapped[float] = mapped_column(Float, nullable=False)
    model_source: Mapped[str] = mapped_column(String, nullable=False)  # roadwatch-finetuned / pretrained-coco / seed-synthetic

    image_path: Mapped[str] = mapped_column(String, nullable=False)
    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)

    status: Mapped[str] = mapped_column(String, nullable=False, default="open")  # open / scheduled / rejected / deferred
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    segment: Mapped["RoadSegment"] = relationship(back_populates="defects")
    reports: Mapped[list["Report"]] = relationship(back_populates="defect")
    approval_logs: Mapped[list["ApprovalLog"]] = relationship(back_populates="defect")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    defect_id: Mapped[int] = mapped_column(ForeignKey("defects.id"), nullable=False)
    segment_id: Mapped[int] = mapped_column(ForeignKey("road_segments.id"), nullable=False)

    source: Mapped[str] = mapped_column(String, nullable=False)  # citizen / dashcam / inspection / seed-synthetic
    image_path: Mapped[str] = mapped_column(String, nullable=True)
    note: Mapped[str] = mapped_column(String, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    defect: Mapped["Defect"] = relationship(back_populates="reports")
    segment: Mapped["RoadSegment"] = relationship(back_populates="reports")


class ApprovalLog(Base):
    __tablename__ = "approval_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    defect_id: Mapped[int] = mapped_column(ForeignKey("defects.id"), nullable=False)

    action: Mapped[str] = mapped_column(String, nullable=False)  # approve / reject / defer
    reviewer_name: Mapped[str] = mapped_column(String, nullable=False)
    comment: Mapped[str] = mapped_column(String, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    defect: Mapped["Defect"] = relationship(back_populates="approval_logs")
