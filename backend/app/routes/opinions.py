from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer
from app.schemas import (
    OpinionCreate, OpinionResponse, AssessmentOfAiOutput,
    PhysicianAssignedUrgency,
)
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


async def require_strong_auth(user: dict):
    if user.get("identity_level") != "STRONG":
        raise HTTPException(status_code=403, detail="Strong authentication required")


@router.post("/cases/{case_id}/opinions", status_code=status.HTTP_201_CREATED, response_model=OpinionResponse)
async def create_opinion(case_id: str, opinion: OpinionCreate, user=Depends(get_current_user)):
    await require_role(user, "PHYSICIAN")

    assignment = await execute_query(
        "SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL",
        [case_id, user["sub"]],
    )
    if not assignment:
        raise HTTPException(status_code=403, detail="Not assigned to this case")

    case_result = await execute_query("SELECT * FROM medical_cases WHERE id = $1", [case_id])
    if not case_result:
        raise HTTPException(status_code=404, detail="Case not found")

    opinion_id = generate_id("opn_")

    await execute_query(
        """INSERT INTO medical_opinions
           (id, case_id, physician_id, assessment_of_ai_output, clinical_assessment,
            limitations, recommendations, requires_in_person_assessment,
            physician_assigned_urgency, clinical_decision_source, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'HUMAN_PHYSICIAN', 'DRAFT', $10)""",
        [opinion_id, case_id, user["sub"], opinion.assessment_of_ai_output.value,
         opinion.clinical_assessment, opinion.limitations, opinion.recommendations,
         opinion.requires_in_person_assessment, opinion.physician_assigned_urgency.value,
         now_iso()],
    )

    await execute_query(
        "UPDATE medical_cases SET status = 'OPINION_DRAFT', version = version + 1 WHERE id = $1",
        [case_id],
    )

    return OpinionResponse(
        id=opinion_id,
        case_id=case_id,
        physician_id=user["sub"],
        assessment_of_ai_output=opinion.assessment_of_ai_output.value,
        clinical_assessment=opinion.clinical_assessment,
        limitations=opinion.limitations,
        recommendations=opinion.recommendations,
        requires_in_person_assessment=opinion.requires_in_person_assessment,
        physician_assigned_urgency=opinion.physician_assigned_urgency.value,
        clinical_decision_source="HUMAN_PHYSICIAN",
        status="DRAFT",
        created_at=now_iso(),
        finalized_at=None,
        signed_at=None,
    )


