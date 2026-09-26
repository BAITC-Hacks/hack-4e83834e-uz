from __future__ import annotations

import tempfile
from pathlib import Path

import torch
import yaml
from ultralytics import YOLO

from app.config import WEIGHTS_DIR, FINE_TUNED_WEIGHTS, PRETRAINED_WEIGHTS

DATASET_YAML = Path(__file__).resolve().parent / "dataset.yaml"
DATASET_ROOT = DATASET_YAML.parent.parent.parent / "data" / "detect_dataset"


def _resolved_dataset_yaml() -> Path:
    """dataset.yaml omits `path:` (a committed absolute path isn't portable
    across machines/checkouts) - fill it in here from this repo's actual
    location and write the result to a temp file for YOLO to load."""
    spec = yaml.safe_load(DATASET_YAML.read_text())
    spec["path"] = str(DATASET_ROOT)
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False)
    yaml.safe_dump(spec, tmp)
    tmp.close()
    return Path(tmp.name)


def _best_device() -> str:
    """Prefer CUDA, then Apple Silicon MPS, else CPU - training still runs
    fine on CPU alone (just slower), so this never blocks a CPU-only judge
    environment - see the project's "keep everything runnable on CPU"
    constraint."""
    if torch.cuda.is_available():
        return "0"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def main() -> None:
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(PRETRAINED_WEIGHTS))
    dataset_yaml = _resolved_dataset_yaml()
    n_train_images = len(list((DATASET_ROOT / "images" / "train").glob("*.jpg")))
    # Larger dataset (RDD2022 merged in) -> bigger batch + early stopping;
    # tiny hand-labeled-only dataset -> the original small-batch, no-early-
    # stop settings that suit 9 training images.
    large_dataset = n_train_images > 50
    results = model.train(
        data=str(dataset_yaml),
        epochs=50 if large_dataset else 60,
        imgsz=640,
        batch=16 if large_dataset else 4,
        patience=15 if large_dataset else 60,
        device=_best_device(),
        project=str(WEIGHTS_DIR / "runs"),
        name="roadwatch_ft",
        exist_ok=True,
        verbose=True,
        # Lean on augmentation to partially compensate for a still-small
        # dataset either way.
        degrees=5.0,
        translate=0.1,
        scale=0.3,
        fliplr=0.5,
        mosaic=0.5,
    )
    best = Path(results.save_dir) / "weights" / "best.pt"
    FINE_TUNED_WEIGHTS.write_bytes(best.read_bytes())
    print(f"Saved fine-tuned weights to {FINE_TUNED_WEIGHTS}")

    metrics = model.val(data=str(dataset_yaml))
    print("Validation metrics (tiny 4-image holdout - see /model/README.md for caveats):")
    print(f"  mAP50:    {metrics.box.map50:.3f}")
    print(f"  mAP50-95: {metrics.box.map:.3f}")
    print(f"  precision: {metrics.box.mp:.3f}")
    print(f"  recall:    {metrics.box.mr:.3f}")


if __name__ == "__main__":
    main()
