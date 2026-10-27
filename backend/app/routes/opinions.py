import hashlib
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import conn_execute, execute, fetchrow, transaction
from app.core.deps import (
    ensure_case_access,
    get_current_user,
    require_role,
    require_strong_auth,
)
from app.schemas import (
    EscalationInput,
    OpinionCreate,
    OpinionResponse,
    RequestInformation,
)
from app.utils.helpers import db_now, generate_id, now_iso

router = APIRouter()


def _iso(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _opinion_payload(row) -> OpinionResponse:
    return OpinionResponse(
        id=row["id"],
        case_id=row["case_id"],
        physician_id=row["physician_id"],
        assessment_of_ai_output=row["assessment_of_ai_output"],
        clinical_assessment=row["clinical_assessment"],
        limitations=list(row["limitations"] or []),
        recommendations=list(row["recommendations"] or []),
        requires_in_person_assessment=row["requires_in_person_assessment"],
        physician_assigned_urgency=row["physician_assigned_urgency"],
        clinical_decision_source=row["clinical_decision_source"],
        status=row["status"],
        created_at=_iso(row["created_at"]),
        finalized_at=_iso(row["finalized_at"]),
        signed_at=_iso(row["signed_at"]),
    )


async def _assigned_case(case_id: str, user: dict) -> dict:
    if user["role"] != "PHYSICIAN":
        raise HTTPException(status_code=403, detail="Physician role required")
    case = await fetchrow("SELECT * FROM medical_cases WHERE id = $1", [case_id])
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    assignment = await fetchrow(
        """SELECT 1 FROM case_assignments
           WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL""",
        [case_id, user["id"]],
    )
    if assignment is None:
        raise HTTPException(status_code=403, detail="You are not assigned to this case")
    return dict(case)


@router.post("/cases/{case_id}/accept")
async def accept_case(case_id: str, user=Depends(require_role("PHYSICIAN"))):
    case = await fetchrow("SELECT * FROM medical_cases WHERE id = $1", [case_id])
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    if case["status"] != "SUBMITTED":
        raise HTTPException(status_code=409, detail=f"Case is in {case['status']} state and cannot be accepted")

    existing = await fetchrow(
        """SELECT 1 FROM case_assignments
           WHERE case_id = $1 AND physician_id = $2 AND ended_at IS NULL""",
        [case_id, user["id"]],
    )

    async with transaction() as conn:
        if existing is None:
            await conn_execute(conn, 
                """INSERT INTO case_assignments (id, case_id, physician_id, assigned_at)
                   VALUES ($1, $2, $3, $4)""",
                [generate_id("asg_"), case_id, user["id"], db_now()],
            )
        await conn_execute(conn, 
            """UPDATE medical_cases
               SET status = 'IN_REVIEW', assigned_physician_id = $1,
                   accepted_at = COALESCE(accepted_at, $2), version = version + 1
               WHERE id = $3""",
            [user["id"], db_now(), case_id],
        )

    updated = await fetchrow("SELECT * FROM medical_cases WHERE id = $1", [case_id])
    return {
        "id": updated["id"],
        "status": updated["status"],
        "assigned_physician_id": updated["assigned_physician_id"],
        "accepted_at": _iso(updated["accepted_at"]),
    }


@router.post("/cases/{case_id}/request-information")
async def request_information(
    case_id: str,
    payload: RequestInformation,
    user=Depends(require_role("PHYSICIAN")),
):
    case = await _assigned_case(case_id, user)
    if case["status"] in ("SIGNED", "DELIVERED", "CLOSED"):
        raise HTTPException(status_code=409, detail="Signed cases cannot be reopened for information")

    questions = [q.text.strip() for q in payload.questions if q.text.strip()]
    if not questions:
        raise HTTPException(status_code=422, detail="At least one question is required")

    body = "Richiesta di integrazione clinica:\n" + "\n".join(f"- {q}" for q in questions)

    async with transaction() as conn:
        await conn_execute(conn, 
            """INSERT INTO clinical_messages (id, case_id, sender_id, sender_role, content, created_at)
               VALUES ($1, $2, $3, $4, $5, $6)""",
            [generate_id("msg_"), case_id, user["id"], user["role"], body, db_now()],
        )
        await conn_execute(conn, 
            """UPDATE medical_cases
               SET status = 'NEEDS_INFORMATION', version = version + 1
               WHERE id = $1""",
            [case_id],
        )

    return {"case_id": case_id, "status": "NEEDS_INFORMATION", "sla_paused_at": now_iso()}


@router.post("/cases/{case_id}/escalate")
async def escalate_case(
    case_id: str,
    payload: EscalationInput,
    user=Depends(require_role("PHYSICIAN")),
):
    await _assigned_case(case_id, user)

    await execute(
        """UPDATE medical_cases
           SET status = 'CLINICAL_ESCALATION', version = version + 1
           WHERE id = $1""",
        [case_id],
    )
    await execute(
        """INSERT INTO clinical_messages (id, case_id, sender_id, sender_role, content, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        [
            generate_id("msg_"),
            case_id,
            user["id"],
            user["role"],
            "Caso sottoposto a escalation clinica. Non utilizzare questo canale per emergenze: contattare il 112.",
            db_now(),
        ],
    )
    return {"case_id": case_id, "status": "CLINICAL_ESCALATION", "reason": payload.reason}


@router.post("/cases/{case_id}/opinions", status_code=status.HTTP_201_CREATED, response_model=OpinionResponse)
async def create_opinion(
    case_id: str,
    payload: OpinionCreate,
    user=Depends(require_role("PHYSICIAN")),
):
    await _assigned_case(case_id, user)

    opinion_id = generate_id("opn_")
    async with transaction() as conn:
        await conn_execute(conn, 
            """INSERT INTO medical_opinions
               (id, case_id, physician_id, assessment_of_ai_output, clinical_assessment,
                limitations, recommendations, requires_in_person_assessment,
                physician_assigned_urgency, clinical_decision_source, status, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'HUMAN_PHYSICIAN','DRAFT',$10)""",
            [
                opinion_id,
                case_id,
                user["id"],
                payload.assessment_of_ai_output.value,
                payload.clinical_assessment,
                payload.limitations,
                payload.recommendations,
                payload.requires_in_person_assessment,
                payload.physician_assigned_urgency.value,
                db_now(),
            ],
        )
        await conn_execute(conn, 
            """UPDATE medical_cases SET status = 'OPINION_DRAFT', version = version + 1 WHERE id = $1""",
            [case_id],
        )

    row = await fetchrow("SELECT * FROM medical_opinions WHERE id = $1", [opinion_id])
    return _opinion_payload(row)


@router.put("/opinions/{opinion_id}", response_model=OpinionResponse)
async def update_opinion(
    opinion_id: str,
    payload: OpinionCreate,
    user=Depends(require_role("PHYSICIAN")),
):
    row = await fetchrow(
        "SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2",
        [opinion_id, user["id"]],
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Opinion not found")
    if row["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft opinions can be updated")

    await execute(
        """UPDATE medical_opinions SET
           assessment_of_ai_output = $1, clinical_assessment = $2,
           limitations = $3, recommendations = $4,
           requires_in_person_assessment = $5, physician_assigned_urgency = $6
           WHERE id = $7""",
        [
            payload.assessment_of_ai_output.value,
            payload.clinical_assessment,
            payload.limitations,
            payload.recommendations,
            payload.requires_in_person_assessment,
            payload.physician_assigned_urgency.value,
            opinion_id,
        ],
    )
    updated = await fetchrow("SELECT * FROM medical_opinions WHERE id = $1", [opinion_id])
    return _opinion_payload(updated)


@router.post("/opinions/{opinion_id}/finalize", response_model=OpinionResponse)
async def finalize_opinion(opinion_id: str, user=Depends(require_role("PHYSICIAN"))):
    row = await fetchrow(
        "SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2",
        [opinion_id, user["id"]],
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Opinion not found")
    if row["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft opinions can be finalized")

    content_hash = hashlib.sha256(
        f"{opinion_id}|{row['clinical_assessment']}|{db_now()}".encode()
    ).hexdigest()

    async with transaction() as conn:
        await conn_execute(conn, 
            """INSERT INTO opinion_versions
               (id, opinion_id, version, assessment, clinical_assessment, limitations,
                recommendations, requires_in_person_assessment, physician_assigned_urgency,
                content_hash, finalized_at, created_at)
               VALUES ($1,$2,1,$3,$4,$5,$6,$7,$8,$9,$10,$10)""",
            [
                generate_id("opv_"),
                opinion_id,
                row["assessment_of_ai_output"],
                row["clinical_assessment"],
                list(row["limitations"] or []),
                list(row["recommendations"] or []),
                row["requires_in_person_assessment"],
                row["physician_assigned_urgency"],
                content_hash,
                db_now(),
            ],
        )
        await conn_execute(conn, 
            """UPDATE medical_opinions SET status = 'FINALIZED', finalized_at = $1 WHERE id = $2""",
            [db_now(), opinion_id],
        )

    updated = await fetchrow("SELECT * FROM medical_opinions WHERE id = $1", [opinion_id])
    return _opinion_payload(updated)


@router.post("/opinions/{opinion_id}/sign", response_model=OpinionResponse)
async def sign_opinion(
    opinion_id: str,
    user=Depends(require_role("PHYSICIAN")),
    _strong=Depends(require_strong_auth),
):
    row = await fetchrow(
        "SELECT * FROM medical_opinions WHERE id = $1 AND physician_id = $2",
        [opinion_id, user["id"]],
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Opinion not found")
    if row["status"] != "FINALIZED":
        raise HTTPException(status_code=409, detail="Only finalized opinions can be signed")

    version = await fetchrow(
        "SELECT * FROM opinion_versions WHERE opinion_id = $1 ORDER BY version DESC LIMIT 1",
        [opinion_id],
    )
    if version is None:
        raise HTTPException(status_code=409, detail="No finalized version to sign")

    async with transaction() as conn:
        await conn_execute(conn, 
            """INSERT INTO signature_artifacts
               (id, opinion_version_id, document_hash, signature_type, signed_at, qtsp_transaction_id)
               VALUES ($1,$2,$3,'PAdES_QUALIFIED',$4,$5)""",
            [
                generate_id("sig_"),
                version["id"],
                version["content_hash"],
                db_now(),
                f"qtsp_sim_{generate_id()}",
            ],
        )
        await conn_execute(conn, 
            """UPDATE medical_opinions SET status = 'SIGNED', signed_at = $1 WHERE id = $2""",
            [db_now(), opinion_id],
        )
        await conn_execute(conn, 
            """UPDATE medical_cases
               SET status = 'SIGNED', signed_at = $1, version = version + 1
               WHERE id = $2""",
            [db_now(), row["case_id"]],
        )

    updated = await fetchrow("SELECT * FROM medical_opinions WHERE id = $1", [opinion_id])
    return _opinion_payload(updated)


@router.get("/cases/{case_id}/opinion")
async def get_case_opinion(case_id: str, user=Depends(get_current_user)):
    await ensure_case_access(case_id, user)
    row = await fetchrow(
        "SELECT * FROM medical_opinions WHERE case_id = $1 ORDER BY created_at DESC LIMIT 1",
        [case_id],
    )
    return _opinion_payload(row) if row else None


@router.get("/opinions/{opinion_id}/document")
async def get_opinion_document(opinion_id: str, user=Depends(get_current_user)):
    row = await fetchrow("SELECT * FROM medical_opinions WHERE id = $1", [opinion_id])
    if row is None:
        raise HTTPException(status_code=404, detail="Opinion not found")
    await ensure_case_access(row["case_id"], user)

    return {
        "opinion_id": opinion_id,
        "case_id": row["case_id"],
        "status": row["status"],
        "document_url": f"/v1/clinical/opinions/{opinion_id}/document.pdf",
        "signed_at": _iso(row["signed_at"]),
    }
