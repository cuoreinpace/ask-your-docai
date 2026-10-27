from datetime import datetime, timezone
from typing import Optional
import uuid


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:12]}"