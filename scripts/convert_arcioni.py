"""Converts the Arcioni et al. "Road Damage Dataset: Potholes, Cracks and
Manholes" (Giordani, Arcioni, Gil-Martin, Marini - Scientific Reports 2026;
Zenodo DOI 10.5281/zenodo.17834373) into RoadWatch's YOLO detect_dataset
format, and merges it alongside the existing hand-labeled + RDD2022 images
(see convert_rdd2022.py, which this script's structure deliberately mirrors).

Source annotation format - inspected directly against real files from the
archive (not assumed - see "How this was verified" below): each
`data/labels/<name>.txt` line is

    class_index x1 y1 x2 y2 x3 y3 x4 y4

i.e. a 4-corner polygon (YOLO-OBB/segmentation-style export), with each x/y
already normalized to [0,1] against that image's own width/height. This is
NOT the standard 5-value `class cx cy w h` YOLO-detect format RoadWatch's
other label files use, so this script converts each polygon to an
axis-aligned bbox (min/max x, min/max y across its 4 points - every polygon
observed during verification was already an axis-aligned rectangle, just
written as 4 corners) before writing a standard YOLO-detect line. Because
the coordinates are pre-normalized per-image, no image width/height lookup
is needed for the conversion.

Class mapping (per the Zenodo record's own documented taxonomy - "Class 0 -
Pothole, Class 1 - Crack, Class 2 - Manhole"):

    Arcioni class 0 (pothole) -> RoadWatch `pothole` (class 0)
    Arcioni class 1 (crack)   -> RoadWatch `crack`   (class 1)
    Arcioni class 2 (manhole) -> RoadWatch `manhole` (class 4, NEW - see
                                  dataset.yaml). Manhole is a trained class
                                  but deliberately NOT a defect - see
                                  app/config.py's NON_DEFECT_CLASSES and
                                  detector.py's _map_class_name(), which
                                  recognizes and discards manhole detections
                                  rather than ever creating a Defect row.

How this was verified (be honest about it): the full archive is a single
~193MB zip (https://zenodo.org/api/records/17834373/files/archive.zip) that
this sandbox's network could not fully download (transfers were cut off
partway - see scripts/fetch_arcioni.sh and /model/README.md's "Arcioni
dataset - status" section for the current state of the actual merge). The
format above was confirmed for real by fetching the zip's trailing central
directory via an HTTP Range request (small, ~3MB) to get the full file
listing (2,009 images + 2,009 labels under data/images/ and data/labels/,
no other files), then targeting a few more small Range requests at specific
labels' local-file-header offsets to decompress and read their actual
content - not a guess from the dataset's prose description alone. This
script is therefore believed correct but has only been validated against a
handful of real label files this way, not run end-to-end against the full
2,009-image archive - see backend/tests/test_convert_arcioni.py, which
pins the exact real label lines inspected this way as regression fixtures.

Usage:
    python3 scripts/convert_arcioni.py --raw-dir /tmp/arcioni_raw/extracted
"""
from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = REPO_ROOT / "backend" / "data" / "detect_dataset"

ARCIONI_TO_ROADWATCH = {
    "0": "pothole",
    "1": "crack",
    "2": "manhole",
}

# names.yaml lookup - keep in sync with dataset.yaml
CLASS_TO_IDX = {"pothole": 0, "crack": 1, "broken_curb": 2, "faded_marking": 3, "manhole": 4}

VAL_FRACTION = 0.1
RANDOM_SEED = 7
FILENAME_PREFIX = "arcioni_"


def parse_label(txt_path: Path) -> list[tuple[str, float, float, float, float]]:
    """Parses one 4-corner-polygon label file into (class_name, cx, cy, w, h)
    tuples, already normalized [0,1] (see module docstring - no image-size
    lookup needed since the source coordinates are per-image fractions)."""
    boxes = []
    for line in txt_path.read_text().strip().splitlines():
        parts = line.split()
        if not parts:
            continue
        raw_cls, *coords = parts
        mapped = ARCIONI_TO_ROADWATCH.get(raw_cls)
        if mapped is None or len(coords) != 8:
            continue
        xs = [float(coords[i]) for i in range(0, 8, 2)]
        ys = [float(coords[i]) for i in range(1, 8, 2)]
        xmin, xmax = min(xs), max(xs)
        ymin, ymax = min(ys), max(ys)
        boxes.append((mapped, (xmin + xmax) / 2, (ymin + ymax) / 2, xmax - xmin, ymax - ymin))
    return boxes


