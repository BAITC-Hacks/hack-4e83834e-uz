# Model card — RoadWatch detection & priority ranking

This document describes both learned models in the pipeline: the YOLOv8
defect detector and the logistic-regression priority ranker. It is written
to be read alongside the code — every number here was produced by actually
running the training/eval scripts in this repo, not estimated.

## 1. Defect detector (YOLOv8n, fine-tuned)

### What it is

`backend/app/detection/detector.py` loads `backend/data/weights/roadwatch_ft.pt`
if present, otherwise falls back to stock pretrained YOLOv8n (COCO weights,
which has no road-defect classes — see "Fallback behavior" below).

### Training data — be honest about this

No open road-damage dataset (RDD2022, Kaggle pothole sets, Roboflow
Universe) was reachable from this environment without an account/API key
(Kaggle requires `kaggle.json` credentials, Roboflow programmatic export
requires an API key, RDD2022 is a multi-GB download not practical mid-build).
Rather than fabricate detection quality or fake a dataset, we used a small,
individually-downloaded, hand-labeled set:

- **13 source images** of real potholes and cracks, downloaded individually
  from Wikimedia Commons under permissive licenses (CC0 / CC BY / CC BY-SA /
  Public Domain) — see `backend/data/sample_images/SOURCES.md` for the exact
  file, license, and attribution of each image.
- **15 bounding boxes**, drawn by hand via visual inspection of each image
  (no auto-labeling tool) — see `backend/data/detect_dataset/ANNOTATIONS.md`
  for the exact pixel coordinates of every box and which split (train/val)
  it's in.
- Only **2 of the 4** taxonomy classes are represented: `pothole` (5 images)
  and `crack` (8 images). **`broken_curb` and `faded_marking` have zero
  training images** — the fine-tuned model cannot currently detect them at
  all. Any `broken_curb`/`faded_marking` defects you see in the demo
  dashboard come from the seed script's synthetic data generator
  (`model_source: "seed-synthetic"`), not real detection.
- Split: 9 images (11 boxes) train / 4 images (4 boxes) val.

This is enough to prove the pipeline is genuinely end-to-end — a real
image goes in, real YOLOv8 inference comes out — but it is **not** enough
data to produce a production-accurate detector. Treat all detection output
as illustrative.

### Training run

```
cd backend && source venv/bin/activate && python -m app.detection.train
```

60 epochs, YOLOv8n base, imgsz=640, batch=4, light augmentation
(rotation/translate/scale/flip/mosaic) to partially compensate for the tiny
dataset. Full config is in `app/detection/train.py`.

### Measured results (honest, small-sample numbers)

On the **4-image validation holdout** (this is the entire holdout — these
numbers have enormous variance and should not be read as "the model is
X% accurate" in any general sense):

| Metric | Value |
|---|---|
| mAP50 (all classes) | 0.382 |
| mAP50-95 (all classes) | 0.230 |
| Precision | 0.287 |
| Recall | 0.500 |

Per class:

| Class | mAP50 | mAP50-95 | Precision | Recall |
|---|---|---|---|---|
| pothole | 0.247 | 0.111 | 0.298 | 0.500 |
| crack | 0.517 | 0.349 | 0.277 | 0.500 |

At inference time (`conf_threshold=0.25`, the default in `detector.py`),
running the fine-tuned model against the full 13-image sample set during
seeding, **9 of 13 images produced at least one detection above threshold**
— i.e. roughly a third of even our own hand-picked, unambiguous example
photos were missed at this confidence threshold. That is the real,
current false-negative behavior of this model, not a hypothetical caveat.

### Known limitations (explicit, per project constraints)

- **Dataset size**: 13 images total is far below what's needed for a
  reliable detector. Precision/recall numbers above are not statistically
  meaningful beyond "this pipeline runs and learns something" — a 4-image
  validation set means a single wrong/right prediction swings the metric by
  25 points.
- **Class coverage**: `broken_curb` and `faded_marking` are undetectable by
  the current fine-tuned model (0 training examples).
- **Lighting/angle sensitivity**: all training images are daylight,
  ground-level or slightly elevated phone/camera angles. Night, rain,
  glare, or windshield-mounted dashcam angles are untested and likely to
  perform worse.
- **Geographic bias**: source photos are from varied real-world locations
  (per SOURCES.md) but were not selected for Almaty-specific road/asphalt
  characteristics - the demo's Almaty geography is illustrative seed data,
  not evidence the detector was validated on Almaty roads.
- **False positives**: not separately measured beyond the precision figures
  above (precision ~0.29 already indicates a high false-positive rate at
  this confidence threshold, given the small training set).

### Fallback behavior

If `roadwatch_ft.pt` doesn't exist (e.g. a fresh clone before running
`train.py`), `detector.py` loads stock pretrained YOLOv8n (COCO classes:
person, car, dog, etc). Since none of those map to a RoadWatch defect
class, `detector.py` deliberately returns **zero detections** rather than
fabricate a mapping — see `_map_class_name()`. The API surfaces this via
`GET /health`-adjacent `model_source` fields and `detection/detector.py:model_status()`.

