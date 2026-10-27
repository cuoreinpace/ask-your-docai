
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.database import conn_execute, execute, fetch, fetchrow, transaction
from app.core.deps import ensure_case_access, get_current_user, require_role
from app.schemas import CaseCreate, CaseResponse, CaseSourceResponse
from app.utils.helpers import db_now, generate_id, now_iso

router = APIRouter()


def _iso(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _case_payload(row) -> CaseResponse:
    return CaseResponse(
        id=row["id"],
        patient_id=row["patient_id"],
        service_code=row["service_code"],
        status=row["status"],
        patient_summary=row["patient_summary"] or "",
        assigned_physician_id=row["assigned_physician_id"],
        version=row["version"],
        created_at=_iso(row["created_at"]),
        submitted_at=_iso(row["submitted_at"]),
        accepted_at=_iso(row["accepted_at"]),
        signed_at=_iso(row["signed_at"]),
        delivered_at=_iso(row["delivered_at"]),
        has_opinion=row.get("has_opinion", False) if hasattr(row, "get") else False,
    )


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    status_filter: Optional[str] = Query(default=None, alias="status"),
    user=Depends(get_current_user),
):
    base = """
        SELECT c.*, EXISTS (SELECT 1 FROM medical_opinions o WHERE o.case_id = c.id) AS has_opinion
        FROM medical_cases c
    """
    params: list = []
    where: list[str] = []

    if user["role"] == "PATIENT":
        where.append("c.patient_id = $1")
        params.append(user["id"])
    elif user["role"] == "PHYSICIAN":
        if status_filter == "SUBMITTED":
            where.append("c.status = 'SUBMITTED'")
        else:
            where.append(
                """(c.assigned_physician_id = $1 OR EXISTS (
                       SELECT 1 FROM case_assignments a
                       WHERE a.case_id = c.id AND a.physician_id = $1 AND a.ended_at IS NULL))"""
            )
            params.append(user["id"])
    elif status_filter:
        where.append(f"c.status = ${len(params) + 1}")
        params.append(status_filter)

    query = base
    if where:
        query += " WHERE " + " AND ".join(where)
    query += " ORDER BY c.created_at DESC LIMIT 100"

    rows = await fetch(query, params)
    return [_case_payload(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED, response_model=CaseResponse)
async def create_case(payload: CaseCreate, user=Depends(require_role("PATIENT"))):
    if not payload.service_scope_acknowledged:
        raise HTTPException(status_code=422, detail="Service scope must be acknowledged")

    case_id = generate_id("case_")

    async with transaction() as conn:
        await conn_execute(conn, 
            """INSERT INTO medical_cases
               (id, patient_id, service_code, status, patient_summary, version, created_at)
               VALUES ($1, $2, $3, 'DRAFT', $4, 1, $5)""",
            [case_id, user["id"], payload.service_code, payload.patient_summary, db_now()],
        )
        if payload.source is not None:
            await conn_execute(conn, 
                """INSERT INTO case_sources
                   (id, case_id, category, declared_provider, source_type, pasted_text,
                    provenance_verified, malware_scan_status, uploaded_at)
                   VALUES ($1, $2, 'AI_CONVERSATION', $3, $4, $5, $6, 'PENDING', $7)""",
                [
                    generate_id("src_"),
                    case_id,
                    payload.source.declared_provider,
                    payload.source.source_type,
                    payload.source.pasted_text,
                    payload.source.provenance_verified,
                    db_now(),
                ],
            )

    row = await fetchrow(
        """SELECT c.*, EXISTS (SELECT 1 FROM medical_opinions o WHERE o.case_id = c.id) AS has_opinion
           FROM medical_cases c WHERE c.id = $1""",
        [case_id],
    )
    return _case_payload(row)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(case_id: str, user=Depends(get_current_user)):
    case = await ensure_case_access(case_id, user)
    row = await fetchrow(
        """SELECT c.*, EXISTS (SELECT 1 FROM medical_opinions o WHERE o.case_id = c.id) AS has_opinion
           FROM medical_cases c WHERE c.id = $1""",
        [case["id"]],
    )
    return _case_payload(row)


@router.post("/{case_id}/submit", response_model=CaseResponse)
async def submit_case(case_id: str, user=Depends(require_role("PATIENT"))):
    case = await ensure_case_access(case_id, user)
    if case["patient_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the patient owner can submit this case")
    if case["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail=f"Case is in {case['status']} state and cannot be submitted")

    await execute(
        """UPDATE medical_cases
           SET status = 'SUBMITTED', submitted_at = $1, version = version + 1
           WHERE id = $2""",
        [db_now(), case_id],
    )
    return await get_case(case_id, user)


@router.get("/{case_id}/sources", response_model=list[CaseSourceResponse])
async def list_sources(case_id: str, user=Depends(get_current_user)):
    await ensure_case_access(case_id, user)
    rows = await fetch(
        """SELECT * FROM case_sources WHERE case_id = $1 ORDER BY uploaded_at ASC""",
        [case_id],
    )
    return [
        CaseSourceResponse(
            id=r["id"],
            case_id=r["case_id"],
            category=r["category"],
            declared_provider=r["declared_provider"],
            source_type=r["source_type"],
            media_type=r["media_type"],
            pasted_text=r["pasted_text"],
            sha256=r["sha256"],
            malware_scan_status=r["malware_scan_status"],
            uploaded_at=_iso(r["uploaded_at"]),
        )
        for r in rows
    ]
