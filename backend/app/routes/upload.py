import hashlib
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.config import settings
from app.core.database import execute
from app.core.deps import ensure_case_access, require_role
from app.schemas import UploadSessionResponse
from app.utils.helpers import db_now, generate_id, now_iso

router = APIRouter()


@router.post("/{case_id}/uploads", response_model=UploadSessionResponse)
async def init_upload(case_id: str, user=Depends(require_role("PATIENT"))):
    case = await ensure_case_access(case_id, user)
    if case["patient_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the patient owner can upload documents")

    upload_id = generate_id("upl_")
    # In production this is a Cloud Storage signed URL (V4, 15 minutes TTL).
    return UploadSessionResponse(
        upload_id=upload_id,
        upload_url=f"/v1/cases/{case_id}/uploads/{upload_id}/complete",
        expires_at=now_iso(),
        max_size_bytes=settings.upload_max_size_bytes,
        status="AWAITING_UPLOAD",
    )


@router.post("/{case_id}/uploads/{upload_id}/complete")
async def complete_upload(
    case_id: str,
    upload_id: str,
    file: UploadFile = File(...),
    user=Depends(require_role("PATIENT")),
):
    case = await ensure_case_access(case_id, user)
    if case["patient_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the patient owner can upload documents")

    content = await file.read()
    if len(content) > settings.upload_max_size_bytes:
        raise HTTPException(status_code=413, detail="File exceeds the maximum allowed size")
    if not content:
        raise HTTPException(status_code=422, detail="Empty file")

    digest = hashlib.sha256(content).hexdigest()

    await execute(
        """INSERT INTO case_sources
           (id, case_id, category, media_type, sha256, provenance_verified,
            malware_scan_status, uploaded_at, object_storage_key)
           VALUES ($1, $2, 'AI_CONVERSATION', $3, $4, false, 'PENDING', $5, $6)""",
        [
            generate_id("src_"),
            case_id,
            file.content_type or "application/octet-stream",
            digest,
            db_now(),
            f"quarantine/{case_id}/{upload_id}/{uuid.uuid4().hex}",
        ],
    )

    return {
        "upload_id": upload_id,
        "case_id": case_id,
        "filename": file.filename,
        "media_type": file.content_type,
        "size_bytes": len(content),
        "sha256": digest,
        "malware_scan_status": "PENDING",
        "uploaded_at": now_iso(),
    }
