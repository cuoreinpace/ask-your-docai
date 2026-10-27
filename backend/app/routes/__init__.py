from fastapi import APIRouter
from app.routes.auth import router as auth_router
from app.routes.cases import router as cases_router
from app.routes.opinions import router as opinions_router
from app.routes.messages import router as messages_router
from app.routes.upload import router as upload_router
from app.routes.payments import router as payments_router

router = APIRouter()
router.include_router(auth_router, prefix="/v1/auth", tags=["auth"])
router.include_router(cases_router, prefix="/v1/cases", tags=["cases"])
router.include_router(opinions_router, prefix="/v1/clinical", tags=["opinions"])
router.include_router(messages_router, prefix="/v1/cases", tags=["messages"])
router.include_router(upload_router, prefix="/v1/cases", tags=["upload"])
router.include_router(payments_router, prefix="/v1/payments", tags=["payments"])