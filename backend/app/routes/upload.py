from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import HTTPBearer
from app.schemas import UploadSessionResponse
from app.core.database import execute_query
from app.utils.helpers import generate_id, now_iso
from app.config import settings
import uuid
import hashlib

router = APIRouter()
security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = credentials.credentials
    import jwt
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_role(user: dict, *roles: str):
    if user.get("role") not in roles and user.get("role") != "ADMIN":
        raise HTTPException(status_code=403, detail="Insufficient permissions")


@router.post("/{case_id}/uploads")
async def init_upload(case_id: str, user=Depends(get_current_user)):
    await require_role(user, "PATIENT")

    result = await execute_query(
        "SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2",
        [case_id, user["sub"]],
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    upload_id = generate_id("upl_")

    return UploadSessionResponse(
        upload_id=upload_id,
        upload_url=f"{settings.frontend_url}/upload/{upload_id}",
        expires_at=now_iso(),
        max_size_bytes=settings.upload_max_size_bytes,
        status="AWAITING_UPLOAD",
    )


@router.post("/{case_id}/uploads/{upload_id}/complete")
async def complete_upload(
    case_id: str,
    upload_id: str,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
):
    await require_role(user, "PATIENT")

    result = await execute_query(
        "SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2",
        [case_id, user["sub"]],
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()

    await execute_query(
        """INSERT INTO case_sources
           (id, case_id, category, media_type, sha256, provenance_verified, malware_scan_status, uploaded_at, object_storage_key)
           VALUES ($1, $2, 'AI_CONVERSATION', $3, $4, false, 'PENDING', $5, $6)""",
        [str(uuid.uuid4()), case_id, file.content_type, file_hash, now_iso(),
         f"quarantine/{case_id}/{upload_id}"],
    )

    return {
        "uploadId": upload_id,
        "caseId": case_id,
        "filename": file.filename,
        "mediaType": file.content_type,
        "sizeBytes": len(content),
        "sha256": file_hash,
        "malwareScanStatus": "PENDING",
        "uploadedAt": now_iso(),
    }