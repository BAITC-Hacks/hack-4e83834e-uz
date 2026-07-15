import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app import models
from app.database import Base
from app.scoring.train_ranker import MIN_REAL_SAMPLES, load_approval_labeled_set


@pytest.fixture()
def db_session():
    tmp_dir = tempfile.mkdtemp()
    db_path = Path(tmp_dir) / "test_ranker.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


def _seed_defect_with_decision(db, i: int, action: str) -> None:
    segment = models.RoadSegment(
        name=f"Test St {i}", district="Almaly", road_class="arterial",
        lat=43.25, lng=76.94, daily_traffic=5000 + i * 10,
    )
    db.add(segment)
    db.flush()

    now = datetime.now(timezone.utc)
    defect = models.Defect(
        segment_id=segment.id,
        defect_class="pothole" if i % 2 == 0 else "crack",
        confidence=0.5 + (i % 5) * 0.1,
        x1=0, y1=0, x2=10, y2=10,
        area_pct=5.0 + i % 10,
        model_source="seed-synthetic",
        image_path="x.jpg",
        lat=segment.lat, lng=segment.lng,
        status="open",
        created_at=now - timedelta(days=5),
    )
    db.add(defect)
    db.flush()
    db.add(models.Report(defect_id=defect.id, segment_id=segment.id, source="citizen", submitted_at=now - timedelta(days=4)))
    db.add(models.ApprovalLog(defect_id=defect.id, action=action, reviewer_name="Tester", decided_at=now))
    db.commit()


def test_load_approval_labeled_set_returns_none_below_minimum(db_session):
    for i in range(MIN_REAL_SAMPLES - 1):
        _seed_defect_with_decision(db_session, i, "approve" if i % 2 == 0 else "reject")

    assert load_approval_labeled_set(db_session) is None


def test_load_approval_labeled_set_trains_once_minimum_reached(db_session):
    for i in range(MIN_REAL_SAMPLES + 5):
        _seed_defect_with_decision(db_session, i, "approve" if i % 2 == 0 else "reject")

    result = load_approval_labeled_set(db_session)
    assert result is not None
    X, y = result
    assert X.shape == (MIN_REAL_SAMPLES + 5, 3)
    assert set(y.tolist()) == {0, 1}
