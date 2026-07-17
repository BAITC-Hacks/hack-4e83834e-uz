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

**Update:** the original build of this project stated RDD2022 wasn't
reachable without credentials. That was wrong - only the GitHub Releases
API for that repo happened to be empty; the dataset itself is downloadable
directly and publicly from the official CRDDC2022 S3 bucket, no account
needed (see `scripts/fetch_rdd2022.sh`). The detector below is now
retrained on real data as a result. Two sources are merged into
`backend/data/detect_dataset/`:

- **13 hand-labeled images** of real potholes and cracks, downloaded
  individually from Wikimedia Commons under permissive licenses (CC0 / CC
  BY / CC BY-SA / Public Domain) — see
  `backend/data/sample_images/SOURCES.md` for exact file/license/attribution,
  and `backend/data/detect_dataset/ANNOTATIONS.md` for the hand-drawn box
  coordinates (15 boxes: 5 images pothole / 8 images crack).
- **A 1,000-image sample of RDD2022** (CRDDC'2022, Czech Republic subset,
  CC BY-SA 4.0) — 900 train / 100 val, downloaded and converted via
  `scripts/fetch_rdd2022.sh` + `scripts/convert_rdd2022.py`. RDD2022 damage
  codes D00/D01/D10/D11/D20/D21 (longitudinal/transverse/alligator
  cracking) map to `crack`; D40 (pothole/rutting/bump) maps to `pothole`.
  This produced 1,449 `crack` boxes and 185 `pothole` boxes — crack is
  heavily overrepresented in the Czech subset itself, which shows up in the
  per-class results below.
- **Final merged dataset: 909 train images / 104 val images**, still only
  **2 of the 4** taxonomy classes (`pothole`, `crack`).
  **`broken_curb` and `faded_marking` still have zero training images** —
  RDD2022 has no equivalent classes for either. The detector cannot detect
  them; the seed generator and frontend filters no longer offer them as if
  they were live (see `/README.md`'s taxonomy-honesty note) — any
  `broken_curb`/`faded_marking` defect on an unreseeded old database would
  be pre-existing synthetic data, never labeled as real detection.
- The RDD2022-derived images/labels are reproducible (deterministic,
  seed=7) but **not committed** to this repo, to keep repository size
  reasonable — the 13 hand-labeled images stay committed as before. The
  resulting trained weights (`backend/data/weights/roadwatch_ft.pt`) **are**
  committed — see "Out-of-the-box demo" in `/README.md`.

### Training run

```
cd backend && source venv/bin/activate && python -m app.detection.train
```

`train.py` scales its settings to dataset size: batch=16 / patience=15
early stopping / up to 50 epochs for a merged dataset like this one (vs.
batch=4 / no early stopping / 60 epochs for the original tiny
hand-labeled-only set), and uses Apple Silicon MPS or CUDA if available,
falling back to CPU otherwise (`_best_device()` in `app/detection/train.py`
— training still runs on CPU alone, just slower). Light augmentation
(rotation/translate/scale/flip/mosaic) is unchanged. This run early-stopped
at epoch 48 (best weights from epoch 33, patience=15).

### Measured results (104-image validation set — a real holdout, not a 4-image one)

| Metric | Value |
|---|---|
| mAP50 (all classes) | 0.253 |
| mAP50-95 (all classes) | 0.102 |
| Precision | 0.289 |
| Recall | 0.296 |

Per class:

| Class | Images | Instances | mAP50 | mAP50-95 | Precision | Recall |
|---|---|---|---|---|---|---|
| pothole | 15 | 17 | 0.089 | 0.043 | 0.104 | 0.118 |
| crack | 100 | 154 | 0.418 | 0.160 | 0.475 | 0.474 |

**These numbers are lower than the previous 4-image-holdout numbers
(mAP50 0.382) — that is expected, and is itself the honest result, not a
regression to hide.** The old numbers came from a 4-image validation set,
where a single right/wrong prediction swings the metric by 25 points -
essentially noise dressed up as a percentage. These numbers come from 104
held-out images the model never trained on, so they're a real (if still
modest) measurement. `crack` (154 val instances, 1,449 train boxes)
performs reasonably; `pothole` (17 val instances, only 185 train boxes -
about an eighth of the crack boxes, since the Czech RDD2022 subset itself
is crack-heavy) is measurably weaker. That class imbalance, not a training
bug, is the main driver of the gap between the two per-class rows above.

