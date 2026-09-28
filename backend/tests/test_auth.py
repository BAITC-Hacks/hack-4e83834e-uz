from fastapi.testclient import TestClient

from app.config import ADMIN_EMAILS
from app.firebase_auth import verify_admin_user, verify_firebase_user
from app.main import app


def test_check_admin_allowlist(client):
    # Testing known admin email
    admin_email = ADMIN_EMAILS[0]
    resp = client.get(f"/auth/check-admin?email={admin_email}")
    assert resp.status_code == 200
    assert resp.json() == {"is_admin": True}

    # Case-insensitive and trimmed check
    resp_upper = client.get(f"/auth/check-admin?email= {admin_email.upper()} ")
    assert resp_upper.status_code == 200
    assert resp_upper.json() == {"is_admin": True}

    # Non-admin email
    resp_non_admin = client.get("/auth/check-admin?email=random.citizen@example.com")
    assert resp_non_admin.status_code == 200
    assert resp_non_admin.json() == {"is_admin": False}


def test_unauthenticated_review_rejected():
    # Without test overrides, mutating endpoints require valid tokens
    with TestClient(app) as raw_client:
        resp = raw_client.post(
            "/defects/1/review",
            json={"action": "approve", "reviewer_name": "Test Analyst"},
        )
        assert resp.status_code == 401
        assert "Authorization header missing" in resp.json()["detail"]


def test_unauthenticated_report_rejected():
    with TestClient(app) as raw_client:
        resp = raw_client.post(
            "/reports",
            data={"segment_id": 1, "source": "citizen"},
        )
        assert resp.status_code == 401


def test_dev_tokens():
    with TestClient(app) as raw_client:
        # Dev admin token allows review (defect 9999 doesn't exist -> 404, not 401/403)
        resp = raw_client.post(
            "/defects/9999/review",
            headers={"Authorization": "Bearer demo-admin-token"},
            json={"action": "approve", "reviewer_name": "Admin"},
        )
        assert resp.status_code == 404  # passed auth, reached endpoint logic

        # Dev citizen token attempting review gets 403 (citizen cannot review defects)
        resp_citizen = raw_client.post(
            "/defects/9999/review",
            headers={"Authorization": "Bearer demo-citizen-token"},
            json={"action": "approve", "reviewer_name": "Citizen"},
        )
        assert resp_citizen.status_code == 403
