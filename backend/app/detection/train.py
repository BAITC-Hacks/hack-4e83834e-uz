"""Fine-tune YOLOv8n on the tiny RoadWatch sample set.

This is intentionally a small, fast fine-tune (13 images, 15 boxes, 2 of the
4 defect classes) meant to prove the detection pipeline is genuinely
end-to-end - not to produce a production-accurate model. Run it with:

    cd backend && source venv/bin/activate && python -m app.detection.train

Writes the resulting weights to data/weights/roadwatch_ft.pt and prints the
validation metrics that get reported (honestly) in /model/README.md.
"""
from __future__ import annotations

from pathlib import Path

from ultralytics import YOLO

from app.config import WEIGHTS_DIR, FINE_TUNED_WEIGHTS, PRETRAINED_WEIGHTS

DATASET_YAML = Path(__file__).resolve().parent / "dataset.yaml"


def main() -> None:
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(PRETRAINED_WEIGHTS))
    results = model.train(
        data=str(DATASET_YAML),
        epochs=60,
        imgsz=640,
        batch=4,
        patience=60,
        project=str(WEIGHTS_DIR / "runs"),
        name="roadwatch_ft",
        exist_ok=True,
        verbose=True,
        # Tiny dataset -> lean on augmentation instead of more data.
        degrees=5.0,
        translate=0.1,
        scale=0.3,
        fliplr=0.5,
        mosaic=0.5,
    )
    best = Path(results.save_dir) / "weights" / "best.pt"
    FINE_TUNED_WEIGHTS.write_bytes(best.read_bytes())
    print(f"Saved fine-tuned weights to {FINE_TUNED_WEIGHTS}")

    metrics = model.val(data=str(DATASET_YAML))
    print("Validation metrics (tiny 4-image holdout - see /model/README.md for caveats):")
    print(f"  mAP50:    {metrics.box.map50:.3f}")
    print(f"  mAP50-95: {metrics.box.map:.3f}")
    print(f"  precision: {metrics.box.mp:.3f}")
    print(f"  recall:    {metrics.box.mr:.3f}")


if __name__ == "__main__":
    main()
