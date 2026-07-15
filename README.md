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

## Why this can't be solved by ordinary automation

Two judging questions this repo is built to answer directly:

- **Photo understanding needs computer vision, not rules.** A defect report
  is a photo, not structured data - there is no field to write an if/else
  rule against. Telling a pothole from a crack from a normal patch of
  asphalt, and estimating how big it is, requires a model that has learned
  visual patterns (`app/detection/detector.py`, YOLOv8). A static form
  (dropdown: "how bad is it, 1-5?") pushes that judgment onto the citizen,
  who has no calibration and no incentive to be consistent - which is
  exactly the input noise a scoring model has to be robust to (see below).
- **Prioritization under noisy, repeated, conflicting reports needs
  scoring, not a queue.** Multiple citizens report the same pothole with
  different severity impressions; a arterial-road hairline crack and a
  local-street pothole aren't comparable on any single raw field. Sorting
  by "report count" alone over-weights popular locations; sorting by
  "newest first" (a plain FIFO queue - what a non-AI system would default
  to) ignores urgency entirely. This needs a function that combines
  severity, traffic exposure, and time-decayed repeat-report clustering
  into one comparable number - a rule an analyst could write down is
  exactly what `weighted_model.py` is, and the project brief specifically
  asks for something that goes further: a model that *learns* the
  weighting from labeled outcomes (`ranker_model.py`) and improves as real
  decisions accumulate (`train_ranker.py --from-approvals` - see
  [`model/README.md`](model/README.md)). See
  [Measurable impact](#measurable-impact) below for what this concretely
  buys over chronological ordering, measured on the seeded demo data.

## What's actually built vs. simulated (read this first)

This is a hackathon prototype, not a production system, and it says so
throughout:

- **Detection**: real YOLOv8 inference, fine-tuned on 13 hand-labeled
  photos plus a 1,000-image sample of RDD2022 (an open, CC BY-SA 4.0 road
  damage dataset — see [`data/README.md`](data/README.md) for how it's
  fetched and mapped). Honest, measured accuracy numbers are in
  [`model/README.md`](model/README.md) — they are not production-grade,
  and two of the four defect classes still have zero training examples
  (deliberately kept out of the active demo taxonomy as a result — see
  below).
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

### Out-of-the-box demo

`backend/data/weights/roadwatch_ft.pt` and `backend/data/ranker.joblib`
are **committed to this repo** - a fresh clone gets real detections and a
real ranked queue immediately, no training step required first. Either:

```bash
./scripts/bootstrap.sh   # venv, deps, seed, prints next steps
```

or `docker compose up --build` (see [Docker deploy](#docker-deploy)
below) - both skip training entirely and use the committed weights.

### Backend

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# (Optional but recommended) fine-tune the detector on the bundled
# hand-labeled sample set, and train the priority ranker:
python -m app.detection.train
python -m app.scoring.train_ranker
# Once enough real analyst decisions exist in ApprovalLog (see
# model/README.md), retrain the ranker on them instead of synthetic labels:
python -m app.scoring.train_ranker --from-approvals

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

## Docker deploy

```bash
docker compose up --build
```

That's the entire deploy. It builds the backend (FastAPI + the committed
fine-tuned weights and ranker - see "Out-of-the-box demo" below) and the
frontend (a static Vite build served by nginx), and the backend container
reseeds the demo database on every start (`app/seed.py` is idempotent - see
`/data/README.md`). Once both containers are up:

- Dashboard: `http://localhost:5173`
- API + interactive docs: `http://localhost:8000/docs`

No named volumes are used - container state (uploaded photos, the SQLite
DB) doesn't persist across restarts, by design, since the seed step
regenerates a full demo dataset every time. See `backend/Dockerfile`,
`frontend/Dockerfile`, and `docker-compose.yml`.

## Data sources & limitations

Full detail in [`data/README.md`](data/README.md). Summary:

- Detection training images: 13 hand-labeled real photos (Wikimedia
  Commons, permissive licenses, full attribution in
  `backend/data/sample_images/SOURCES.md`) plus a 1,000-image RDD2022
  sample (CC BY-SA 4.0, reproducible via `scripts/fetch_rdd2022.sh`).
- Traffic volume: 100% synthetic (documented lognormal generator per road
  class + district multiplier) — no open per-segment traffic dataset was
  reachable in this environment.
- Road segments/districts: illustrative Almaty geography, not
  survey-grade GIS data.
- Known detector limitations: only 2/4 classes covered (`broken_curb`/
  `faded_marking` have zero real examples and are excluded from the active
  demo taxonomy), `pothole` class imbalance vs. `crack`, untested on
  night/rain/dashcam-angle conditions, geographic bias (Czech Republic +
  varied Wikimedia sources, none Kazakhstan-specific).

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

## Measurable impact

Numbers below are computed by `backend/app/scoring/measure_impact.py`
against the current seeded demo database (`python -m app.seed`, then
`python -m app.scoring.measure_impact`) - not invented. Re-run it yourself;
it prints exactly this. Where a number would require real analyst usage to
measure honestly (not simulated here), we say so instead of guessing.

On the current seeded database (34 open defects):

- **Prioritizing high-traffic defects**: 9 open defects sit on `arterial`
  roads (the highest synthetic traffic tier - the closest proxy this demo
  has to "real-world urgency"). The learned ranker surfaces **7 of those 9
  into the top 10** of the queue; a plain chronological ordering (what a
  no-AI, "read reports in submission order" system defaults to) only
  surfaces **5 of 9** into the same top 10.
- **Surfacing repeated citizen complaints**: 9 open defects have 3+ citizen
  reports clustered at the same location. Under the ranker they land at an
  average queue position of **12.7**; under plain chronological order,
  **22.4** - almost twice as deep in a manual read-through.
- **Detection throughput**: the fine-tuned YOLOv8n detector processes the
  13 sample images at **23.4 images/sec** (0.043s/image) on this machine
  (Apple Silicon MPS if available, else CPU - see `_best_device()` in
  `app/detection/train.py`) - fast enough that detection latency is not
  the bottleneck in the pipeline; human review is.

Re-run `python -m app.seed && python -m app.scoring.measure_impact` any
time - these numbers move with the seed's random draw and whichever
detector/ranker weights are currently loaded, by design (see the note in
`/model/README.md` about why detection counts shifted after retraining).

**What this doesn't measure (and we won't invent a number for):** minutes
saved per real triage session, false-positive nuisance rate at production
scale, or citizen adoption/report volume - all of those need real analyst
and citizen usage, which a 2-week prototype doesn't have. The structural
claim in [Why this can't be solved by ordinary automation](#why-this-cant-be-solved-by-ordinary-automation)
above holds regardless; the numbers here are the concrete evidence for it
on this dataset.

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
