from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import logging

from app.config import settings
from app.routes import auth, cases, opinions, messages, upload, payments
from app.core.audit import audit_middleware
from app.core.error_handler import register_error_handlers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ask-your-docai backend")
    yield
    logger.info("Shutting down ask-your-docai backend")


app = FastAPI(
    title="Ask Your DocAI",
    description="Piattaforma italiana di verifica medica delle ipotesi diagnostiche emerse da ChatGPT",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_url,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts)
app.middleware("http")(audit_middleware)
register_error_handlers(app)

app.include_router(auth.router, prefix="/v1/auth", tags=["auth"])
app.include_router(cases.router, prefix="/v1/cases", tags=["cases"])
app.include_router(opinions.router, prefix="/v1/clinical", tags=["opinions"])
app.include_router(messages.router, prefix="/v1/cases", tags=["messages"])
app.include_router(upload.router, prefix="/v1/cases", tags=["upload"])
app.include_router(payments.router, prefix="/v1/payments", tags=["payments"])


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": settings.now_iso()}