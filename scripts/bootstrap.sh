#!/usr/bin/env bash
# One-command setup for a fresh clone: venv, deps, (train only if the
# committed weights are somehow missing), seed the demo database, print
# next steps. Weights (backend/data/weights/roadwatch_ft.pt) and the
# ranker (backend/data/ranker.joblib) are committed to this repo - see
# "Out-of-the-box demo" in /README.md - so this is fast by default; it
# only re-trains if you've deleted them.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT/backend"

if [ ! -d venv ]; then
  echo "Creating virtualenv..."
  python3 -m venv venv
fi
source venv/bin/activate

echo "Installing backend dependencies..."
pip install -q -r requirements.txt

if [ ! -f data/weights/roadwatch_ft.pt ]; then
  echo "No fine-tuned detector weights found - training now (see model/README.md for what this trains on)..."
  python -m app.detection.train
else
  echo "Using committed fine-tuned weights at backend/data/weights/roadwatch_ft.pt"
fi

if [ ! -f data/ranker.joblib ]; then
  echo "No ranker model found - training now..."
  python -m app.scoring.train_ranker
else
  echo "Using committed ranker at backend/data/ranker.joblib"
fi

echo "Seeding demo database..."
python -m app.seed

cat <<'EOF'

RoadWatch backend is ready.

Next steps:
  cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8000
  (in another terminal) cd frontend && npm install && npm run dev

Dashboard: http://localhost:5173
API docs:  http://localhost:8000/docs

Or skip all of the above: `docker compose up --build` from the repo root.
EOF
