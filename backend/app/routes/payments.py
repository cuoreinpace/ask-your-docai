from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.database import execute, fetchrow
from app.core.deps import ensure_case_access, require_role
from app.schemas import PaymentAuthorize, PaymentResponse
from app.utils.helpers import db_now, generate_id, now_iso

router = APIRouter()


def _iso(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _payment_payload(row) -> PaymentResponse:
    return PaymentResponse(
        id=row["id"],
        case_id=row["case_id"],
        amount_cents=row["amount_cents"],
        currency=row["currency"],
        status=row["status"],
        created_at=_iso(row["created_at"]),
    )


@router.post("/authorization", status_code=status.HTTP_201_CREATED, response_model=PaymentResponse)
async def authorize_payment(payload: PaymentAuthorize, user=Depends(require_role("PATIENT"))):
    case = await ensure_case_access(payload.case_id, user)
    if case["patient_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only the patient owner can pay for this case")

    payment_id = generate_id("pay_")
    await execute(
        """INSERT INTO payments
           (id, case_id, provider_reference, amount_cents, currency, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'AUTHORIZED', $6)""",
        [
            payment_id,
            payload.case_id,
            generate_id("ord_"),
            payload.amount_cents,
            payload.currency,
            db_now(),
        ],
    )
    await execute(
        """UPDATE medical_cases SET status = 'PAYMENT_AUTHORIZED', version = version + 1
           WHERE id = $1""",
        [payload.case_id],
    )

    row = await fetchrow("SELECT * FROM payments WHERE id = $1", [payment_id])
    return _payment_payload(row)


@router.post("/webhooks/payment-provider")
async def payment_webhook(request: Request):
    # Production: verify PSP signature, timestamp and replay window before applying.
    body = await request.json()
    event = body.get("event")
    data = body.get("data", {})

    if event == "payment.succeeded" and data.get("paymentId"):
        await execute(
            "UPDATE payments SET status = 'SUCCEEDED', provider_reference = $1 WHERE id = $2",
            [data.get("transactionId"), data["paymentId"]],
        )
    elif event == "payment.failed" and data.get("paymentId"):
        await execute("UPDATE payments SET status = 'FAILED' WHERE id = $1", [data["paymentId"]])

    return {"received": True}


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(payment_id: str, user=Depends(require_role("PATIENT"))):
    row = await fetchrow(
        """SELECT p.* FROM payments p
           JOIN medical_cases c ON p.case_id = c.id
           WHERE p.id = $1 AND c.patient_id = $2""",
        [payment_id, user["id"]],
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Payment not found")
    return _payment_payload(row)
