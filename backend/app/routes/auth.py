from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.schemas import UserCreate, UserLogin, UserResponse
from app.core.database import execute_query
from app.utils.helpers import generate_id, now_iso
import bcrypt
import jwt
from app.config import settings

router = APIRouter()
security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    existing = await execute_query(
        "SELECT id FROM users WHERE email = $1", [user_data.email]
    )
    if existing:
        raise HTTPException(status_code=409, detail="Email already exists")

    password_hash = bcrypt.hashpw(user_data.password.encode(), bcrypt.gensalt()).decode()
    user_id = generate_id("usr_")

    await execute_query(
        """INSERT INTO users (id, email, password_hash, role, email_verified, identity_level, created_at)
           VALUES ($1, $2, $3, $4, false, 'BASIC', $5)""",
        [user_id, user_data.email, password_hash, user_data.role.value, now_iso()],
    )

    if user_data.role.value == "PATIENT" and user_data.birth_date and user_data.country:
        await execute_query(
            "INSERT INTO patient_profiles (user_id, birth_date, country, locale) VALUES ($1, $2, $3, $4)",
            [user_id, user_data.birth_date, user_data.country, "it-IT"],
        )

    token = jwt.encode(
        {"sub": user_id, "role": user_data.role.value, "identity_level": "BASIC"},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    return UserResponse(
        id=user_id,
        role=user_data.role.value,
        email=user_data.email,
        email_verified=False,
        identity_level="BASIC",
        created_at=now_iso(),
    )


@router.post("/login")
async def login(user_data: UserLogin):
    result = await execute_query(
        "SELECT id, email, password_hash, role, email_verified, identity_level FROM users WHERE email = $1",
        [user_data.email],
    )
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = result[0]
    if not bcrypt.checkpw(user_data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = jwt.encode(
        {"sub": user["id"], "role": user["role"], "identity_level": user["identity_level"]},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )

    return UserResponse(
        id=user["id"],
        role=user["role"],
        email=user["email"],
        email_verified=user["email_verified"],
        identity_level=user["identity_level"],
        created_at=user["created_at"],
    )


@router.get("/me")
async def get_me(user=Depends(get_current_user)):
    result = await execute_query(
        "SELECT id, email, role, email_verified, identity_level, created_at FROM users WHERE id = $1",
        [user["sub"]],
    )
    if not result:
        raise HTTPException(status_code=404, detail="User not found")

    u = result[0]
    return UserResponse(
        id=u["id"],
        role=u["role"],
        email=u["email"],
        email_verified=u["email_verified"],
        identity_level=u["identity_level"],
        created_at=u["created_at"],
    )