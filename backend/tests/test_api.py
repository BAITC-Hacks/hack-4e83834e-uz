from app.config import SAMPLE_IMAGES_DIR

SAMPLE_IMAGE = SAMPLE_IMAGES_DIR / "otro_bache.jpg"


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_segments_list(client):
    resp = client.get("/segments")
    assert resp.status_code == 200
    segments = resp.json()
    assert len(segments) == 1
    assert segments[0]["district"] == "Almaly"


def test_detect_creates_open_defect_with_explanation(client):
    with open(SAMPLE_IMAGE, "rb") as f:
        resp = client.post(
            "/defects/detect",
            data={"segment_id": 1, "source": "inspection"},
            files={"file": ("otro_bache.jpg", f, "image/jpeg")},
        )
    assert resp.status_code == 200
    defects = resp.json()
    assert len(defects) >= 1
    defect = defects[0]
    assert defect["status"] == "open"
    assert defect["explanation"]
    assert abs(sum(defect["score_breakdown_pct"].values()) - 100.0) < 0.5


def test_queue_reflects_created_defect_and_review_removes_it(client):
    with open(SAMPLE_IMAGE, "rb") as f:
        client.post(
            "/defects/detect",
            data={"segment_id": 1, "source": "inspection"},
            files={"file": ("otro_bache.jpg", f, "image/jpeg")},
        )

    queue = client.get("/queue?status=open").json()
    assert len(queue) >= 1
    defect_id = queue[0]["defect"]["id"]

    # Constraint: review requires an explicit reviewer identity.
    bad = client.post(f"/defects/{defect_id}/review", json={"action": "approve", "reviewer_name": ""})
    assert bad.status_code == 400

    good = client.post(
        f"/defects/{defect_id}/review",
        json={"action": "approve", "reviewer_name": "A. Zhaksybekov", "comment": "confirmed"},
    )
    assert good.status_code == 200
    assert good.json()["status"] == "scheduled"

    history = client.get(f"/defects/{defect_id}/history").json()
    assert len(history) == 1
    assert history[0]["action"] == "approve"
    assert history[0]["reviewer_name"] == "A. Zhaksybekov"

    queue_after = client.get("/queue?status=open").json()
    assert defect_id not in [item["defect"]["id"] for item in queue_after]


def test_repeat_report_matches_existing_open_defect(client):
    with open(SAMPLE_IMAGE, "rb") as f:
        first = client.post(
            "/reports",
            data={"segment_id": 1, "source": "citizen"},
            files={"file": ("otro_bache.jpg", f, "image/jpeg")},
        ).json()
    assert first["matched_existing_defect"] is False

    with open(SAMPLE_IMAGE, "rb") as f:
        second = client.post(
            "/reports",
            data={"segment_id": 1, "source": "citizen"},
            files={"file": ("otro_bache.jpg", f, "image/jpeg")},
        ).json()
    assert second["matched_existing_defect"] is True
    assert second["defect"]["id"] == first["defect"]["id"]
    assert second["defect"]["num_reports"] == 2
