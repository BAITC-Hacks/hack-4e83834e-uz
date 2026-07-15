# RoadWatch

AI-assisted road defect detection & repair prioritization — a 2-week
GovTech hackathon prototype. RoadWatch detects road infrastructure defects
(potholes, cracks, broken curbs, faded lane markings) from photos and
ranks them for a human maintenance analyst to review. **The AI only ranks
and explains — a human always approves, rejects, or defers every item
before anything is considered scheduled for repair.**

## Problem & users

City road maintenance departments (akimats) receive scattered,
unstructured defect reports from citizens, dashcams, and inspection
drives, with no systematic way to detect them automatically or prioritize
limited repair budget/crew capacity.

- **Primary user**: a maintenance department analyst / road-infrastructure
  inspector who reviews a ranked queue of defects and approves work orders.
- **Secondary user**: a citizen who submits a photo of a defect near them
  via a simple web form.

## What's actually built vs. simulated (read this first)

This is a hackathon prototype, not a production system, and it says so
throughout:

- **Detection**: real YOLOv8 inference, fine-tuned on a small hand-labeled
  set of 13 real photos (no bulk open dataset was accessible without
  credentials this environment didn't have). Honest, measured accuracy
  numbers are in [`model/README.md`](model/README.md) — they are not
  production-grade, and two of the four defect classes have zero training
  examples.
- **Scoring**: a genuine trained model (`scikit-learn LogisticRegression`),
  not an if/else rule, plus a fully transparent weighted-sum baseline kept
  alongside it for comparison. See [`model/README.md`](model/README.md).
- **Traffic volume & most demo defect/report volume**: synthetic, with the
  exact generation logic documented in [`data/README.md`](data/README.md).
  Nothing synthetic is presented as real open government data.
- **Human approval**: fully real and structurally enforced — see
  [Human-in-the-loop workflow](#human-in-the-loop-workflow) below.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full component
diagram and module map. Short version:

```
photo in → YOLOv8 detection → severity/traffic/repeat-report features
  → learned priority ranker → explanation → ranked queue
  → analyst opens item → Approve / Reject / Defer (logged)
```

- **Backend**: Python / FastAPI / SQLAlchemy / SQLite
- **Detection**: Ultralytics YOLOv8n
- **Scoring**: scikit-learn `LogisticRegression` (primary) + a transparent
  hand-weighted function (baseline/fallback)
- **Frontend**: React (Vite) + Leaflet (map) + Recharts (analytics)

## Repo structure

```
roadwatch/
  backend/          FastAPI app, detection, scoring, tests
  frontend/         React dashboard (Vite)
  model/            Model card: training data, metrics, limitations
  data/             Data sources, schema, synthetic-generation docs
  docs/             Architecture diagram, demo script, presentation outline
```

## Running locally

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# (Optional but recommended) fine-tune the detector on the bundled
# hand-labeled sample set, and train the priority ranker:
python -m app.detection.train
python -m app.scoring.train_ranker

# Seed demo data (24 road segments, defects from real detection on the
# sample images + synthetic volume, repeat reports, a few pre-reviewed
# items) - see data/README.md for exactly what's real vs synthetic:
python -m app.seed

# Run the API:
uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000` (interactive docs at `/docs`).

If you skip the two `train` steps, the detector falls back to stock
pretrained YOLOv8n (which has no road-defect classes and will report zero
detections — see `model/README.md`) and the ranker falls back to the
transparent weighted-sum scorer. The app still runs end-to-end either way.

Run tests: `pytest tests/` (from `backend/`, with `venv` active).

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard is now at `http://localhost:5173` (expects the backend at
`http://localhost:8000` — see `frontend/src/constants.js:API_BASE`).

## Data sources & limitations

Full detail in [`data/README.md`](data/README.md). Summary:

- Detection training images: 13 real photos, individually sourced from
  Wikimedia Commons under permissive licenses (full attribution in
  `backend/data/sample_images/SOURCES.md`).
- Traffic volume: 100% synthetic (documented lognormal generator per road
  class + district multiplier) — no open per-segment traffic dataset was
  reachable in this environment.
- Road segments/districts: illustrative Almaty geography, not
  survey-grade GIS data.
- Known detector limitations: tiny training set, only 2/4 classes covered,
  untested on night/rain/dashcam-angle conditions, geographic bias toward
  the specific source photos used.

## Model description

Full detail in [`model/README.md`](model/README.md), including measured
precision/recall/mAP for the detector and accuracy/precision/recall/ROC-AUC
for the ranker — reported honestly, not rounded up.

## Explainability approach

Every ranked defect returned by `GET /queue` or `GET /defects/{id}` always
includes:

- `explanation`: a generated sentence, e.g. *"Ranked #1 — Pothole,
  severity: high (large area, 0.91 confidence). Location averages 340
  vehicles/day. 3rd citizen report at this location in the past 14 days."*
- `score_breakdown_pct`: the percentage contribution of each of the three
  factors (severity / traffic / repeat-reports) to that specific defect's
  score — read directly off the logistic regression's coefficients
  (`coefficient_i × standardized_feature_i`, normalized), not a
  separately-invented post-hoc explanation.

No ranked item is ever shown without both. The dashboard's defect detail
modal renders the breakdown as labeled bars and the explanation as plain
text alongside the photo and detection bounding box.

## Human-in-the-loop workflow

`POST /defects/{id}/review` is the **only** code path in the system that
can change a defect's status. It requires:

- `action`: `approve` / `reject` / `defer`
- `reviewer_name`: non-empty, required
- `comment`: optional

and writes an immutable, server-timestamped `ApprovalLog` row before
updating the defect's status (`approve` → `scheduled`, `reject` →
`rejected`, `defer` → `deferred`). No detection, scoring, or queue endpoint
can set a defect to any status other than `open`. This is enforced by the
data model and route structure, not just documented in prose — see
`backend/app/routers/reviews.py` and `docs/architecture.md`'s "Why this
satisfies the human-oversight constraint structurally" section.

## Deliverables

- [`docs/architecture.md`](docs/architecture.md) — component diagram
- [`docs/demo_script.md`](docs/demo_script.md) — 2-3 min demo video script
- [`docs/presentation_outline.md`](docs/presentation_outline.md) — 7-10
  slide outline
- [`model/README.md`](model/README.md) — model card
- [`data/README.md`](data/README.md) — data sources, schema, synthetic
  generation logic

## Assumptions made while building (per "proceed with reasonable defaults")

- SQLite instead of Postgres (simplest for a local prototype).
- Almaty district names used for illustrative demo geography.
- Citizen submission implemented as a web form + API endpoint rather than
  a Telegram bot, for build-time scope (noted as a next step).
- Both a learned ranker and a transparent weighted baseline are
  implemented; the learned ranker drives the actual queue order.
