"""Computes real, measured numbers for the README/docs "Measurable impact"
section from the current seeded database - not invented figures. Every
number this script prints came from actually running the pipeline; where a
number genuinely can't be measured without real analysts (e.g. "minutes
saved per triage session"), we say so explicitly instead of guessing.

Run with (after `python -m app.seed`):
    cd backend && source venv/bin/activate && python -m app.scoring.measure_impact

What it measures:

1. **Ranked-queue vs. chronological (no-AI) ordering** - if an analyst had
   no ranking at all (a static form, defects handled in the order they came
   in - "ordinary automation"), how many of the highest-real-world-urgency
   defects (those on `arterial` roads - the highest documented synthetic
   traffic tier, see /data/README.md) would still be sitting unseen past
   position 10 in a purely chronological queue, versus the learned
   ranker's queue? This is the concrete evidence for the "why this can't
   be solved by ordinary automation" claim about prioritization.
2. **Repeat-report surfacing** - average queue position of defects with 3+
   reports (recurring citizen complaints) under the ranker vs. chronological
   order.
3. **Detection throughput** - real measured wall-clock inference time of
   the fine-tuned YOLOv8 detector over the sample images, on CPU (matching
   the project's "runs on CPU" constraint) - images/sec, not a spec-sheet
   number.
"""
from __future__ import annotations

import time

from app import models
from app.config import SAMPLE_IMAGES_DIR
from app.database import SessionLocal
from app.detection.detector import detect
from app.scoring.features import DefectFeatures
from app.scoring.ranker_model import score as ranker_score
from app.services import _report_ages_days


def _open_defects_with_features(db):
    defects = db.query(models.Defect).filter(models.Defect.status == "open").all()
    out = []
    for d in defects:
        features = DefectFeatures(
            defect_class=d.defect_class,
            confidence=d.confidence,
            area_pct=d.area_pct,
            daily_traffic=d.segment.daily_traffic,
            report_ages_days=_report_ages_days(d),
        )
        priority, _, _ = ranker_score(features)
        out.append(
            {
                "defect": d,
                "priority": priority,
                "num_reports": len(d.reports),
                "road_class": d.segment.road_class,
                "created_at": d.created_at,
            }
        )
    return out


def measure_ranking_impact(db) -> dict:
    rows = _open_defects_with_features(db)
    n = len(rows)

    ranked_order = sorted(rows, key=lambda r: r["priority"], reverse=True)
    chrono_order = sorted(rows, key=lambda r: r["created_at"])

    top_10_ranked_ids = {id(r) for r in ranked_order[:10]}
    top_10_chrono_ids = {id(r) for r in chrono_order[:10]}

    arterial_rows = [r for r in rows if r["road_class"] == "arterial"]
    arterial_in_ranked_top10 = sum(1 for r in arterial_rows if id(r) in top_10_ranked_ids)
    arterial_in_chrono_top10 = sum(1 for r in arterial_rows if id(r) in top_10_chrono_ids)

    def rank_position(order: list, row: dict) -> int:
        return next(i for i, r in enumerate(order, start=1) if r is row)

    repeat_rows = [r for r in rows if r["num_reports"] >= 3]
    avg_repeat_pos_ranked = (
        sum(rank_position(ranked_order, r) for r in repeat_rows) / len(repeat_rows) if repeat_rows else None
    )
    avg_repeat_pos_chrono = (
        sum(rank_position(chrono_order, r) for r in repeat_rows) / len(repeat_rows) if repeat_rows else None
    )

    return {
        "n_open_defects": n,
        "n_arterial_open_defects": len(arterial_rows),
        "arterial_defects_in_top10_ranked": arterial_in_ranked_top10,
        "arterial_defects_in_top10_chronological": arterial_in_chrono_top10,
        "n_defects_with_3plus_reports": len(repeat_rows),
        "avg_queue_position_3plus_reports_ranked": avg_repeat_pos_ranked,
        "avg_queue_position_3plus_reports_chronological": avg_repeat_pos_chrono,
    }


def measure_detection_throughput() -> dict:
    images = sorted(SAMPLE_IMAGES_DIR.glob("*.jpg"))
    if not images:
        return {"n_images": 0}
    detect(images[0])  # warm up model load (excluded from timing)
    t0 = time.perf_counter()
    for img in images:
        detect(img)
    elapsed = time.perf_counter() - t0
    return {
        "n_images": len(images),
        "total_seconds": round(elapsed, 3),
        "images_per_second": round(len(images) / elapsed, 2),
        "seconds_per_image": round(elapsed / len(images), 3),
    }


def main() -> None:
    db = SessionLocal()
    try:
        ranking = measure_ranking_impact(db)
    finally:
        db.close()
    throughput = measure_detection_throughput()

    print("=== Measurable impact (computed from the current seeded database) ===")
    print(f"Open defects in queue: {ranking['n_open_defects']}")
    print(
        f"Arterial-road (highest-traffic tier) open defects: {ranking['n_arterial_open_defects']} - "
        f"{ranking['arterial_defects_in_top10_ranked']} appear in the ranker's top 10, vs "
        f"{ranking['arterial_defects_in_top10_chronological']} in a plain chronological (no-AI) queue."
    )
    if ranking["avg_queue_position_3plus_reports_ranked"] is not None:
        print(
            f"Defects with 3+ citizen reports ({ranking['n_defects_with_3plus_reports']}): "
            f"avg. queue position {ranking['avg_queue_position_3plus_reports_ranked']:.1f} under the ranker "
            f"vs {ranking['avg_queue_position_3plus_reports_chronological']:.1f} chronologically "
            f"(lower is surfaced sooner)."
        )
    else:
        print("No open defects with 3+ reports in the current seed to compare.")
    print(
        f"Detection throughput (fine-tuned YOLOv8n, CPU/MPS as available, {throughput['n_images']} sample images): "
        f"{throughput['images_per_second']} images/sec ({throughput['seconds_per_image']}s/image)."
    )
    print()
    print("NOT measured (would require real analyst usage, not simulated here): time saved per triage")
    print("session, false-positive nuisance rate in production, citizen report volume at scale.")


if __name__ == "__main__":
    main()
