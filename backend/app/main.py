import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.core.audit import AuditMiddleware
from app.core.database import close_pool, init_pool
from app.core.error_handler import register_error_handlers
from app.routes import auth, cases, messages, opinions, payments, upload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_pool()
    logger.info("Database pool ready (%s)", settings.environment)
    yield
    await close_pool()
    logger.info("Database pool closed")


app = FastAPI(
    title="Ask Your DocAI",
    description=(
        "Piattaforma italiana di revisione clinica documentale delle ipotesi "
        "diagnostiche emerse da ChatGPT. Nessuna AI nel percorso clinico."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(auth.router, prefix="/v1/auth", tags=["auth"])
app.include_router(cases.router, prefix="/v1/cases", tags=["cases"])
app.include_router(messages.router, prefix="/v1/cases", tags=["messages"])
app.include_router(upload.router, prefix="/v1/cases", tags=["upload"])
app.include_router(opinions.router, prefix="/v1/clinical", tags=["clinical"])
app.include_router(payments.router, prefix="/v1/payments", tags=["payments"])


@app.get("/health", tags=["ops"])
async def health() -> dict:
    return {"status": "ok", "timestamp": settings.now_iso()}
