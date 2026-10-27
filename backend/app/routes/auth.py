import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, status

from app.config import settings
from app.core.database import conn_execute, fetchrow, transaction
from app.core.deps import get_current_user
from app.schemas import AuthResponse, UserCreate, UserLogin
from app.utils.helpers import db_now, generate_id, now_iso

router = APIRouter()


def _issue_token(user_id: str, role: str, identity_level: str) -> str:
    return jwt.encode(
        {"sub": user_id, "role": role, "identity_level": identity_level},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=AuthResponse)
async def register(payload: UserCreate):
    if payload.role.value == "PHYSICIAN":
        raise HTTPException(
            status_code=403,
            detail="Physician accounts are provisioned by clinical operations after credentialing",
        )

    existing = await fetchrow("SELECT id FROM users WHERE email = $1", [payload.email])
    if existing is not None:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    if payload.role.value == "PATIENT" and payload.birth_date is None:
        raise HTTPException(status_code=422, detail="Birth date is required for patient accounts")

    user_id = generate_id("usr_")
    password_hash = bcrypt.hashpw(payload.password.encode(), bcrypt.gensalt()).decode()

    async with transaction() as conn:
        await conn_execute(
            conn,
            """INSERT INTO users (id, email, password_hash, role, email_verified, identity_level, created_at)
               VALUES ($1, $2, $3, $4, false, 'BASIC', $5)""",
            [user_id, payload.email, password_hash, payload.role.value, db_now()],
        )
        if payload.role.value == "PATIENT" and payload.birth_date is not None:
            await conn_execute(
                conn,
                """INSERT INTO patient_profiles (user_id, birth_date, country, locale)
                   VALUES ($1, $2, $3, 'it-IT')""",
                [user_id, payload.birth_date, payload.country or "ITA"],
            )

    return AuthResponse(
        id=user_id,
        role=payload.role.value,
        email=payload.email,
        email_verified=False,
        identity_level="BASIC",
        created_at=now_iso(),
        token=_issue_token(user_id, payload.role.value, "BASIC"),
    )


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    user = await fetchrow(
        """SELECT id, email, password_hash, role, email_verified, identity_level, created_at
           FROM users WHERE email = $1""",
        [payload.email],
    )
    if user is None or not user["password_hash"]:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not bcrypt.checkpw(payload.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return AuthResponse(
        id=user["id"],
        role=user["role"],
        email=user["email"],
        email_verified=user["email_verified"],
        identity_level=user["identity_level"],
        created_at=user["created_at"].isoformat() if hasattr(user["created_at"], "isoformat") else str(user["created_at"]),
        token=_issue_token(user["id"], user["role"], user["identity_level"]),
    )


@router.get("/me")
async def me(user=Depends(get_current_user)) -> dict:
    row = await fetchrow(
        "SELECT id, email, role, email_verified, identity_level, created_at FROM users WHERE id = $1",
        [user["id"]],
    )
    return {
        "id": row["id"],
        "email": row["email"],
        "role": row["role"],
        "email_verified": row["email_verified"],
        "identity_level": row["identity_level"],
        "created_at": row["created_at"].isoformat(),
    }
