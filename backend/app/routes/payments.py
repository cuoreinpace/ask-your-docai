from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPBearer
from app.schemas import PaymentAuthorize, PaymentResponse
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


@router.post("/authorization", status_code=201)
async def authorize_payment(payment: PaymentAuthorize, user=Depends(get_current_user)):
    await require_role(user, "PATIENT")

    case_id = Query(None, embed=True)

    result = await execute_query(
        "SELECT * FROM medical_cases WHERE id = $1 AND patient_id = $2",
        [case_id, user["sub"]],
    )
    if not result:
        raise HTTPException(status_code=404, detail="Case not found")

    payment_id = generate_id("pay_")
    merchant_reference = f"ord_{uuid.uuid4().hex[:12]}"

    await execute_query(
        """INSERT INTO payments (id, case_id, provider_reference, amount_cents, currency, status, created_at)
           VALUES ($1, $2, $3, $4, $5, 'AUTHORIZED', $6)""",
        [payment_id, case_id, merchant_reference, payment.amount_cents, payment.currency, now_iso()],
    )

    return PaymentResponse(
        id=payment_id,
        case_id=case_id,
        provider_reference=merchant_reference,
        amount_cents=payment.amount_cents,
        currency=payment.currency,
        status="AUTHORIZED",
        client_secret=f"pi_{uuid.uuid4().hex[:16]}",
        created_at=now_iso(),
    )


@router.post("/webhooks/payment-provider")
async def payment_webhook():
    return {"received": True}


@router.get("/{payment_id}")
async def get_payment(payment_id: str, user=Depends(get_current_user)):
    result = await execute_query(
        """SELECT p.* FROM payments p
           JOIN medical_cases c ON p.case_id = c.id
           WHERE p.id = $1 AND c.patient_id = $2""",
        [payment_id, user["sub"]],
    )
    if not result:
        raise HTTPException(status_code=404, detail="Payment not found")

    p = result[0]
    return PaymentResponse(
        id=p["id"],
        case_id=p["case_id"],
        provider_reference=p["provider_reference"],
        amount_cents=p["amount_cents"],
        currency=p["currency"],
        status=p["status"],
        client_secret=None,
        created_at=p["created_at"],
    )