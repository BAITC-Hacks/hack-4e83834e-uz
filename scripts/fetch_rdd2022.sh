#!/usr/bin/env bash
# Downloads the RDD2022 (CRDDC'2022) Czech Republic road-damage subset and
# converts a sample of it into RoadWatch's YOLO detect_dataset format.
#
# Why Czech: it's the smallest per-country zip (train+test) in the official
# release, at ~245MB, vs. ~1GB (Japan), ~500MB (India), ~9.9GB (Norway) - see
# https://github.com/sekilab/RoadDamageDetector for the full list. No account
# or API key is required; this is a direct public S3 URL.
#
# Usage:
#   ./scripts/fetch_rdd2022.sh [n_images] [out_dir]
#
#   n_images  how many labeled train images to sample into the dataset
#             (default 1000; RDD2022 test/ has no public annotations, so all
#             sampled images come from RDD2022's train/ split, which this
#             script then re-splits 90/10 into our own train/val).
#   out_dir   scratch directory for the raw download+extraction
#             (default: /tmp/rdd2022_raw)
#
# What it does:
#   1. Downloads RDD2022_Czech.zip (~245MB) from the official CRDDC2022 S3
#      bucket (public, no credentials).
#   2. Extracts it.
#   3. Runs scripts/convert_rdd2022.py to sample n_images labeled images,
#      map RDD2022 damage codes onto RoadWatch's taxonomy (D00/D01/D10/D11/
#      D20/D21 -> crack, D40 -> pothole; everything else, including D43/D44,
#      is dropped - see that script's docstring), and merge them into
#      backend/data/detect_dataset/ alongside the existing 13 hand-labeled
#      images.
#
# After running this, retrain with:
#   cd backend && source venv/bin/activate && python -m app.detection.train

set -euo pipefail

N_IMAGES="${1:-1000}"
OUT_DIR="${2:-/tmp/rdd2022_raw}"
ZIP_URL="https://bigdatacup.s3.ap-northeast-1.amazonaws.com/2022/CRDDC2022/RDD2022/Country_Specific_Data_CRDDC2022/RDD2022_Czech.zip"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p "$OUT_DIR"
ZIP_PATH="$OUT_DIR/RDD2022_Czech.zip"

if [ ! -f "$ZIP_PATH" ]; then
  echo "Downloading RDD2022 Czech subset (~245MB) to $ZIP_PATH ..."
  curl -sS -o "$ZIP_PATH" "$ZIP_URL"
else
  echo "Reusing existing download at $ZIP_PATH"
fi

EXTRACT_DIR="$OUT_DIR/extracted"
if [ ! -d "$EXTRACT_DIR" ]; then
  echo "Extracting..."
  mkdir -p "$EXTRACT_DIR"
  unzip -q "$ZIP_PATH" -d "$EXTRACT_DIR"
else
  echo "Reusing existing extraction at $EXTRACT_DIR"
fi

echo "Converting a sample of $N_IMAGES labeled images into RoadWatch's dataset format..."
python3 "$REPO_ROOT/scripts/convert_rdd2022.py" --raw-dir "$EXTRACT_DIR" --n-images "$N_IMAGES"

echo "Done. Re-run detector training with:"
echo "  cd backend && source venv/bin/activate && python -m app.detection.train"
