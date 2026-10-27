from pydantic import BaseModel, Field, field_validator
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    PATIENT = "PATIENT"
    PHYSICIAN = "PHYSICIAN"
    CLINICAL_SUPERVISOR = "CLINICAL_SUPERVISOR"
    SUPPORT = "SUPPORT"
    PRIVACY = "PRIVACY"
    ADMIN = "ADMIN"


class IdentityLevel(str, Enum):
    BASIC = "BASIC"
    VERIFIED = "VERIFIED"
    STRONG = "STRONG"


class CaseStatus(str, Enum):
    DRAFT = "DRAFT"
    READY_FOR_PAYMENT = "READY_FOR_PAYMENT"
    PAYMENT_AUTHORIZED = "PAYMENT_AUTHORIZED"
    SUBMITTED = "SUBMITTED"
    HUMAN_INTAKE = "HUMAN_INTAKE"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"
    CLINICAL_ESCALATION = "CLINICAL_ESCALATION"
    ACCEPTED = "ACCEPTED"
    ASSIGNED = "ASSIGNED"
    IN_REVIEW = "IN_REVIEW"
    NEEDS_INFORMATION = "NEEDS_INFORMATION"
    OPINION_DRAFT = "OPINION_DRAFT"
    SIGNING = "SIGNING"
    SIGNED = "SIGNED"
    DELIVERED = "DELIVERED"
    CLOSED = "CLOSED"
    ADDENDUM = "ADDENDUM"


class AssessmentOfAiOutput(str, Enum):
    AGREE = "AGREE"
    PARTIALLY_AGREE = "PARTIALLY_AGREE"
    DISAGREE = "DISAGREE"
    INSUFFICIENT_INFORMATION = "INSUFFICIENT_INFORMATION"
    CANNOT_ASSESS = "CANNOT_ASSESS"


class PhysicianAssignedUrgency(str, Enum):
    EMERGENCY = "EMERGENCY"
    URGENT = "URGENT"
    ROUTINE = "ROUTINE"
    UNDETERMINED = "UNDETERMINED"


class OpinionStatus(str, Enum):
    DRAFT = "DRAFT"
    FINALIZED = "FINALIZED"
    SIGNED = "SIGNED"
    SUPERSEDED_BY_ADDENDUM = "SUPERSEDED_BY_ADDENDUM"


class SourceType(str, Enum):
    USER_UPLOAD = "USER_UPLOAD"
    USER_PASTED_TEXT = "USER_PASTED_TEXT"


class MalwareScanStatus(str, Enum):
    PENDING = "PENDING"
    CLEAN = "CLEAN"
    REJECTED = "REJECTED"


class UserCreate(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8)
    role: UserRole
    birth_date: Optional[str] = None
    country: Optional[str] = "ITA"


class UserLogin(BaseModel):
    email: str
    password: str


class UserResponse(BaseModel):
    id: str
    role: str
    email: str
    email_verified: bool
    identity_level: str
    created_at: str


class CaseCreate(BaseModel):
    service_code: str = "AI_CONVERSATION_MEDICAL_REVIEW"
    patient_summary: str = Field(..., max_length=10000)
    source: Optional[dict] = None
    service_scope_acknowledged: bool = False


class CaseResponse(BaseModel):
    id: str
    patient_id: str
    service_code: str
    status: str
    patient_summary: str
    assigned_physician_id: Optional[str]
    version: int
    created_at: str
    submitted_at: Optional[str]
    accepted_at: Optional[str]
    signed_at: Optional[str]
    delivered_at: Optional[str]


class OpinionCreate(BaseModel):
    assessment_of_ai_output: AssessmentOfAiOutput
    clinical_assessment: str
    limitations: list[str] = []
    recommendations: list[str] = []
    requires_in_person_assessment: bool = False
    physician_assigned_urgency: PhysicianAssignedUrgency = PhysicianAssignedUrgency.ROUTINE


class OpinionResponse(BaseModel):
    id: str
    case_id: str
    physician_id: str
    assessment_of_ai_output: str
    clinical_assessment: str
    limitations: list[str]
    recommendations: list[str]
    requires_in_person_assessment: bool
    physician_assigned_urgency: str
    clinical_decision_source: str
    status: str
    created_at: str
    finalized_at: Optional[str]
    signed_at: Optional[str]


class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)


class MessageResponse(BaseModel):
    id: str
    case_id: str
    sender_id: str
    sender_role: str
    content: str
    created_at: str


class PaymentAuthorize(BaseModel):
    amount_cents: int = Field(..., gt=0)
    currency: str = "EUR"


class PaymentResponse(BaseModel):
    id: str
    case_id: str
    provider_reference: str
    amount_cents: int
    currency: str
    status: str
    client_secret: str
    created_at: str


class UploadSessionResponse(BaseModel):
    upload_id: str
    upload_url: str
    expires_at: str
    max_size_bytes: int
    status: str


class AuditEventResponse(BaseModel):
    id: str
    actor_id: str
    actor_role: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    case_id: Optional[str]
    authorization_basis: str
    request_id: str
    ip_hash: Optional[str]
    success: bool
    occurred_at: str