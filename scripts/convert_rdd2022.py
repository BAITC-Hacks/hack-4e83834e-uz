"""Converts a sample of RDD2022 (CRDDC'2022) Pascal-VOC-XML annotations into
RoadWatch's YOLO detect_dataset format, and merges them alongside the
existing 13 hand-labeled images.

Class mapping (documented, not hidden - see /data/README.md for the
honest reasoning):

    RDD2022 code                                -> RoadWatch class
    D00 (longitudinal crack, wheel-mark part)    -> crack
    D01 (longitudinal crack, construction joint) -> crack
    D10 (transverse crack)                       -> crack
    D11 (transverse crack, construction joint)   -> crack
    D20 (alligator/mesh crack)                   -> crack
    D21 (alligator crack, other)                 -> crack
    D40 (pothole / rutting / bump / separation)  -> pothole

Every other RDD2022 code (D43 crosswalk blur, D44 white line blur, D50
utility hole cover, etc.) is dropped - none of them cleanly maps to
`broken_curb`, and the Czech subset used by fetch_rdd2022.sh doesn't
contain any of them anyway (see conversion summary printed at the end).
This is exactly why `broken_curb` and `faded_marking` still have zero real
training images after this conversion - see /model/README.md.

Images with zero *mapped* objects (either genuinely damage-free, or only
containing damage types we don't map) are excluded, since a YOLO detect
dataset entry needs at least one box for a supervised class we care about.

Usage:
    python3 scripts/convert_rdd2022.py --raw-dir /tmp/rdd2022_raw/extracted --n-images 1000
"""
from __future__ import annotations

import argparse
import random
import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = REPO_ROOT / "backend" / "data" / "detect_dataset"

RDD_TO_ROADWATCH = {
    "D00": "crack",
    "D01": "crack",
    "D10": "crack",
    "D11": "crack",
    "D20": "crack",
    "D21": "crack",
    "D40": "pothole",
}

VAL_FRACTION = 0.1
RANDOM_SEED = 7
FILENAME_PREFIX = "rdd2022_"


def parse_annotation(xml_path: Path) -> tuple[int, int, list[tuple[str, int, int, int, int]]]:
    root = ET.parse(xml_path).getroot()
    size = root.find("size")
    width = int(size.findtext("width"))
    height = int(size.findtext("height"))
    boxes = []
    for obj in root.findall("object"):
        raw_name = obj.findtext("name")
        mapped = RDD_TO_ROADWATCH.get(raw_name)
        if mapped is None:
            continue
        bnd = obj.find("bndbox")
        xmin = int(float(bnd.findtext("xmin")))
        ymin = int(float(bnd.findtext("ymin")))
        xmax = int(float(bnd.findtext("xmax")))
        ymax = int(float(bnd.findtext("ymax")))
        boxes.append((mapped, xmin, ymin, xmax, ymax))
    return width, height, boxes


def to_yolo_line(class_idx: int, xmin: int, ymin: int, xmax: int, ymax: int, width: int, height: int) -> str:
    cx = ((xmin + xmax) / 2) / width
    cy = ((ymin + ymax) / 2) / height
    w = (xmax - xmin) / width
    h = (ymax - ymin) / height
    return f"{class_idx} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", required=True, help="Directory containing the extracted RDD2022 zip (e.g. .../extracted)")
    parser.add_argument("--n-images", type=int, default=1000, help="How many labeled images to sample")
    parser.add_argument("--val-fraction", type=float, default=VAL_FRACTION)
    parser.add_argument("--seed", type=int, default=RANDOM_SEED)
    args = parser.parse_args()

    raw_dir = Path(args.raw_dir)
    xml_dirs = list(raw_dir.glob("*/train/annotations/xmls"))
    if not xml_dirs:
        raise SystemExit(f"No */train/annotations/xmls found under {raw_dir}")
    xml_dir = xml_dirs[0]
    images_dir = xml_dir.parent.parent / "images"
    if not images_dir.exists():
        raise SystemExit(f"Expected images dir at {images_dir}, not found")

    # names.yaml lookup - keep in sync with dataset.yaml
    class_to_idx = {"pothole": 0, "crack": 1, "broken_curb": 2, "faded_marking": 3}

    candidates: list[tuple[Path, int, int, list]] = []
    dropped_unmapped_only = 0
    empty = 0
    class_counts_seen: dict[str, int] = {}
    for xml_path in sorted(xml_dir.glob("*.xml")):
        width, height, boxes = parse_annotation(xml_path)
        # Count raw class occurrences (including unmapped) for the summary,
        # by re-parsing the raw <name> tags.
        root = ET.parse(xml_path).getroot()
        raw_names = [o.findtext("name") for o in root.findall("object")]
        for n in raw_names:
            class_counts_seen[n] = class_counts_seen.get(n, 0) + 1

        if not raw_names:
            empty += 1
            continue
        if not boxes:
            dropped_unmapped_only += 1
            continue
        img_path = images_dir / xml_path.with_suffix(".jpg").name
        if not img_path.exists():
            continue
        candidates.append((img_path, width, height, boxes))

    rng = random.Random(args.seed)
    rng.shuffle(candidates)
    sample = candidates[: args.n_images]

    n_val = max(1, round(len(sample) * args.val_fraction))
    val_set = sample[:n_val]
    train_set = sample[n_val:]

    written_class_counts = {"pothole": 0, "crack": 0}
    for split_name, split in (("train", train_set), ("val", val_set)):
        img_out_dir = DATASET_DIR / "images" / split_name
        lbl_out_dir = DATASET_DIR / "labels" / split_name
        img_out_dir.mkdir(parents=True, exist_ok=True)
        lbl_out_dir.mkdir(parents=True, exist_ok=True)
        for img_path, width, height, boxes in split:
            out_name = f"{FILENAME_PREFIX}{img_path.stem}"
            shutil.copy(img_path, img_out_dir / f"{out_name}.jpg")
            lines = []
            for cls_name, xmin, ymin, xmax, ymax in boxes:
                lines.append(to_yolo_line(class_to_idx[cls_name], xmin, ymin, xmax, ymax, width, height))
                written_class_counts[cls_name] += 1
            (lbl_out_dir / f"{out_name}.txt").write_text("\n".join(lines) + "\n")

    print("RDD2022 -> RoadWatch conversion summary")
    print(f"  Raw annotation files scanned: {len(list(xml_dir.glob('*.xml')))}")
    print(f"  Background (no damage) images skipped: {empty}")
    print(f"  Images with only unmapped damage codes skipped: {dropped_unmapped_only}")
    print(f"  Raw RDD2022 class occurrences seen: {class_counts_seen}")
    print(f"  Candidate labeled images available: {len(candidates)}")
    print(f"  Sampled: {len(sample)} (train={len(train_set)}, val={len(val_set)}, seed={args.seed})")
    print(f"  Boxes written by RoadWatch class: {written_class_counts}")
    print(f"  Images written to {DATASET_DIR}/images/{{train,val}}/{FILENAME_PREFIX}*.jpg")


if __name__ == "__main__":
    main()
