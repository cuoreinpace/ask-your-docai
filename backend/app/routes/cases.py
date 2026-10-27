from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import HTTPBearer
from app.schemas import CaseCreate, CaseResponse, MessageCreate, MessageResponse
from app.core.database import execute_query
from app.utils.helpers import generate_id, now_iso
from app.config import settings
import uuid

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


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CaseResponse)
async def create_case(case_data: CaseCreate, user=Depends(get_current_user)):
    await require_role(user, "PATIENT")

    if not case_data.service_scope_acknowledged:
        raise HTTPException(status_code=422, detail="Service scope must be acknowledged")

    case_id = generate_id("case_")

    await execute_query(
        """INSERT INTO medical_cases (id, patient_id, service_code, status, patient_summary, version, created_at)
           VALUES ($1, $2, $3, 'DRAFT', $4, 1, $5)""",
        [case_id, user["sub"], case_data.service_code, case_data.patient_summary, now_iso()],
    )

    if case_data.source:
        await execute_query(
            """INSERT INTO case_sources (id, case_id, category, declared_provider, source_type, provenance_verified, uploaded_at)
               VALUES ($1, $2, 'AI_CONVERSATION', $3, $4, $5, $6)""",
            [str(uuid.uuid4()), case_id, case_data.source.get("declared_provider", "unknown"),
             case_data.source.get("source_type", "USER_PASTED_TEXT"),
             case_data.source.get("provenance_verified", False), now_iso()],
        )

    return CaseResponse(
        id=case_id,
        patient_id=user["sub"],
        service_code=case_data.service_code,
        status="DRAFT",
        patient_summary=case_data.patient_summary,
        assigned_physician_id=None,
        version=1,
        created_at=now_iso(),
        submitted_at=None,
        accepted_at=None,
        signed_at=None,
        delivered_at=None,
    )


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(case_id: str, user=Depends(get_current_user)):
    result = await execute_query(
        "SELECT * FROM medical_cases WHERE id = $1", [case_id]
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    case_data = result[0]

    if user.get("role") not in ("ADMIN", "PRIVACY") and case_data["patient_id"] != user["sub"]:
        assignment = await execute_query(
            "SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL",
            [case_id, user["sub"]],
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")

    return CaseResponse(
        id=case_data["id"],
        patient_id=case_data["patient_id"],
        service_code=case_data["service_code"],
        status=case_data["status"],
        patient_summary=case_data["patient_summary"],
        assigned_physician_id=case_data["assigned_physician_id"],
        version=case_data["version"],
        created_at=case_data["created_at"],
        submitted_at=case_data["submitted_at"],
        accepted_at=case_data["accepted_at"],
        signed_at=case_data["signed_at"],
        delivered_at=case_data["delivered_at"],
    )


@router.post("/{case_id}/submit", response_model=CaseResponse)
async def submit_case(case_id: str, user=Depends(get_current_user)):
    await require_role(user, "PATIENT")

    result = await execute_query(
        "SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2",
        [case_id, user["sub"]],
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    case_data = result[0]
    if case_data["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail=f"Case is in {case_data['status']} state")

    await execute_query(
        "UPDATE medical_cases SET status = 'SUBMITTED', submitted_at = $1, version = version + 1 WHERE id = $2",
        [now_iso(), case_id],
    )

    return await get_case(case_id, user)


@router.post("/{case_id}/upload")
async def init_upload(case_id: str, user=Depends(get_current_user)):
    await require_role(user, "PATIENT")

    result = await execute_query(
        "SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2",
        [case_id, user["sub"]],
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    upload_id = generate_id("upl_")
    expires_at = now_iso()  # In production, use datetime.now + 15 minutes

    return {
        "upload_id": upload_id,
        "upload_url": f"{settings.frontend_url}/upload/{upload_id}",
        "expires_at": expires_at,
        "max_size_bytes": settings.upload_max_size_bytes,
        "status": "AWAITING_UPLOAD",
    }


@router.post("/{case_id}/messages", status_code=status.HTTP_201_CREATED, response_model=MessageResponse)
async def create_message(case_id: str, message: MessageCreate, user=Depends(get_current_user)):
    result = await execute_query(
        "SELECT * FROM medical_cases WHERE id = $1", [case_id]
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    if user.get("role") == "PHYSICIAN":
        assignment = await execute_query(
            "SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL",
            [case_id, user["sub"]],
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="Not assigned to this case")

    message_id = generate_id("msg_")

    await execute_query(
        """INSERT INTO clinical_messages (id, case_id, sender_id, sender_role, content, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        [message_id, case_id, user["sub"], user.get("role", "PATIENT"), message.content, now_iso()],
    )

    return MessageResponse(
        id=message_id,
        case_id=case_id,
        sender_id=user["sub"],
        sender_role=user.get("role", "PATIENT"),
        content=message.content,
        created_at=now_iso(),
    )


@router.get("/{case_id}/messages", response_model=list[MessageResponse])
async def get_messages(case_id: str, user=Depends(get_current_user)):
    result = await execute_query(
        "SELECT * FROM medical_cases WHERE id = $1", [case_id]
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    case_data = result[0]

    if user.get("role") not in ("ADMIN", "PRIVACY") and case_data["patient_id"] != user["sub"]:
        assignment = await execute_query(
            "SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL",
            [case_id, user["sub"]],
        )
        if not assignment:
            raise HTTPException(status_code=403, detail="Access denied")

    rows = await execute_query(
        "SELECT * FROM clinical_messages WHERE case_id = $1 ORDER BY created_at ASC",
        [case_id],
    )

    return [
        MessageResponse(
            id=r["id"],
            case_id=r["case_id"],
            sender_id=r["sender_id"],
            sender_role=r["sender_role"],
            content=r["content"],
            created_at=r["created_at"],
        )
        for r in rows
    ]