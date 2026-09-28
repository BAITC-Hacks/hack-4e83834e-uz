"""Merges the Kaggle "Road Damage Dataset: Potholes, Cracks and Manholes"
(2,000+ YOLO-annotated images from Rome/Sacrofano) into RoadWatch's
detect_dataset, alongside the existing hand-labeled + RDD2022 images.

This dataset already ships YOLO-format labels (labels-YOLO/), so no
polygon-to-bbox conversion is needed here - just a class-index remap and
a copy into RoadWatch's own train/val split.

Class mapping (documented, not hidden - see /data/README.md style):

    Dataset class          -> RoadWatch class (index in dataset.yaml)
    0 (Pothole)             -> pothole (0)
    1 (Crack)                -> crack (1)
    2 (Manhole)               -> manhole (4) - REQUIRES "manhole" to already
                                 be added to DEFECT_CLASSES in
                                 backend/app/config.py and to dataset.yaml.
                                 If you haven't done that yet, run this
                                 script with --drop-manhole instead, which
                                 skips manhole-only label lines and images
                                 that would otherwise have zero boxes left.

Usage:
    python3 scripts/convert_road_damage_dataset.py --raw-dir /path/to/extracted --n-images 1500
    python3 scripts/convert_road_damage_dataset.py --raw-dir /path/to/extracted --drop-manhole
"""
from __future__ import annotations

import argparse
import random
import shutil
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASET_DIR = REPO_ROOT / "backend" / "data" / "detect_dataset"
FILENAME_PREFIX = "rdamage_"

# Source class index (this dataset) -> RoadWatch class index (dataset.yaml).
# Only used when --drop-manhole is NOT set.
CLASS_REMAP = {0: 0, 1: 1, 2: 4}  # pothole->pothole, crack->crack, manhole->manhole


def remap_label_file(src_path: Path, drop_manhole: bool) -> list[str] | None:
    """Reads one labels-YOLO/*.txt file, remaps class indices, and returns
    the new lines - or None if nothing is left to write (e.g. every box in
    this image was manhole and --drop-manhole was set)."""
    lines = [l for l in src_path.read_text().splitlines() if l.strip()]
    out_lines = []
    for line in lines:
        parts = line.split()
        src_cls = int(parts[0])
        if drop_manhole and src_cls == 2:
            continue
        new_cls = CLASS_REMAP[src_cls]
        out_lines.append(" ".join([str(new_cls), *parts[1:]]))
    return out_lines or None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw-dir", type=Path, required=True,
                         help="Path to the extracted Kaggle download (contains images/ and labels-YOLO/)")
    parser.add_argument("--n-images", type=int, default=1500,
                         help="How many images to sample (dataset has 2,000+)")
    parser.add_argument("--val-fraction", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--drop-manhole", action="store_true",
                         help="Skip manhole boxes/images instead of remapping to class 4. "
                              "Use this if you haven't added 'manhole' to DEFECT_CLASSES yet.")
    args = parser.parse_args()

    images_dir = args.raw_dir / "images"
    labels_dir = args.raw_dir / "labels-YOLO"
    if not images_dir.exists() or not labels_dir.exists():
        raise SystemExit(f"Expected images/ and labels-YOLO/ under {args.raw_dir} - check the path.")

    candidates: list[tuple[Path, list[str]]] = []
    skipped_manhole_only = 0
    for label_path in sorted(labels_dir.glob("*.txt")):
        img_path = None
        for ext in (".jpg", ".jpeg", ".png"):
            candidate = images_dir / (label_path.stem + ext)
            if candidate.exists():
                img_path = candidate
                break
        if img_path is None:
            continue
        new_lines = remap_label_file(label_path, args.drop_manhole)
        if new_lines is None:
            skipped_manhole_only += 1
            continue
        candidates.append((img_path, new_lines))

    rng = random.Random(args.seed)
    rng.shuffle(candidates)
    sample = candidates[: args.n_images]

    n_val = max(1, round(len(sample) * args.val_fraction))
    val_set = sample[:n_val]
    train_set = sample[n_val:]

    written_class_counts = {"pothole": 0, "crack": 0, "manhole": 0}
    idx_to_name = {0: "pothole", 1: "crack", 4: "manhole"}
    for split_name, split in (("train", train_set), ("val", val_set)):
        img_out_dir = DATASET_DIR / "images" / split_name
        lbl_out_dir = DATASET_DIR / "labels" / split_name
        img_out_dir.mkdir(parents=True, exist_ok=True)
        lbl_out_dir.mkdir(parents=True, exist_ok=True)
        for img_path, lines in split:
            out_name = f"{FILENAME_PREFIX}{img_path.stem}"
            shutil.copy(img_path, img_out_dir / f"{out_name}{img_path.suffix}")
            (lbl_out_dir / f"{out_name}.txt").write_text("\n".join(lines) + "\n")
            for line in lines:
                cls_idx = int(line.split()[0])
                written_class_counts[idx_to_name[cls_idx]] += 1

    print("Road Damage Dataset -> RoadWatch conversion summary")
    print(f"  Label files scanned: {len(list(labels_dir.glob('*.txt')))}")
    print(f"  Skipped (manhole-only, --drop-manhole set): {skipped_manhole_only}")
    print(f"  Candidate images available: {len(candidates)}")
    print(f"  Sampled: {len(sample)} (train={len(train_set)}, val={len(val_set)}, seed={args.seed})")
    print(f"  Boxes written by RoadWatch class: {written_class_counts}")
    print(f"  Images written to {DATASET_DIR}/images/{{train,val}}/{FILENAME_PREFIX}*")
    if not args.drop_manhole and written_class_counts["manhole"] > 0:
        print("  NOTE: manhole boxes were written as class 4. Confirm 'manhole' is in "
              "DEFECT_CLASSES (config.py) and dataset.yaml BEFORE training, or these "
              "boxes will train a class the rest of the app doesn't recognize.")


if __name__ == "__main__":
    main()
