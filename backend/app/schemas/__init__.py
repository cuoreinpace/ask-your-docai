from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class UserRole(str, Enum):
    PATIENT = "PATIENT"
    PHYSICIAN = "PHYSICIAN"
    CLINICAL_SUPERVISOR = "CLINICAL_SUPERVISOR"
    SUPPORT = "SUPPORT"
    PRIVACY = "PRIVACY"
    ADMIN = "ADMIN"


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


class AuthResponse(UserResponse):
    token: str


class CaseSourceInput(BaseModel):
    declared_provider: str = "ChatGPT"
    source_type: str = "USER_PASTED_TEXT"
    provenance_verified: bool = False
    pasted_text: Optional[str] = None


class CaseCreate(BaseModel):
    service_code: str = "AI_CONVERSATION_MEDICAL_REVIEW"
    patient_summary: str = Field(..., min_length=1, max_length=10000)
    source: Optional[CaseSourceInput] = None
    service_scope_acknowledged: bool = False


class CaseResponse(BaseModel):
    id: str
    patient_id: str
    service_code: str
    status: str
    patient_summary: str
    assigned_physician_id: Optional[str] = None
    version: int
    created_at: str
    submitted_at: Optional[str] = None
    accepted_at: Optional[str] = None
    signed_at: Optional[str] = None
    delivered_at: Optional[str] = None
    has_opinion: bool = False


class CaseConversation(CaseResponse):
    patient_email: Optional[str] = None


class CaseSourceResponse(BaseModel):
    id: str
    case_id: str
    category: str
    declared_provider: Optional[str] = None
    source_type: Optional[str] = None
    media_type: Optional[str] = None
    pasted_text: Optional[str] = None
    sha256: Optional[str] = None
    malware_scan_status: str = "PENDING"
    uploaded_at: str


class OpinionCreate(BaseModel):
    assessment_of_ai_output: AssessmentOfAiOutput
    clinical_assessment: str = Field(..., min_length=1)
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
    finalized_at: Optional[str] = None
    signed_at: Optional[str] = None


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
    case_id: str
    amount_cents: int = Field(default=3900, gt=0)
    currency: str = "EUR"


class PaymentResponse(BaseModel):
    id: str
    case_id: str
    amount_cents: int
    currency: str
    status: str
    created_at: str


class UploadSessionResponse(BaseModel):
    upload_id: str
    upload_url: str
    expires_at: str
    max_size_bytes: int
    status: str


class QuestionInput(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)


class RequestInformation(BaseModel):
    questions: list[QuestionInput]
    reason: str = "CLINICAL_INFORMATION_INSUFFICIENT"


class EscalationInput(BaseModel):
    reason: str = Field(default="CLINICAL_ESCALATION_TRIGGERED", max_length=200)
