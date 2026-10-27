from contextlib import asynccontextmanager
from typing import Any, Optional

import asyncpg
from app.config import settings

_pool: Optional[asyncpg.Pool] = None


async def init_pool() -> None:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=settings.database_url,
            min_size=1,
            max_size=10,
            command_timeout=30,
        )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool


async def fetch(query: str, params: Optional[list] = None) -> list[asyncpg.Record]:
    async with get_pool().acquire() as conn:
        return await conn.fetch(query, *(params or []))


async def fetchrow(query: str, params: Optional[list] = None) -> Optional[asyncpg.Record]:
    async with get_pool().acquire() as conn:
        return await conn.fetchrow(query, *(params or []))


async def execute(query: str, params: Optional[list] = None) -> str:
    async with get_pool().acquire() as conn:
        return await conn.execute(query, *(params or []))


@asynccontextmanager
async def transaction():
    async with get_pool().acquire() as conn:
        async with conn.transaction():
            yield conn


def record_to_dict(record: Any) -> dict:
    return dict(record) if record is not None else {}


async def conn_execute(conn, query: str, params: Optional[list] = None) -> str:
    """Execute a statement on an acquired connection, unpacking parameters."""
    return await conn.execute(query, *(params or []))
