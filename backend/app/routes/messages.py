from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import execute, fetch
from app.core.deps import ensure_case_access, get_current_user
from app.schemas import MessageCreate, MessageResponse
from app.utils.helpers import db_now, generate_id, now_iso

router = APIRouter()


def _iso(value) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    return None if value is None else str(value)


@router.post("/{case_id}/messages", status_code=status.HTTP_201_CREATED, response_model=MessageResponse)
async def create_message(case_id: str, payload: MessageCreate, user=Depends(get_current_user)):
    case = await ensure_case_access(case_id, user)

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=422, detail="Message content cannot be empty")

    message_id = generate_id("msg_")
    await execute(
        """INSERT INTO clinical_messages (id, case_id, sender_id, sender_role, content, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)""",
        [message_id, case["id"], user["id"], user["role"], content, db_now()],
    )

    return MessageResponse(
        id=message_id,
        case_id=case["id"],
        sender_id=user["id"],
        sender_role=user["role"],
        content=content,
        created_at=now_iso(),
    )


@router.get("/{case_id}/messages", response_model=list[MessageResponse])
async def list_messages(case_id: str, user=Depends(get_current_user)):
    await ensure_case_access(case_id, user)
    rows = await fetch(
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
            created_at=_iso(r["created_at"]),
        )
        for r in rows
    ]
