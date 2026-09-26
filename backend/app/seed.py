"""Populates the database with demo data so the dashboard has something to
show immediately after `git clone` + setup, without requiring a live
detection run first.

Road segments use Almaty district names and approximate (illustrative, not
authoritative) district-center coordinates purely as realistic-looking demo
geography - see /data/README.md. Traffic volumes come from the documented
synthetic generator in scoring/traffic_sim.py.

A handful of defects are created from REAL YOLOv8 inference on the
hand-labeled sample images (data/sample_images/) - these carry
model_source="roadwatch-finetuned". The rest are purely synthetic
(model_source="seed-synthetic": randomly generated class/confidence/area,
no image was actually run through the detector) purely to give the demo
queue/map/analytics enough volume to be interesting - this is stated
explicitly here and in the README so nobody mistakes seed volume for
detection accuracy.

Run with:
    cd backend && source venv/bin/activate && python -m app.seed
"""
from __future__ import annotations

import random
import shutil
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app import models
from app.config import SAMPLE_IMAGES_DIR, TRAINED_DEFECT_CLASSES, UPLOADS_DIR
from app.database import Base, SessionLocal, engine
from app.detection.detector import detect
from app.scoring.traffic_sim import synthetic_daily_traffic

RANDOM_SEED = 7

# Approximate, illustrative district centers for Almaty and Astana (not
# authoritative GIS data - just enough spread to make the demo map look realistic).
DISTRICT_CENTERS = {
    # Almaty
    "Medeu": (43.222, 77.043),
    "Bostandyk": (43.212, 76.909),
    "Almaly": (43.255, 76.945),
    "Auezov": (43.238, 76.851),
    "Nauryzbay": (43.174, 76.797),
    "Turksib": (43.284, 76.960),
    # Astana
    "Esil": (51.128, 71.430),
    "Saryarka": (51.180, 71.390),
    "Baikonur": (51.175, 71.430),
    "Almaty (Astana)": (51.155, 71.475),
    "Nura": (51.105, 71.385),
}

ALMATY_STREETS = [
    "Abay Ave", "Al-Farabi Ave", "Dostyk Ave", "Seifullin Ave", "Rozybakiev St",
    "Zharokov St", "Tole Bi St", "Nazarbayev Ave", "Raiymbek Ave", "Momyshuly Ave",
    "Suyunbai Ave", "Ryskulov Ave", "Zhandosov St", "Baizakov St", "Gagarin Ave",
]

ASTANA_STREETS = [
    "Mangilik El Ave", "Kabanbay Batyr Ave", "Turan Ave", "Respublika Ave",
    "Sarayshyk St", "Syganak St", "Kenessary St", "Bogenbay Batyr Ave", "Tauelsizdik Ave",
    "Uly Dala Ave", "Qabanbay Batyr Ave", "Turkestan St",
]

ASTANA_DISTRICTS = {"Esil", "Saryarka", "Baikonur", "Almaty (Astana)", "Nura"}

ROAD_CLASS_WEIGHTS = [("arterial", 0.2), ("collector", 0.4), ("local", 0.4)]


def _weighted_choice(rng: random.Random, weighted: list[tuple[str, float]]) -> str:
    total = sum(w for _, w in weighted)
    r = rng.uniform(0, total)
    upto = 0.0
    for value, w in weighted:
        upto += w
        if r <= upto:
            return value
    return weighted[-1][0]


