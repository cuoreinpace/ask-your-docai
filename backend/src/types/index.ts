export type UserRole = 'PATIENT' | 'PHYSICIAN' | 'CLINICAL_SUPERVISOR' | 'SUPPORT' | 'PRIVACY' | 'ADMIN';

export type IdentityLevel = 'BASIC' | 'VERIFIED' | 'STRONG';

export type CaseStatus =
  | 'DRAFT'
  | 'READY_FOR_PAYMENT'
  | 'PAYMENT_AUTHORIZED'
  | 'SUBMITTED'
  | 'HUMAN_INTAKE'
  | 'OUT_OF_SCOPE'
  | 'CLINICAL_ESCALATION'
  | 'ACCEPTED'
  | 'ASSIGNED'
  | 'IN_REVIEW'
  | 'NEEDS_INFORMATION'
  | 'OPINION_DRAFT'
  | 'SIGNING'
  | 'SIGNED'
  | 'DELIVERED'
  | 'CLOSED'
  | 'ADDENDUM';

export type AssessmentOfAiOutput =
  | 'AGREE'
  | 'PARTIALLY_AGREE'
  | 'DISAGREE'
  | 'INSUFFICIENT_INFORMATION'
  | 'CANNOT_ASSESS';

export type PhysicianAssignedUrgency = 'EMERGENCY' | 'URGENT' | 'ROUTINE' | 'UNDETERMINED';

export type OpinionStatus = 'DRAFT' | 'FINALIZED' | 'SIGNED' | 'SUPERSEDED_BY_ADDENDUM';

export type SourceType = 'USER_UPLOAD' | 'USER_PASTED_TEXT';

export type MalwareScanStatus = 'PENDING' | 'CLEAN' | 'REJECTED';

export interface User {
  id: string;
  role: UserRole;
  email: string;
  emailVerified: boolean;
  identityLevel: IdentityLevel;
  createdAt: string;
}

export interface PatientProfile {
  userId: string;
  birthDate: string;
  country: string;
  locale: string;
}

export interface PhysicianProfile {
  userId: string;
  professionalRegistration: string;
  specialty: string;
  verificationStatus: string;
  insuranceExpiry: string;
  signatureProviderId: string | null;
}

export interface MedicalCase {
  id: string;
  patientId: string;
  serviceCode: string;
  status: CaseStatus;
  patientSummary: string;
  assignedPhysicianId: string | null;
  version: number;
  createdAt: string;
  submittedAt: string | null;
  acceptedAt: string | null;
  signedAt: string | null;
  deliveredAt: string | null;
}

export interface CaseSource {
  id: string;
  caseId: string;
  category: string;
  mediaType: string;
  sha256: string;
  provenanceVerified: boolean;
  malwareScanStatus: MalwareScanStatus;
  uploadedAt: string;
  objectStorageKey: string | null;
}

export interface ClinicalMessage {
  id: string;
  caseId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  createdAt: string;
}

export interface CaseAssignment {
  id: string;
  caseId: string;
  physicianId: string;
  assignedAt: string;
  endedAt: string | null;
}

export interface MedicalOpinion {
  id: string;
  caseId: string;
  physicianId: string;
  assessmentOfAiOutput: AssessmentOfAiOutput;
  clinicalAssessment: string;
  limitations: string[];
  recommendations: string[];
  requiresInPersonAssessment: boolean;
  physicianAssignedUrgency: PhysicianAssignedUrgency;
  clinicalDecisionSource: 'HUMAN_PHYSICIAN';
  status: OpinionStatus;
  createdAt: string;
  finalizedAt: string | null;
  signedAt: string | null;
}

export interface OpinionVersion {
  id: string;
  opinionId: string;
  version: number;
  assessment: AssessmentOfAiOutput;
  clinicalAssessment: string;
  limitations: string[];
  recommendations: string[];
  requiresInPersonAssessment: boolean;
  physicianAssignedUrgency: PhysicianAssignedUrgency;
  finalizedAt: string | null;
  createdAt: string;
}

export interface SignatureArtifact {
  id: string;
  opinionVersionId: string;
  documentHash: string;
  signatureType: string;
  signedAt: string;
  qtspTransactionId: string | null;
}

export interface Payment {
  id: string;
  caseId: string;
  providerReference: string;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
}

export interface ConsentRecord {
  id: string;
  caseId: string;
  userId: string;
  consentType: string;
  version: string;
  acceptedAt: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  actorRole: UserRole;
  action: string;
  resourceType: string;
  resourceId: string;
  caseId: string | null;
  authorizationBasis: string;
  requestId: string;
  ipHash: string;
  success: boolean;
  occurredAt: string;
}

export interface UploadSession {
  id: string;
  caseId: string;
  filename: string;
  mediaType: string;
  sizeBytes: number;
  sourceCategory: string;
  uploadUrl: string;
  expiresAt: string;
  status: 'AWAITING_UPLOAD' | 'UPLOADING' | 'UPLOADED' | 'QUARANTINE' | 'CLEAN' | 'REJECTED';
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}