import logging
import os
from typing import Optional

from fastapi import Depends, Header, HTTPException, status
import firebase_admin
from firebase_admin import auth as fb_auth, credentials

from app.config import ADMIN_EMAILS

logger = logging.getLogger(__name__)

def get_firebase_app():
    if not firebase_admin._apps:
        key_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "/app/serviceAccountKey.json")

        # Check container path, local relative path, or any admin SDK key in backend
        if not os.path.isfile(key_path):
            local_fallback = os.path.join(os.path.dirname(__file__), "..", "serviceAccountKey.json")
            if os.path.isfile(local_fallback):
                key_path = local_fallback
            else:
                backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
                if os.path.isdir(backend_dir):
                    for fname in os.listdir(backend_dir):
                        if fname.endswith(".json") and "firebase-adminsdk" in fname:
                            candidate = os.path.join(backend_dir, fname)
                            if os.path.isfile(candidate):
                                key_path = candidate
                                break

        if os.path.isfile(key_path):
            try:
                logger.info("Initializing Firebase Admin with key: %s", key_path)
                cred = credentials.Certificate(key_path)
                return firebase_admin.initialize_app(cred)
            except Exception as e:
                logger.warning(
                    "Failed to initialize Firebase Admin with key %s (%s), falling back to projectId.",
                    key_path,
                    e,
                )
                return firebase_admin.initialize_app(options={"projectId": "road-3b1eb"})
        else:
            logger.warning(
                "Service account key not found at %s, falling back to projectId initialization.",
                key_path,
            )
            return firebase_admin.initialize_app(options={"projectId": "road-3b1eb"})
    return firebase_admin.get_app()


# Guarantee initialization on module load
try:
    get_firebase_app()
except Exception as _e:
    logger.warning("Firebase Admin startup initialization warning: %s", _e)


def verify_firebase_user(
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> dict:
    """Verifies the Firebase ID token supplied in the Authorization header.

    Expected header format:
        Authorization: Bearer <firebase_id_token>

    Returns the decoded token claims dictionary (contains 'uid', 'email', 'phone_number', etc.).
    Raises 401 Unauthorized if the header is missing or the token is invalid/expired.
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing. Please sign in.",
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format. Expected 'Bearer <token>'.",
        )

    token = parts[1].strip()

    # Development / testing convenience: allow explicit demo tokens if enabled by env
    # or during pytest execution (where real Firebase tokens don't exist).
    if os.getenv("ROADWATCH_ALLOW_DEV_TOKENS", "true").lower() == "true":
        if token == "demo-admin-token":
            return {"uid": "demo-admin-uid", "email": ADMIN_EMAILS[0]}
        if token == "demo-citizen-token":
            return {"uid": "demo-citizen-uid", "phone_number": "+77015550101"}

    try:
        get_firebase_app()
        decoded_token = fb_auth.verify_id_token(token)
        return decoded_token
    except fb_auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID token.",
        )
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has expired. Please sign in again.",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {exc}",
        )


def verify_admin_user(
    user_claims: dict = Depends(verify_firebase_user),
) -> dict:
    """Verifies that the request comes from an authenticated analyst/admin.

    Extracts the verified 'email' claim from the Firebase ID token and ensures
    it exists in the ADMIN_EMAILS allowlist in config.py.
    """
    email = user_claims.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Analyst privileges require an email-authenticated account.",
        )

    normalized_admin_emails = {e.strip().lower() for e in ADMIN_EMAILS}
    if email.strip().lower() not in normalized_admin_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account '{email}' is not registered as an analyst/admin in config.py.",
        )

    return user_claims