def seed() -> None:
    rng = random.Random(RANDOM_SEED)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    db = SessionLocal()
    try:
        # --- Road segments -------------------------------------------------
        segments: list[models.RoadSegment] = []
        seg_id_counter = 0
        for district, (clat, clng) in DISTRICT_CENTERS.items():
            street_pool = ASTANA_STREETS if district in ASTANA_DISTRICTS else ALMATY_STREETS
            for _ in range(4):
                seg_id_counter += 1
                road_class = _weighted_choice(rng, ROAD_CLASS_WEIGHTS)
                lat = clat + rng.uniform(-0.02, 0.02)
                lng = clng + rng.uniform(-0.02, 0.02)
                traffic = synthetic_daily_traffic(road_class, district, seed=seg_id_counter * 97 + RANDOM_SEED)
                segment = models.RoadSegment(
                    name=f"{rng.choice(street_pool)} ({district})",
                    district=district,
                    road_class=road_class,
                    lat=lat,
                    lng=lng,
                    daily_traffic=traffic,
                )
                db.add(segment)
                segments.append(segment)
        db.flush()

        # --- Real detections from the hand-labeled sample images -----------
        now = datetime.now(timezone.utc)
        sample_images = sorted(SAMPLE_IMAGES_DIR.glob("*.jpg"))
        real_defects: list[models.Defect] = []
        for img_path in sample_images:
            dets = detect(img_path)
            if not dets:
                continue
            best = max(dets, key=lambda d: d.confidence)
            dest_name = f"{uuid.uuid4().hex}{img_path.suffix}"
            shutil.copy(img_path, UPLOADS_DIR / dest_name)
            segment = rng.choice(segments)
            created_at = now - timedelta(days=rng.uniform(0, 40))
            defect = models.Defect(
                segment_id=segment.id,
                defect_class=best.defect_class,
                confidence=best.confidence,
                x1=best.bbox[0], y1=best.bbox[1], x2=best.bbox[2], y2=best.bbox[3],
                area_pct=best.area_pct,
                model_source=best.model,
                image_path=dest_name,
                lat=segment.lat, lng=segment.lng,
                status="open",
                created_at=created_at,
            )
            db.add(defect)
            db.flush()
            db.add(models.Report(defect_id=defect.id, segment_id=segment.id, source="inspection", image_path=dest_name, submitted_at=created_at))
            real_defects.append(defect)

        # Stand-in photos for the purely-synthetic defects below (no real
        # detection was run on these - model_source makes that explicit).
        standin_photos = [f.name for f in UPLOADS_DIR.glob("*.jpg")] or [sample_images[0].name]

        # --- Synthetic defects (volume for a realistic-looking demo queue) -
        # Only TRAINED_DEFECT_CLASSES are used here - broken_curb/faded_marking
        # have zero real training images (see /model/README.md), so the demo
        # never shows a defect class the detector can't actually find. Their
        # area ranges stay defined below for when real training data exists.
        AREA_RANGES = {
            "pothole": (2.0, 20.0),
            "crack": (1.0, 15.0),
            "broken_curb": (3.0, 12.0),
            "faded_marking": (5.0, 25.0),
        }
        CONF_RANGE = (0.35, 0.95)
        N_SYNTHETIC = 70

        synthetic_defects: list[models.Defect] = []
        for _ in range(N_SYNTHETIC):
            defect_class = rng.choice(TRAINED_DEFECT_CLASSES)
            segment = rng.choice(segments)
            lo, hi = AREA_RANGES[defect_class]
            area_pct = rng.uniform(lo, hi)
            confidence = rng.uniform(*CONF_RANGE)
            created_at = now - timedelta(days=rng.uniform(0, 45))
            image_name = rng.choice(standin_photos)
            defect = models.Defect(
                segment_id=segment.id,
                defect_class=defect_class,
                confidence=round(confidence, 3),
                x1=100, y1=100, x2=300, y2=250,
                area_pct=round(area_pct, 2),
                model_source="seed-synthetic",
                image_path=image_name,
                lat=segment.lat + rng.uniform(-0.002, 0.002),
                lng=segment.lng + rng.uniform(-0.002, 0.002),
                status="open",
                created_at=created_at,
            )
            db.add(defect)
            db.flush()
            db.add(models.Report(defect_id=defect.id, segment_id=segment.id, source="seed-synthetic", image_path=image_name, submitted_at=created_at))
            synthetic_defects.append(defect)

        # --- Repeat reports: cluster extra reports onto ~30% of defects ----
        all_defects = real_defects + synthetic_defects
        for defect in all_defects:
            if rng.random() < 0.3:
                n_extra = rng.randint(1, 4)
                for _ in range(n_extra):
                    age_days = rng.uniform(0, 18)
                    submitted_at = now - timedelta(days=age_days)
                    db.add(models.Report(
                        defect_id=defect.id, segment_id=defect.segment_id,
                        source=rng.choice(["citizen", "citizen", "dashcam"]),
                        image_path=defect.image_path,
                        note=None,
                        submitted_at=submitted_at,
                    ))

        # --- A few already-reviewed defects, so the dashboard shows the ---
        # --- approval workflow in action, not just an all-open queue -----
        reviewers = ["A. Zhaksybekov", "N. Sadykova", "M. Tulegenov"]
        for defect in rng.sample(all_defects, k=min(8, len(all_defects))):
            action = rng.choice(["approve", "reject", "defer"])
            status = {"approve": "scheduled", "reject": "rejected", "defer": "deferred"}[action]
            defect.status = status
            db.add(models.ApprovalLog(
                defect_id=defect.id,
                action=action,
                reviewer_name=rng.choice(reviewers),
                comment=None,
                decided_at=now - timedelta(days=rng.uniform(0, 5)),
            ))

        db.commit()
        print(f"Seeded {len(segments)} segments, {len(real_defects)} real-detection defects, "
              f"{len(synthetic_defects)} synthetic defects.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
