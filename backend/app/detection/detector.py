"""YOLOv8 detection wrapper.

Loads the RoadWatch fine-tuned weights if present (see `detection/train.py`),
otherwise falls back to stock pretrained YOLOv8n (COCO classes) so the
pipeline still runs end-to-end even in an environment where fine-tuning
hasn't been performed. When running on the COCO fallback, `Detection.model`
is reported as "pretrained-coco" so callers/UI can flag that class labels
are not meaningful road-defect predictions.

See /model/README.md for honest accuracy numbers and limitations of the
fine-tuned model - it was trained on a handful of hand-labeled images for
pipeline demonstration purposes, not production accuracy.
"""
from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import List

from ultralytics import YOLO

from app.config import DEFECT_CLASSES, FINE_TUNED_WEIGHTS, NON_DEFECT_CLASSES, PRETRAINED_WEIGHTS

logger = logging.getLogger(__name__)


@dataclass
class Detection:
    defect_class: str
    confidence: float
    bbox: tuple[float, float, float, float]  # x1, y1, x2, y2 in pixels
    area_pct: float  # bbox area as a percentage of the full frame
    model: str  # "roadwatch-finetuned" or "pretrained-coco"


_lock = threading.Lock()
_model: YOLO | None = None
_model_source: str | None = None


def _load_model() -> tuple[YOLO, str]:
    global _model, _model_source
    with _lock:
        if _model is not None:
            return _model, _model_source
        if FINE_TUNED_WEIGHTS.exists():
            _model = YOLO(str(FINE_TUNED_WEIGHTS))
            _model_source = "roadwatch-finetuned"
        else:
            # ultralytics auto-downloads yolov8n.pt from its release assets
            # the first time this runs, and caches it under PRETRAINED_WEIGHTS'
            # parent directory.
            PRETRAINED_WEIGHTS.parent.mkdir(parents=True, exist_ok=True)
            _model = YOLO(str(PRETRAINED_WEIGHTS))
            _model_source = "pretrained-coco"
        return _model, _model_source


def detect(image_path: str | Path, conf_threshold: float = 0.25) -> List[Detection]:
    """Run inference on a single image and return normalized Detection objects."""
    model, source = _load_model()
    results = model.predict(source=str(image_path), conf=conf_threshold, verbose=False)
    if not results:
        return []
    result = results[0]
    frame_h, frame_w = result.orig_shape
    frame_area = float(frame_h * frame_w)

    names = result.names
    detections: List[Detection] = []
    for box in result.boxes:
        cls_idx = int(box.cls.item())
        raw_name = names.get(cls_idx, str(cls_idx)) if isinstance(names, dict) else str(cls_idx)
        defect_class = _map_class_name(raw_name, source)
        if defect_class is None:
            continue
        x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
        area_pct = 100.0 * max(0.0, (x2 - x1) * (y2 - y1)) / frame_area
        detections.append(
            Detection(
                defect_class=defect_class,
                confidence=float(box.conf.item()),
                bbox=(x1, y1, x2, y2),
                area_pct=round(area_pct, 3),
                model=source,
            )
        )
    return detections


def _map_class_name(raw_name: str, source: str) -> str | None:
    """Map a raw model class name onto RoadWatch's 4 defect classes.

    When running the fine-tuned model, class names already match
    DEFECT_CLASSES 1:1 (see dataset.yaml). When falling back to the
    pretrained COCO model (no road-defect classes exist), we can't produce
    a genuine defect classification - so we deliberately return None and
    let the caller treat that frame as "no defects detected" rather than
    fabricate a mapping from unrelated COCO classes (car, person, etc).

    `manhole` is a real trained class (see /model/README.md's Arcioni et al.
    dataset section) but is deliberately NOT a defect - it exists in the
    training data specifically to teach the model to tell manholes apart
    from potholes, not to be surfaced to analysts. Recognize it explicitly
    (log it) and discard it, rather than let it fall through indistinguishably
    from a genuinely unrecognized class name.
    """
    if source == "roadwatch-finetuned":
        if raw_name in NON_DEFECT_CLASSES:
            logger.info("Discarding non-defect detection: class=%s", raw_name)
            return None
        return raw_name if raw_name in DEFECT_CLASSES else None
    return None


def model_status() -> dict:
    """Report which weights are currently active, for the UI/API to surface."""
    return {
        "fine_tuned_available": FINE_TUNED_WEIGHTS.exists(),
        "active_source": "roadwatch-finetuned" if FINE_TUNED_WEIGHTS.exists() else "pretrained-coco",
    }
