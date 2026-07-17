#!/usr/bin/env python3
"""Runs the committed fine-tuned detector over backend/data/sample_images/
and prints, per image, every detection above conf 0.25 (class + confidence).

Purpose: pick a sample image that the current weights reliably detect on,
for the demo recording - rather than guessing or re-recording after a dud.

Usage:
    cd backend && source venv/bin/activate && python3 ../scripts/pick_demo_image.py

(Needs the backend venv active - this imports app.detection.detector, the
same detection code path the FastAPI app uses.)
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.config import SAMPLE_IMAGES_DIR  # noqa: E402
from app.detection.detector import detect, model_status  # noqa: E402

PRINT_CONF_THRESHOLD = 0.25
RECOMMEND_CONF_THRESHOLD = 0.4


def main() -> None:
    status = model_status()
    if status["active_source"] != "roadwatch-finetuned":
        print(
            "WARNING: no fine-tuned weights found - detector is running on "
            "stock pretrained-coco, which produces zero RoadWatch defect "
            "classes (see detector.py:_map_class_name). Run "
            "`python -m app.detection.train` first.\n"
        )

    images = sorted(SAMPLE_IMAGES_DIR.glob("*.jpg"))
    if not images:
        raise SystemExit(f"No sample images found in {SAMPLE_IMAGES_DIR}")

    recommended: list[str] = []
    for img in images:
        detections = sorted(
            detect(img, conf_threshold=PRINT_CONF_THRESHOLD),
            key=lambda d: d.confidence,
            reverse=True,
        )
        print(f"{img.name}:")
        if not detections:
            print(f"  (no detections >= {PRINT_CONF_THRESHOLD} conf)")
        for d in detections:
            print(f"  {d.defect_class:15s} conf={d.confidence:.3f}")
        if any(d.confidence >= RECOMMEND_CONF_THRESHOLD for d in detections):
            recommended.append(img.name)
        print()

    print(f"=== Recommended demo images (>=1 detection >= {RECOMMEND_CONF_THRESHOLD} conf) ===")
    if recommended:
        for name in recommended:
            print(f"  {name}")
    else:
        print(f"  (none - no sample image currently clears the {RECOMMEND_CONF_THRESHOLD} confidence bar)")


if __name__ == "__main__":
    main()
