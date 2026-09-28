"""Lightweight detection-preview endpoint for citizen submissions.

Returns the annotated image (with bounding boxes drawn by ultralytics) and a
JSON list of detections. This is a *read-only* preview — no database records
are created. The citizen sees what the AI found and can confirm/edit defect
tags before the actual submit.
"""
from __future__ import annotations

import io
import shutil
import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, File, UploadFile
from fastapi.responses import JSONResponse

from app.config import UPLOADS_DIR
from app.detection.detector import _load_model, _map_class_name

router = APIRouter(prefix="/detect", tags=["detect"])


@router.post("/preview")
async def detection_preview(file: UploadFile = File(...)):
    """Run YOLO on an uploaded image and return detections + annotated image.

    Response JSON:
        {
          "detections": [
            {"defect_class": "pothole", "confidence": 0.82,
             "bbox": [x1, y1, x2, y2], "area_pct": 3.1}
          ],
          "annotated_image_url": "/media/<name>_annotated.jpg"
        }

    The annotated image is saved to UPLOADS_DIR so the frontend can display it
    via the normal /media static mount. Non-defect and unrecognised classes are
    filtered out — same logic as detector.detect().
    """
    # Save incoming file to a temp path
    ext = Path(file.filename or "upload.jpg").suffix or ".jpg"
    stem = uuid.uuid4().hex
    raw_name = f"{stem}{ext}"
    raw_path = UPLOADS_DIR / raw_name

    with raw_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    model, source = _load_model()
    results = model.predict(source=str(raw_path), conf=0.25, verbose=False)

    detections = []
    if results:
        result = results[0]
        frame_h, frame_w = result.orig_shape
        frame_area = float(frame_h * frame_w)
        names = result.names

        for box in result.boxes:
            cls_idx = int(box.cls.item())
            raw_cls = names.get(cls_idx, str(cls_idx)) if isinstance(names, dict) else str(cls_idx)
            defect_class = _map_class_name(raw_cls, source)
            if defect_class is None:
                continue
            x1, y1, x2, y2 = [float(v) for v in box.xyxy[0].tolist()]
            area_pct = 100.0 * max(0.0, (x2 - x1) * (y2 - y1)) / frame_area
            detections.append({
                "defect_class": defect_class,
                "confidence": round(float(box.conf.item()), 3),
                "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                "area_pct": round(area_pct, 3),
            })

    # Draw annotated image with bounding boxes
    annotated_name = f"{stem}_annotated.jpg"
    annotated_path = UPLOADS_DIR / annotated_name
    _draw_annotated(raw_path, detections, annotated_path)

    return JSONResponse({
        "detections": detections,
        "annotated_image_url": f"/media/{annotated_name}",
    })


# Class label colors for bounding boxes
_CLASS_COLORS = {
    "pothole": (66, 133, 244),      # blue
    "crack": (219, 68, 55),          # red
    "broken_curb": (244, 180, 0),    # amber
    "faded_marking": (15, 157, 88),  # green
    "manhole": (171, 71, 188),       # purple
}


def _draw_annotated(image_path: Path, detections: list[dict], output_path: Path):
    """Draw bounding boxes and labels on the image using OpenCV."""
    img = cv2.imread(str(image_path))
    if img is None:
        return

    for det in detections:
        x1, y1, x2, y2 = [int(v) for v in det["bbox"]]
        cls = det["defect_class"]
        conf = det["confidence"]
        color = _CLASS_COLORS.get(cls, (200, 200, 200))

        # Draw box
        cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)

        # Draw label background + text
        label = f'{cls} {conf:.0%}'
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        cv2.rectangle(img, (x1, y1 - th - 8), (x1 + tw + 6, y1), color, -1)
        cv2.putText(img, label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

    cv2.imwrite(str(output_path), img, [cv2.IMWRITE_JPEG_QUALITY, 90])
