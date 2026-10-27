from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings
from app.core.database import fetchrow

security = HTTPBearer(auto_error=False)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Missing or invalid authorization header",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    if credentials is None:
        raise CREDENTIALS_EXCEPTION
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await fetchrow(
        "SELECT id, email, role, email_verified, identity_level FROM users WHERE id = $1",
        [payload.get("sub")],
    )
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")
    return dict(user)


def require_role(*roles: str):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles and user["role"] != "ADMIN":
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user

    return checker


async def require_strong_auth(user: dict = Depends(get_current_user)) -> dict:
    if user["identity_level"] != "STRONG":
        raise HTTPException(
            status_code=403,
            detail="Strong authentication required for this operation",
        )
    return user


async def ensure_case_access(case_id: str, user: dict) -> dict:
    """Return the case if the user is the patient owner, an assigned physician,
    or an admin/privacy operator."""
    case = await fetchrow("SELECT * FROM medical_cases WHERE id = $1", [case_id])
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    if user["role"] in ("ADMIN", "PRIVACY"):
        return dict(case)
    if case["patient_id"] == user["id"]:
        return dict(case)

    assignment = await fetchrow(
        """SELECT 1 FROM case_assignments
           WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL""",
        [case_id, user["id"]],
    )
    if assignment is None:
        raise HTTPException(status_code=403, detail="Access denied for this case")
    return dict(case)
