#!/usr/bin/env bash
# Convenience script: start backend (FastAPI) and frontend (Vite) together.
# Assumes `backend/venv` and `frontend/node_modules` already exist - see
# the root README.md "Running locally" section for first-time setup.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  echo "Stopping RoadWatch dev servers..."
  kill "${BACKEND_PID:-}" "${FRONTEND_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT

(
  cd "$ROOT_DIR/backend"
  source venv/bin/activate
  uvicorn app.main:app --reload --port 8000
) &
BACKEND_PID=$!

(
  cd "$ROOT_DIR/frontend"
  npm run dev
) &
FRONTEND_PID=$!

echo "Backend:  http://localhost:8000 (docs at /docs)"
echo "Frontend: http://localhost:5173"
wait
