"""Unit tests for detector.py's class-mapping logic, mocked at the model
I/O boundary so they don't depend on real (or real fine-tuned) weights."""
from types import SimpleNamespace

import app.detection.detector as detector_module


class _FakeBox:
    def __init__(self, cls_idx: int, conf: float, xyxy: list[float]):
        self.cls = SimpleNamespace(item=lambda: cls_idx)
        self.conf = SimpleNamespace(item=lambda: conf)
        self.xyxy = [SimpleNamespace(tolist=lambda: xyxy)]


class _FakeResult:
    def __init__(self, boxes, names, orig_shape):
        self.boxes = boxes
        self.names = names
        self.orig_shape = orig_shape


class _FakeModel:
    def __init__(self, result):
        self._result = result

    def predict(self, source, conf, verbose):
        return [self._result]


def _patch_fake_finetuned_model(monkeypatch, boxes, names):
    result = _FakeResult(boxes=boxes, names=names, orig_shape=(360, 640))
    fake_model = _FakeModel(result)
    monkeypatch.setattr(detector_module, "_load_model", lambda: (fake_model, "roadwatch-finetuned"))


def test_manhole_detections_are_discarded_never_become_defects(monkeypatch):
    names = {0: "pothole", 1: "crack", 2: "broken_curb", 3: "faded_marking", 4: "manhole"}
    boxes = [
        _FakeBox(cls_idx=0, conf=0.9, xyxy=[10, 10, 50, 50]),
        _FakeBox(cls_idx=4, conf=0.95, xyxy=[60, 60, 120, 120]),
    ]
    _patch_fake_finetuned_model(monkeypatch, boxes, names)

    detections = detector_module.detect("fake.jpg")

    assert [d.defect_class for d in detections] == ["pothole"]
    assert all(d.defect_class != "manhole" for d in detections)


def test_manhole_only_frame_yields_zero_detections(monkeypatch):
    names = {0: "pothole", 1: "crack", 2: "broken_curb", 3: "faded_marking", 4: "manhole"}
    boxes = [_FakeBox(cls_idx=4, conf=0.99, xyxy=[0, 0, 100, 100])]
    _patch_fake_finetuned_model(monkeypatch, boxes, names)

    assert detector_module.detect("fake.jpg") == []