def to_yolo_line(class_idx: int, cx: float, cy: float, w: float, h: float) -> str:
    return f"{class_idx} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"


def print_merged_summary() -> None:
    """Per-class box-count summary across the ENTIRE merged detect_dataset
    (hand-labeled + RDD2022 + Arcioni, if present), train and val combined."""
    idx_to_class = {v: k for k, v in CLASS_TO_IDX.items()}
    counts: dict[str, int] = {name: 0 for name in CLASS_TO_IDX}
    n_labeled_images = 0
    for split_name in ("train", "val"):
        lbl_dir = DATASET_DIR / "labels" / split_name
        if not lbl_dir.exists():
            continue
        for txt_path in lbl_dir.glob("*.txt"):
            n_labeled_images += 1
            for line in txt_path.read_text().strip().splitlines():
                if not line.split():
                    continue
                counts[idx_to_class[int(line.split()[0])]] += 1
    print(f"=== Merged backend/data/detect_dataset/ summary ({n_labeled_images} labeled images) ===")
    for name, count in counts.items():
        print(f"  {name:15s} {count}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--raw-dir", required=True,
        help="Directory containing the extracted archive (must contain data/images/ and data/labels/)",
    )
    parser.add_argument("--n-images", type=int, default=None, help="Cap on how many labeled images to sample (default: all)")
    parser.add_argument("--val-fraction", type=float, default=VAL_FRACTION)
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    args = parser.parse_args()

    raw_dir = Path(args.raw_dir)
    labels_dir = raw_dir / "data" / "labels"
    images_dir = raw_dir / "data" / "images"
    if not labels_dir.exists() or not images_dir.exists():
        raise SystemExit(f"Expected {labels_dir} and {images_dir} under --raw-dir, not found")

    candidates: list[tuple[Path, list]] = []
    empty = 0
    class_counts_seen: dict[str, int] = {}
    for txt_path in sorted(labels_dir.glob("*.txt")):
        raw_lines = [line.split()[0] for line in txt_path.read_text().strip().splitlines() if line.split()]
        for raw_cls in raw_lines:
            class_counts_seen[raw_cls] = class_counts_seen.get(raw_cls, 0) + 1
        boxes = parse_label(txt_path)
        if not boxes:
            empty += 1
            continue
        img_path = images_dir / txt_path.with_suffix(".jpg").name
        if not img_path.exists():
            continue
        candidates.append((img_path, boxes))

    rng = random.Random(args.seed)
    rng.shuffle(candidates)
    sample = candidates[: args.n_images] if args.n_images else candidates

    n_val = max(1, round(len(sample) * args.val_fraction))
    val_set = sample[:n_val]
    train_set = sample[n_val:]

    written_class_counts = {"pothole": 0, "crack": 0, "manhole": 0}
    for split_name, split in (("train", train_set), ("val", val_set)):
        img_out_dir = DATASET_DIR / "images" / split_name
        lbl_out_dir = DATASET_DIR / "labels" / split_name
        img_out_dir.mkdir(parents=True, exist_ok=True)
        lbl_out_dir.mkdir(parents=True, exist_ok=True)
        for img_path, boxes in split:
            out_name = f"{FILENAME_PREFIX}{img_path.stem}"
            shutil.copy(img_path, img_out_dir / f"{out_name}.jpg")
            lines = []
            for cls_name, cx, cy, w, h in boxes:
                lines.append(to_yolo_line(CLASS_TO_IDX[cls_name], cx, cy, w, h))
                written_class_counts[cls_name] += 1
            (lbl_out_dir / f"{out_name}.txt").write_text("\n".join(lines) + "\n")

    print("Arcioni et al. -> RoadWatch conversion summary")
    print(f"  Raw label files scanned: {len(list(labels_dir.glob('*.txt')))}")
    print(f"  Labelless images skipped: {empty}")
    print(f"  Raw Arcioni class occurrences seen: {class_counts_seen}")
    print(f"  Candidate labeled images available: {len(candidates)}")
    print(f"  Sampled: {len(sample)} (train={len(train_set)}, val={len(val_set)}, seed={args.seed})")
    print(f"  Boxes written by RoadWatch class: {written_class_counts}")
    print(f"  Images written to {DATASET_DIR}/images/{{train,val}}/{FILENAME_PREFIX}*.jpg")
    print()
    print_merged_summary()


if __name__ == "__main__":
    main()
