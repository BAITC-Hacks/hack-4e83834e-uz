"""Authentication helper endpoints for role checking.

Role verification for analysts uses an inspectable allowlist in config.py
rather than opaque custom claims or a database table, matching the project's
explicit-assumptions philosophy.
"""
from fastapi import APIRouter, Query

from app.config import ADMIN_EMAILS

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/check-admin")
def check_admin(email: str = Query(..., description="Email address of the authenticated user")):
    """Checks whether the supplied email is an authorized analyst/admin.

    Called after client-side Firebase email/password sign-in. This check does
    not require token verification because it exposes no sensitive data and
    performs no mutations - it merely informs the client whether the given
    email belongs to the analyst allowlist in app/config.py.
    """
    normalized_email = email.strip().lower()
    is_admin = normalized_email in {e.strip().lower() for e in ADMIN_EMAILS}
    return {"is_admin": is_admin}