### What a production version would need

- RDD2022 (India/Japan/Czech road damage, ~26k labeled images across the 4
  target-adjacent classes) or an equivalent licensed dataset, fine-tuned for
  many more epochs with a proper train/val/test split.
- Explicit `broken_curb` and `faded_marking` labeled examples - neither
  exists in RDD2022's default taxonomy, so a custom or supplemented dataset
  would be needed.
- A held-out test set large enough to report precision/recall with
  meaningful confidence intervals, plus stratified analysis by
  lighting/weather/camera angle.
- A false-positive audit against a "normal road, no defect" negative set to
  quantify nuisance-detection rate before any real deployment.

## 2. Priority ranker (scikit-learn LogisticRegression)

### What it is

`backend/app/scoring/ranker_model.py` loads
`backend/data/ranker.joblib`, produced by
`backend/app/scoring/train_ranker.py`. It predicts P(an analyst would
prioritize this defect) from the 3-factor feature vector `[severity,
traffic, repeat_reports]` (each already normalized to 0-1 - see
`scoring/features.py`).

### Why a learned model instead of only the weighted formula

The project brief explicitly asks for a genuine learned model, not an
if/else rule. `scoring/weighted_model.py` (severity 45% / traffic 35% /
repeat-reports 20%, hand-set weights) is kept as a transparent, always-
available baseline and fallback, but the queue is ranked by the
logistic-regression ranker.

### Training data — also synthetic, also documented

We do not have a real historical log of analyst approve/reject decisions
(greenfield prototype). `train_ranker.py` generates a synthetic labeled set:

1. Sample 400 feature vectors `(severity, traffic, repeat_reports)`
   uniformly over `[0,1]^3`.
2. Compute a "latent prioritization tendency" using the *same* 45/35/20
   prior as the weighted baseline, so the two scorers are directly
   comparable, then add Gaussian noise (`σ=0.12`) to simulate realistic
   human inconsistency between analysts/days.
3. Threshold the noisy latent value at its median to produce a
   roughly-balanced binary label.

This means the model has to recover the underlying severity > traffic >
repeat-reports pattern *through noise*, rather than memorizing a
deterministic formula - the actual point of using a learned model here.

### Measured results (25% held-out synthetic test set, n=100)

| Metric | Value |
|---|---|
| Accuracy | 0.780 |
| Precision | 0.804 |
| Recall | 0.740 |
| ROC AUC | 0.869 |

Learned coefficients (on standardized features) recovered the intended
ordering:

| Feature | Coefficient |
|---|---|
| severity | 1.320 |
| traffic | 1.066 |
| repeat_reports | 0.679 |

### Explainability

Each ranked defect's factor breakdown (the "severity 45%, traffic 35%,
repeat-reports 20%"-style display in the dashboard) is computed directly
from `coefficient_i × standardized_feature_i` for this specific defect,
normalized to percentages - it is a faithful read of the fitted linear
model's actual decision for that item, not a separately-invented
explanation.

### What a production version would need

A real dataset of analyst decisions (approve/reject/defer, with reviewer
identity and timestamp - which this prototype already logs via
`ApprovalLog`) collected over weeks/months of actual use, retrained
periodically. The synthetic-label approach here is a placeholder that
demonstrates the mechanism, not a claim about real analyst behavior.
