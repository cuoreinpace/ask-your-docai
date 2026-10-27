import uuid
from datetime import datetime, timezone


def now_iso() -> str:
    """ISO-8601 string, for API responses only."""
    return datetime.now(timezone.utc).isoformat()


def db_now() -> datetime:
    """Timezone-aware datetime, for PostgreSQL timestamptz parameters."""
    return datetime.now(timezone.utc)


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"