Detection throughput on the sample images is now measured by
`backend/app/scoring/measure_impact.py` — see "Measurable impact" in
`/README.md` for the current run's numbers, so this stays live rather than
drifting stale.

### Known limitations (explicit, per project constraints)

- **Class imbalance**: `pothole` has ~8x fewer training boxes than `crack`
  in this dataset (both from RDD2022's own class distribution and the
  original hand-labeled set), and it measurably underperforms as a result -
  see the per-class table above. A follow-up should either oversample
  pothole examples or pull from a second country's RDD2022 subset with a
  different class balance.
- **Class coverage**: `broken_curb` and `faded_marking` are undetectable by
  the current fine-tuned model (0 training examples, no clean RDD2022
  equivalent for either).
- **Lighting/angle sensitivity**: RDD2022's Czech images are dashcam-style
  road-surface photos; the original 13 hand-labeled images are varied
  phone/camera angles. Night, rain, and glare conditions are still
  untested.
- **Geographic bias**: training images are from the Czech Republic
  (RDD2022) and varied real-world Wikimedia Commons locations - none from
  Kazakhstan/Almaty specifically. The demo's Almaty geography is
  illustrative seed data, not evidence the detector was validated on
  Almaty roads or asphalt types.
- **False positives**: precision ~0.29 overall (0.10 for pothole, 0.48 for
  crack) directly quantifies the false-positive rate at the default 0.25
  confidence threshold - still well below production-grade, honestly
  reported rather than rounded up.

### Second dataset (Arcioni et al.) — planned to fix the pothole imbalance, not yet merged

