from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import time
import uuid
from app.config import settings


async def audit_middleware(request: Request, call_next):
    start_time = time.time()
    request_id = str(uuid.uuid4())

    response: Response = await call_next(request)

    if settings.audit_log_enabled:
        # Audit logging would go here in production
        pass

    response.headers["X-Request-Id"] = request_id
    return response