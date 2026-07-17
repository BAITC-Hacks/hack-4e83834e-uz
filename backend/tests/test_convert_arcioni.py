"""Regression fixtures for scripts/convert_arcioni.py's polygon->bbox
conversion, pinned to real label lines read directly out of the Arcioni et
al. Zenodo archive (DOI 10.5281/zenodo.17834373) - see that script's module
docstring for how they were obtained (targeted HTTP Range requests against
the real archive, not invented data)."""
import sys
from pathlib import Path

import pytest

SCRIPTS_DIR = Path(__file__).resolve().parent.parent.parent / "scripts"
sys.path.insert(0, str(SCRIPTS_DIR))

from convert_arcioni import parse_label  # noqa: E402


def _write(tmp_path: Path, name: str, content: str) -> Path:
    p = tmp_path / name
    p.write_text(content)
    return p


def test_single_crack_polygon_converts_to_axis_aligned_bbox(tmp_path):
    # Real content of data/labels/20250219_164905.txt
    txt = _write(tmp_path, "a.txt", "1 0.115625 0.361111 0.600000 0.361111 0.600000 0.675000 0.115625 0.675000\n")
    boxes = parse_label(txt)
    assert len(boxes) == 1
    cls_name, cx, cy, w, h = boxes[0]
    assert cls_name == "crack"
    assert cx == pytest.approx((0.115625 + 0.600000) / 2)
    assert cy == pytest.approx((0.361111 + 0.675000) / 2)
    assert w == pytest.approx(0.600000 - 0.115625)
    assert h == pytest.approx(0.675000 - 0.361111)


def test_single_pothole_polygon_converts_to_axis_aligned_bbox(tmp_path):
    # Real content of data/labels/20250219_164919.txt
    txt = _write(tmp_path, "b.txt", "0 0.418750 0.313889 0.512500 0.313889 0.512500 0.405556 0.418750 0.405556\n")
    boxes = parse_label(txt)
    assert len(boxes) == 1
    assert boxes[0][0] == "pothole"


def test_multi_box_frame_with_manhole_and_crack_and_pothole(tmp_path):
    # Real content of data/labels/20250216_164325.txt (9 boxes, classes 2/0/1 mixed)
    content = (
        "2 0.317188 0.480556 0.615625 0.480556 0.615625 0.625000 0.317188 0.625000\n"
        "0 0.582812 0.500000 0.626563 0.500000 0.626563 0.613889 0.582812 0.613889\n"
        "0 0.259375 0.516667 0.310937 0.516667 0.310937 0.572222 0.259375 0.572222\n"
        "0 0.360938 0.475000 0.414062 0.475000 0.414062 0.522222 0.360938 0.522222\n"
        "1 0.396875 0.627778 0.446875 0.627778 0.446875 0.716667 0.396875 0.716667\n"
        "1 0.157812 0.788889 0.360938 0.788889 0.360938 0.994444 0.157812 0.994444\n"
        "1 0.339062 0.683333 0.398438 0.683333 0.398438 0.808333 0.339062 0.808333\n"
        "1 0.579688 0.508333 0.654687 0.508333 0.654687 0.613889 0.579688 0.613889\n"
        "1 0.429688 0.466667 0.582812 0.466667 0.582812 0.505556 0.429688 0.505556\n"
    )
    txt = _write(tmp_path, "c.txt", content)
    boxes = parse_label(txt)
    class_names = [b[0] for b in boxes]
    assert class_names.count("manhole") == 1
    assert class_names.count("pothole") == 3
    assert class_names.count("crack") == 5


def test_unmapped_class_index_is_dropped(tmp_path):
    txt = _write(tmp_path, "d.txt", "9 0.1 0.1 0.2 0.1 0.2 0.2 0.1 0.2\n")
    assert parse_label(txt) == []


def test_blank_lines_are_ignored(tmp_path):
    txt = _write(tmp_path, "e.txt", "\n0 0.1 0.1 0.2 0.1 0.2 0.2 0.1 0.2\n\n")
    assert len(parse_label(txt)) == 1
