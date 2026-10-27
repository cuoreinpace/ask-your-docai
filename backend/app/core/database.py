import asyncpg
from app.config import settings


async def get_db():
    conn = await asyncpg.connect(settings.database_url)
    try:
        yield conn
    finally:
        await conn.close()


async def execute_query(query: str, params: list = None):
    conn = await asyncpg.connect(settings.database_url)
    try:
        result = await conn.fetch(query, *params) if params else await conn.fetch(query)
        return result
    finally:
        await conn.close()


async def execute_transaction(queries: list):
    conn = await asyncpg.connect(settings.database_url)
    try:
        await conn.execute("BEGIN")
        for q in queries:
            await conn.execute(q["query"], *q.get("params", []))
        await conn.execute("COMMIT")
    except Exception:
        await conn.execute("ROLLBACK")
        raise
    finally:
        await conn.close()