The pothole class imbalance above (185 train boxes, mAP50 0.089) has an
identified fix: **"Road Damage Dataset: Potholes, Cracks and Manholes"**
(Giordani, Arcioni, Gil-Martín, Marini — Sapienza University of Rome /
Universidad Politécnica de Madrid — *Scientific Reports*, 2026; Zenodo DOI
[10.5281/zenodo.17834373](https://doi.org/10.5281/zenodo.17834373); Kaggle
mirror `lorenzoarcioni/road-damage-dataset-potholes-cracks-and-manholes`).
2,009 images (640×360, GoPro HERO7 + Samsung Galaxy A14, Rome/Sacrofano,
Italy), YOLO-format labels, 1,261 pothole boxes / 2,519 crack boxes / 957
manhole boxes. **License: CC BY 4.0** (per the Zenodo record's own
metadata — verify at the DOI link above before relying on this, license
terms on hosted datasets can change between versions). **Required
citation**: Giordani, E., Arcioni, L., Gil-Martín, M., Marini, M.R. (2026).
Road Damage Dataset: Potholes, Cracks and Manholes. *Scientific Reports*.

**Why it's the right fix**: it adds ~1,261 real pothole boxes (~7x this
project's current 185), directly targeting the weakest class, and its
`manhole` class exists specifically so a detector learns to distinguish
manhole covers from potholes instead of false-positiving on them — see
`app/config.py`'s `NON_DEFECT_CLASSES` and `detector.py`'s
`_map_class_name()`, which already recognize and discard `manhole`
detections (a trained class, never a `Defect` row) — tested in
`backend/tests/test_detector.py`.

**Status: fetch/convert scripts written and tested, dataset not yet
downloaded, model not yet retrained on it.** `scripts/fetch_arcioni.sh`
(kagglehub primary path, direct-Zenodo fallback) and
`scripts/convert_arcioni.py` (YOLO-polygon-to-bbox conversion, class
mapping, deterministic seed=7 90/10 split, merged per-class summary) are
both committed and were validated against real data — the archive's exact
on-disk annotation format was confirmed by fetching its central directory
and a handful of individual label files via HTTP Range requests directly
against the real Zenodo-hosted zip (not assumed from the paper's prose;
see `convert_arcioni.py`'s module docstring), and `convert_arcioni.py`'s
conversion logic is regression-tested against those real label lines in
`backend/tests/test_convert_arcioni.py`. The full ~193MB archive itself
could not be downloaded in this environment (transfers were cut off
partway by the sandbox's network, repeatedly, well short of completion) —
so the actual merge into `backend/data/detect_dataset/` and a retrain on
the combined set have **not** run yet. `dataset.yaml` already declares the
new `manhole` class (index 4) so this is a drop-in next step once the
archive can be fetched: `./scripts/fetch_arcioni.sh && python3
scripts/convert_arcioni.py --raw-dir <out_dir>/extracted && python -m
app.detection.train`. The currently committed `roadwatch_ft.pt` and the
measured results table above are **unchanged** — no retrain was performed
for this update, per this project's constraint that adding a dataset must
never block the demo on an incomplete training run.

Once merged, expect **no improvement to the geographic-bias limitation**:
Rome/Sacrofano, Italy is a third distinct region alongside Czech Republic
(RDD2022) and varied worldwide Wikimedia Commons locations — none of the
three are Kazakhstan/Almaty, so this remains an open caveat even after the
merge, not one it resolves.

### Fallback behavior

If `roadwatch_ft.pt` doesn't exist (e.g. a fresh clone before running
`train.py`), `detector.py` loads stock pretrained YOLOv8n (COCO classes:
person, car, dog, etc). Since none of those map to a RoadWatch defect
class, `detector.py` deliberately returns **zero detections** rather than
fabricate a mapping — see `_map_class_name()`. The API surfaces this via
`GET /health`-adjacent `model_source` fields and `detection/detector.py:model_status()`.

### What a production version would need

- More of RDD2022 (this build uses 1,000 of ~26k available labeled images
  across all six countries, Czech subset only) - scaling up to the full
  release, balanced across classes and countries, with a proper
  train/val/test split (this build's val set is still random-sampled from
  the same distribution as train, not held out by e.g. country or capture
  session).
- Explicit `broken_curb` and `faded_marking` labeled examples - neither
  exists in RDD2022's taxonomy at all, so a custom or supplemented dataset
  would be needed to ever detect them.
- A fix for the `pothole` class imbalance (see "Known limitations" above) -
  either oversampling, pulling pothole-heavy examples from another RDD2022
  country subset (India's is pothole-heavier per the dataset paper), or
  completing the Arcioni et al. merge described above (scripts ready,
  archive not yet downloaded in this environment).
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

### This is designed to be retrained on real decisions, not just synthetic ones

Every human decision made through `POST /defects/{id}/review` is already
written to the `ApprovalLog` table (`action`, `reviewer_name`,
`decided_at` - see `/README.md`'s "Human-in-the-loop workflow"). That is
real, structurally-guaranteed training data the moment it exists, and
`train_ranker.py --from-approvals` retrains directly on it:

```
cd backend && source venv/bin/activate && python -m app.scoring.train_ranker --from-approvals
```

Each `ApprovalLog` row becomes one training example: the defect's feature
vector *as it would have looked at decision time* (repeat-report ages are
computed relative to `decided_at`, not "now"), labeled `1` for `approve`
and `0` for `reject`/`defer`. If fewer than `MIN_REAL_SAMPLES` (30) such
rows exist yet, the command prints an explicit warning and falls back to
the synthetic generator below - the fallback is never silent, and the
saved model records which happened in `trained_on`
(`real-approvals` / `synthetic` / `synthetic-fallback`, see
`ranker.joblib`'s metadata). A freshly-seeded demo (`python -m app.seed`)
only creates 8 pre-reviewed defects, well under that floor, so today's
committed `ranker.joblib` is trained on the synthetic set below - but the
retraining path onto real analyst decisions is implemented and tested
(`backend/tests/test_ranker_training.py`), not just described as a "next
step."

### Training data (current default) — synthetic, fully documented

Until enough real `ApprovalLog` rows accumulate, `train_ranker.py`
generates a synthetic labeled set instead:

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
We're explicit that this synthetic prior shares its weighting with the
transparent baseline (that's what makes the two scorers comparable); it is
the `--from-approvals` path above, not this synthetic set, that removes
any circularity once real decisions exist.

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

Weeks/months of real analyst decisions collected via `ApprovalLog` (already
logged today) past the `MIN_REAL_SAMPLES` floor, then periodic
`--from-approvals` retraining - both mechanisms already exist (see above);
what's missing is simply usage volume. The synthetic-label approach
remains the fallback while that data accumulates, not a claim about real
analyst behavior.
