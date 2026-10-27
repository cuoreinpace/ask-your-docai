import logging
import uuid

import jwt
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.utils.helpers import db_now
from app.core.database import execute

logger = logging.getLogger(__name__)

AUDITED_PREFIXES = ("/v1/cases", "/v1/clinical", "/v1/payments", "/v1/auth/me")


class AuditMiddleware(BaseHTTPMiddleware):
    """Append-only best-effort audit trail.

    Never blocks a request and never stores clinical content: only actor,
    action, resource identifiers and outcome.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id

        if not settings.audit_log_enabled:
            return response
        if not request.url.path.startswith(AUDITED_PREFIXES):
            return response

        actor_id = None
        actor_role = "ANONYMOUS"
        auth_header = request.headers.get("authorization", "")
        if auth_header.lower().startswith("bearer "):
            try:
                payload = jwt.decode(
                    auth_header.split(" ", 1)[1],
                    settings.jwt_secret,
                    algorithms=[settings.jwt_algorithm],
                )
                actor_id = payload.get("sub")
                actor_role = payload.get("role", "ANONYMOUS")
            except jwt.InvalidTokenError:
                pass

        try:
            await execute(
                """INSERT INTO audit_events
                   (id, actor_id, actor_role, action, resource_type, resource_id,
                    case_id, authorization_basis, request_id, ip_hash, success, occurred_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
                [
                    f"aud_{uuid.uuid4().hex[:12]}",
                    actor_id,
                    actor_role,
                    f"{request.method} {request.url.path}",
                    "HTTP_REQUEST",
                    request.path_params.get("case_id") or request.path_params.get("id"),
                    request.path_params.get("case_id"),
                    "BEARER_TOKEN" if actor_id else "ANONYMOUS",
                    request_id,
                    None,
                    response.status_code < 400,
                    db_now(),
                ],
            )
        except Exception:  # pragma: no cover - audit must never break requests
            logger.warning("audit write failed", exc_info=True)

        return response
