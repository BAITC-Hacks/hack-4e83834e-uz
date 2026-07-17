"""Central configuration: paths and the inspectable weighting constants used by scoring.

Every number in here is deliberately a module-level constant (not buried in a
function) so an analyst or code reviewer can find and audit the exact weighting
logic without digging through the codebase.
"""
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
WEIGHTS_DIR = DATA_DIR / "weights"
SAMPLE_IMAGES_DIR = DATA_DIR / "sample_images"
UPLOADS_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "roadwatch.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Fine-tuned weights are preferred; fall back to stock pretrained YOLOv8n
# (COCO classes) if fine-tuning hasn't been run yet in this environment.
FINE_TUNED_WEIGHTS = WEIGHTS_DIR / "roadwatch_ft.pt"
PRETRAINED_WEIGHTS = WEIGHTS_DIR / "yolov8n.pt"

RANKER_MODEL_PATH = DATA_DIR / "ranker.joblib"

DEFECT_CLASSES = ["pothole", "crack", "broken_curb", "faded_marking"]

# Trained classes the detector can output but that are deliberately NOT
# defects (see /model/README.md's Arcioni et al. dataset section). Manhole
# covers exist in that dataset's own taxonomy specifically so the detector
# learns to tell them apart from potholes instead of false-positiving on
# them - detector.py recognizes and discards manhole detections rather than
# ever turning one into a Defect row.
NON_DEFECT_CLASSES = ["manhole"]

# Classes with real training images today (see /model/README.md - both the
# hand-labeled set and the RDD2022 import only cover pothole/crack).
# broken_curb and faded_marking stay in DEFECT_CLASSES above (matching the
# model's fixed 4-class output head, so a future retrain with real data for
# them doesn't require renumbering), but the seed generator and the
# frontend's filter options only use TRAINED_DEFECT_CLASSES - so the demo
# never shows a class the detector cannot currently detect. Treat the other
# two as "planned," not "supported."
TRAINED_DEFECT_CLASSES = ["pothole", "crack"]

# Relative severity weight per defect class, used as a multiplier on the
# severity sub-score. Rationale: a pothole is a safety/vehicle-damage hazard
# and should dominate a faded lane marking, which is a lower-urgency cosmetic
# issue. These are hand-set hackathon defaults, not learned - documented here
# so they are easy to challenge/tune.
DEFECT_CLASS_SEVERITY_WEIGHT = {
    "pothole": 1.0,
    "broken_curb": 0.8,
    "crack": 0.6,
    "faded_marking": 0.3,
}

# Baseline transparent weighted-sum score (used for comparison/explainability
# alongside the learned ranker - see scoring/weighted_model.py).
WEIGHTED_SCORE_WEIGHTS = {
    "severity": 0.45,
    "traffic": 0.35,
    "repeat_reports": 0.20,
}

# Time-decay half-life (in days) for repeat-report clustering: a report from
# `REPEAT_REPORT_HALF_LIFE_DAYS` ago counts for half as much as one filed today.
REPEAT_REPORT_HALF_LIFE_DAYS = 10.0

# Radius (meters) within which two reports are considered "the same location"
# for repeat-report clustering purposes.
REPEAT_REPORT_RADIUS_METERS = 40.0

# Severity sub-score = (SEVERITY_CONFIDENCE_WEIGHT * detection_confidence
#                        + SEVERITY_AREA_WEIGHT * min(1, area_pct / SEVERITY_AREA_REFERENCE_PCT))
#                       * DEFECT_CLASS_SEVERITY_WEIGHT[class]
# i.e. detection confidence and physical size contribute equally to the
# "how bad does this look" sub-score, then the whole thing is scaled down
# for less-urgent defect classes (e.g. faded markings).
SEVERITY_CONFIDENCE_WEIGHT = 0.5
SEVERITY_AREA_WEIGHT = 0.5
SEVERITY_AREA_REFERENCE_PCT = 15.0  # bbox area at/above which area-severity saturates to 1.0
