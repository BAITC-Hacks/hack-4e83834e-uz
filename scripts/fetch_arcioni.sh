#!/usr/bin/env bash
# Downloads the "Road Damage Dataset: Potholes, Cracks and Manholes"
# (Giordani, Arcioni, Gil-Martin, Marini - Sapienza University of Rome /
# Universidad Politecnica de Madrid; Scientific Reports 2026) - 2,009 images,
# YOLO-format labels, 3 classes (0=pothole, 1=crack, 2=manhole), collected
# around Rome and Sacrofano, Italy.
#
# Why this dataset: RoadWatch's pothole class is data-starved (185 boxes,
# mAP50 0.089 - see /model/README.md) because the RDD2022 Czech subset is
# crack-heavy. This dataset adds ~1,261 pothole boxes plus a manhole class
# that exists specifically to teach the detector NOT to confuse manhole
# covers with potholes (a common false-positive source - see the dataset's
# own description on Zenodo).
#
# License: CC BY 4.0 (per the Zenodo record's metadata - verify this
# yourself at the Zenodo link below before treating it as final; license
# terms on hosted datasets can change between versions).
#
# Two ways to fetch it:
#
#   1) kagglehub (default) - requires a (free) Kaggle account and API
#      credentials. Get a token at https://www.kaggle.com/settings ->
#      "Create New Token", which downloads kaggle.json - place it at
#      ~/.kaggle/kaggle.json (chmod 600), or set the KAGGLE_USERNAME /
#      KAGGLE_KEY environment variables instead. Needs
#      scripts/requirements-data.txt installed (`pip install -r
#      scripts/requirements-data.txt`).
#
#   2) --zenodo (fallback, no account needed) - downloads the identical
#      files directly from the authoritative Zenodo archival record (DOI
#      10.5281/zenodo.17834373, resolved below), for reproducibility in an
#      environment without Kaggle credentials, or if the Kaggle mirror is
#      ever taken down/renamed. Kaggle mirror: kaggle.com/datasets/
#      lorenzoarcioni/road-damage-dataset-potholes-cracks-and-manholes
#
# Usage:
#   ./scripts/fetch_arcioni.sh [out_dir]              # kagglehub path
#   ./scripts/fetch_arcioni.sh --zenodo [out_dir]     # Zenodo fallback path
#
#   out_dir   scratch directory for the raw download+extraction
#             (default: /tmp/arcioni_raw)
#
# After running this, convert it into RoadWatch's dataset format with:
#   python3 scripts/convert_arcioni.py --raw-dir <out_dir>/extracted

set -euo pipefail

MODE="kagglehub"
if [ "${1:-}" = "--zenodo" ]; then
  MODE="zenodo"
  shift
fi

OUT_DIR="${1:-/tmp/arcioni_raw}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXTRACT_DIR="$OUT_DIR/extracted"

mkdir -p "$OUT_DIR"

if [ "$MODE" = "zenodo" ]; then
  # Resolved from DOI 10.5281/zenodo.17834373 via the Zenodo REST API
  # (https://zenodo.org/api/records/17834373/files) - a single archive.zip.
  ZIP_URL="https://zenodo.org/api/records/17834373/files/archive.zip/content"
  ZIP_PATH="$OUT_DIR/archive.zip"

  if [ ! -f "$ZIP_PATH" ]; then
    echo "Downloading Arcioni et al. road damage dataset (~185MB) from Zenodo to $ZIP_PATH ..."
    curl -sS -L -o "$ZIP_PATH" "$ZIP_URL"
  else
    echo "Reusing existing download at $ZIP_PATH"
  fi

  if [ ! -d "$EXTRACT_DIR" ]; then
    echo "Extracting..."
    mkdir -p "$EXTRACT_DIR"
    unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR"
  else
    echo "Reusing existing extraction at $EXTRACT_DIR"
  fi
else
  echo "Downloading via kagglehub (requires Kaggle credentials - see this script's"
  echo "header comment if you don't have ~/.kaggle/kaggle.json or KAGGLE_USERNAME/KAGGLE_KEY set)..."
  DOWNLOADED_PATH="$(python3 - "$EXTRACT_DIR" <<'PYEOF'
import shutil
import sys

import kagglehub

extract_dir = sys.argv[1]
path = kagglehub.dataset_download("lorenzoarcioni/road-damage-dataset-potholes-cracks-and-manholes")
shutil.copytree(path, extract_dir, dirs_exist_ok=True)
print(extract_dir)
PYEOF
)"
  echo "Downloaded and copied to $DOWNLOADED_PATH"
fi

echo "Done. Extracted dataset is at: $EXTRACT_DIR"
echo "Next, inspect its structure, then convert with:"
echo "  python3 $REPO_ROOT/scripts/convert_arcioni.py --raw-dir $EXTRACT_DIR"
