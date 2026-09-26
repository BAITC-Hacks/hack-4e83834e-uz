from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    district: str
    road_class: str
    lat: float
    lng: float
    daily_traffic: int


class ApprovalLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action: str
    reviewer_name: str
    comment: str | None
    decided_at: datetime


class ScoreBreakdown(BaseModel):
    severity: float
    traffic: float
    repeat_reports: float


class DefectOut(BaseModel):
    id: int
    defect_class: str
    confidence: float
    bbox: tuple[float, float, float, float]
    area_pct: float
    model_source: str
    image_url: str
    status: str
    created_at: datetime

    segment: SegmentOut
    num_reports: int

    priority_score: float
    scorer_used: str
    score_breakdown_pct: ScoreBreakdown
    explanation: str
    explanation_ru: str

    approval_logs: list[ApprovalLogOut] = []


class QueueItemOut(BaseModel):
    rank: int
    defect: DefectOut


class ReviewIn(BaseModel):
    action: str  # approve / reject / defer
    reviewer_name: str
    comment: str | None = None


class ReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    defect_id: int
    segment_id: int
    source: str
    note: str | None
    submitted_at: datetime


class ReportSubmitResult(BaseModel):
    matched_existing_defect: bool
    detections_found: int
    defect: DefectOut | None
    message: str
    message_ru: str
    # True only when lat/lng were supplied but no RoadSegment fell within the
    # acceptance radius.  Returned as False on all other paths so existing
    # consumers don't need to handle a missing field.
    no_segment_matched: bool = False
