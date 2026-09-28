from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"
WEIGHTS_DIR = DATA_DIR / "weights"
SAMPLE_IMAGES_DIR = DATA_DIR / "sample_images"
UPLOADS_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "roadwatch.db"
DATABASE_URL = f"sqlite:///{DB_PATH}"

FINE_TUNED_WEIGHTS = WEIGHTS_DIR / "roadwatch_ft.pt"
PRETRAINED_WEIGHTS = WEIGHTS_DIR / "yolov8n.pt"

RANKER_MODEL_PATH = DATA_DIR / "ranker.joblib"

ADMIN_EMAILS = [
    "admin@roadwatch.kz",
    "analyst@roadwatch.kz",
    "someone@example.com",
]

DEFECT_CLASSES = ["pothole", "crack", "broken_curb", "faded_marking", "manhole"]

NON_DEFECT_CLASSES = ["shadow", "trash", "animal"]

TRAINED_DEFECT_CLASSES = ["pothole", "crack", "manhole"]


DEFECT_CLASS_SEVERITY_WEIGHT = {
    "pothole": 1.0,
    "manhole": 1.0,
    "broken_curb": 0.8,
    "crack": 0.6,
    "faded_marking": 0.3,
}

WEIGHTED_SCORE_WEIGHTS = {
    "severity": 0.45,
    "traffic": 0.35,
    "repeat_reports": 0.20,
}

REPEAT_REPORT_HALF_LIFE_DAYS = 10.0

REPEAT_REPORT_RADIUS_METERS = 40.0

SEVERITY_CONFIDENCE_WEIGHT = 0.5
SEVERITY_AREA_WEIGHT = 0.5
SEVERITY_AREA_REFERENCE_PCT = 15.0