@router.put("/opinions/{opinion_id}", response_model=OpinionResponse)
async def update_opinion(opinion_id: str, opinion: OpinionCreate, user=Depends(get_current_user)):
    await require_role(user, "PHYSICIAN")

    existing = await execute_query(
        "SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2",
        [opinion_id, user["sub"]],
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Opinion not found or not owned")

    existing_data = existing[0]
    if existing_data["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft opinions can be updated")

    await execute_query(
        """UPDATE medical_opinions SET
           assessment_of_ai_output = $1, clinical_assessment = $2,
           limitations = $3, recommendations = $4,
           requires_in_person_assessment = $5, physician_assigned_urgency = $6,
           finalized_at = $7
           WHERE id = $8""",
        [opinion.assessment_of_ai_output.value, opinion.clinical_assessment,
         opinion.limitations, opinion.recommendations,
         opinion.requires_in_person_assessment, opinion.physician_assigned_urgency.value,
         now_iso(), opinion_id],
    )

    return OpinionResponse(
        id=opinion_id,
        case_id=existing_data["case_id"],
        physician_id=user["sub"],
        assessment_of_ai_output=opinion.assessment_of_ai_output.value,
        clinical_assessment=opinion.clinical_assessment,
        limitations=opinion.limitations,
        recommendations=opinion.recommendations,
        requires_in_person_assessment=opinion.requires_in_person_assessment,
        physician_assigned_urgency=opinion.physician_assigned_urgency.value,
        clinical_decision_source="HUMAN_PHYSICIAN",
        status="DRAFT",
        created_at=existing_data["created_at"],
        finalized_at=None,
        signed_at=None,
    )


@router.post("/opinions/{opinion_id}/finalize", response_model=OpinionResponse)
async def finalize_opinion(opinion_id: str, user=Depends(get_current_user)):
    await require_role(user, "PHYSICIAN")

    existing = await execute_query(
        "SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2",
        [opinion_id, user["sub"]],
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Opinion not found")

    existing_data = existing[0]
    if existing_data["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft opinions can be finalized")

    await execute_query(
        "UPDATE medical_opinions SET status = 'FINALIZED', finalized_at = $1 WHERE id = $2",
        [now_iso(), opinion_id],
    )

    return OpinionResponse(
        id=opinion_id,
        case_id=existing_data["case_id"],
        physician_id=user["sub"],
        assessment_of_ai_output=existing_data["assessment_of_ai_output"],
        clinical_assessment=existing_data["clinical_assessment"],
        limitations=existing_data["limitations"],
        recommendations=existing_data["recommendations"],
        requires_in_person_assessment=existing_data["requires_in_person_assessment"],
        physician_assigned_urgency=existing_data["physician_assigned_urgency"],
        clinical_decision_source=existing_data["clinical_decision_source"],
        status="FINALIZED",
        created_at=existing_data["created_at"],
        finalized_at=now_iso(),
        signed_at=None,
    )


@router.post("/opinions/{opinion_id}/sign", response_model=OpinionResponse)
async def sign_opinion(opinion_id: str, user=Depends(get_current_user)):
    await require_role(user, "PHYSICIAN")
    await require_strong_auth(user)

    existing = await execute_query(
        "SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2",
        [opinion_id, user["sub"]],
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Opinion not found")

    existing_data = existing[0]
    if existing_data["status"] != "FINALIZED":
        raise HTTPException(status_code=409, detail="Only finalized opinions can be signed")

    signature_id = generate_id("sig_")

    await execute_query(
        """INSERT INTO signature_artifacts
           (id, opinion_version_id, document_hash, signature_type, signed_at, qtsp_transaction_id)
           VALUES ($1, $2, $3, 'PAdES_QUALIFIED', $4, $5)""",
        [signature_id, opinion_id, f"sha256:{generate_id()}", now_iso(), None],
    )

    await execute_query(
        "UPDATE medical_opinions SET status = 'SIGNED', signed_at = $1 WHERE id = $2",
        [now_iso(), opinion_id],
    )

    await execute_query(
        "UPDATE medical_cases SET status = 'SIGNED', signed_at = $1, version = version + 1 WHERE id = $2",
        [now_iso(), existing_data["case_id"]],
    )

    return OpinionResponse(
        id=opinion_id,
        case_id=existing_data["case_id"],
        physician_id=user["sub"],
        assessment_of_ai_output=existing_data["assessment_of_ai_output"],
        clinical_assessment=existing_data["clinical_assessment"],
        limitations=existing_data["limitations"],
        recommendations=existing_data["recommendations"],
        requires_in_person_assessment=existing_data["requires_in_person_assessment"],
        physician_assigned_urgency=existing_data["physician_assigned_urgency"],
        clinical_decision_source=existing_data["clinical_decision_source"],
        status="SIGNED",
        created_at=existing_data["created_at"],
        finalized_at=existing_data["finalized_at"],
        signed_at=now_iso(),
    )


@router.get("/cases/{case_id}/opinion", response_model=OpinionResponse)
async def get_opinion(case_id: str, user=Depends(get_current_user)):
    result = await execute_query("SELECT * FROM medical_cases WHERE id = $1", [case_id])
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

    opinion_result = await execute_query(
        "SELECT * FROM medical_opinions WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1",
        [case_id],
    )

    if not opinion_result:
        return None

    o = opinion_result[0]
    return OpinionResponse(
        id=o["id"],
        case_id=o["case_id"],
        physician_id=o["physician_id"],
        assessment_of_ai_output=o["assessment_of_ai_output"],
        clinical_assessment=o["clinical_assessment"],
        limitations=o["limitations"],
        recommendations=o["recommendations"],
        requires_in_person_assessment=o["requires_in_person_assessment"],
        physician_assigned_urgency=o["physician_assigned_urgency"],
        clinical_decision_source=o["clinical_decision_source"],
        status=o["status"],
        created_at=o["created_at"],
        finalized_at=o["finalized_at"],
        signed_at=o["signed_at"],
    )


@router.get("/opinions/{opinion_id}/document")
async def get_opinion_document(opinion_id: str, user=Depends(get_current_user)):
    opinion = await execute_query(
        "SELECT * FROM medical_opinions WHERE id = $1", [opinion_id]
    )
    if not opinion:
        raise HTTPException(status_code=404, detail="Opinion not found")

    opinion_data = opinion[0]

    if user.get("role") not in ("ADMIN", "PRIVACY"):
        case_result = await execute_query(
            "SELECT * FROM medical_cases WHERE id = $1", [opinion_data["case_id"]]
        )
        case_data = case_result[0]

        if case_data["patient_id"] != user["sub"]:
            assignment = await execute_query(
                "SELECT 1 FROM case_assignments WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL",
                [opinion_data["case_id"], user["sub"]],
            )
            if not assignment:
                raise HTTPException(status_code=403, detail="Access denied")

    return {
        "opinionId": opinion_id,
        "caseId": opinion_data["case_id"],
        "status": opinion_data["status"],
        "documentUrl": f"/v1/opinions/{opinion_id}/document.pdf",
        "signedAt": opinion_data["signed_at"],
    }