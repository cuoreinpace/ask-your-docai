CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('PATIENT', 'PHYSICIAN', 'CLINICAL_SUPERVISOR', 'SUPPORT', 'PRIVACY', 'ADMIN')),
  email_verified BOOLEAN NOT NULL DEFAULT false,
  identity_level VARCHAR(20) NOT NULL DEFAULT 'BASIC' CHECK (identity_level IN ('BASIC', 'VERIFIED', 'STRONG')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE patient_profiles (
  user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_date DATE NOT NULL,
  country VARCHAR(3) NOT NULL DEFAULT 'ITA',
  locale VARCHAR(10) NOT NULL DEFAULT 'it-IT'
);

CREATE TABLE physician_profiles (
  user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  professional_registration VARCHAR(100) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  insurance_expiry DATE NOT NULL,
  signature_provider_id VARCHAR(100)
);

CREATE TABLE medical_cases (
  id VARCHAR(50) PRIMARY KEY,
  patient_id VARCHAR(50) NOT NULL REFERENCES users(id),
  service_code VARCHAR(100) NOT NULL DEFAULT 'AI_CONVERSATION_MEDICAL_REVIEW',
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY_FOR_PAYMENT', 'PAYMENT_AUTHORIZED', 'SUBMITTED', 'HUMAN_INTAKE', 'OUT_OF_SCOPE', 'CLINICAL_ESCALATION', 'ACCEPTED', 'ASSIGNED', 'IN_REVIEW', 'NEEDS_INFORMATION', 'OPINION_DRAFT', 'SIGNING', 'SIGNED', 'DELIVERED', 'CLOSED', 'ADDENDUM')),
  patient_summary TEXT,
  assigned_physician_id VARCHAR(50) REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE case_sources (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL,
  media_type VARCHAR(100),
  sha256 VARCHAR(64) NOT NULL,
  provenance_verified BOOLEAN NOT NULL DEFAULT false,
  malware_scan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (malware_scan_status IN ('PENDING', 'CLEAN', 'REJECTED')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  object_storage_key VARCHAR(500)
);

CREATE TABLE case_assignments (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  physician_id VARCHAR(50) NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE clinical_messages (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  sender_id VARCHAR(50) NOT NULL REFERENCES users(id),
  sender_role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE medical_opinions (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  physician_id VARCHAR(50) NOT NULL REFERENCES users(id),
  assessment_of_ai_output VARCHAR(30) NOT NULL CHECK (assessment_of_ai_output IN ('AGREE', 'PARTIALLY_AGREE', 'DISAGREE', 'INSUFFICIENT_INFORMATION', 'CANNOT_ASSESS')),
  clinical_assessment TEXT NOT NULL,
  limitations TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  requires_in_person_assessment BOOLEAN NOT NULL DEFAULT false,
  physician_assigned_urgency VARCHAR(20) NOT NULL DEFAULT 'ROUTINE' CHECK (physician_assigned_urgency IN ('EMERGENCY', 'URGENT', 'ROUTINE', 'UNDETERMINED')),
  clinical_decision_source VARCHAR(30) NOT NULL DEFAULT 'HUMAN_PHYSICIAN',
  status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'FINALIZED', 'SIGNED', 'SUPERSEDED_BY_ADDENDUM')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ
);

CREATE TABLE opinion_versions (
  id VARCHAR(50) PRIMARY KEY,
  opinion_id VARCHAR(50) NOT NULL REFERENCES medical_opinions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  assessment VARCHAR(30) NOT NULL,
  clinical_assessment TEXT NOT NULL,
  limitations TEXT[] DEFAULT '{}',
  recommendations TEXT[] DEFAULT '{}',
  requires_in_person_assessment BOOLEAN NOT NULL DEFAULT false,
  physician_assigned_urgency VARCHAR(20) NOT NULL DEFAULT 'ROUTINE',
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE signature_artifacts (
  id VARCHAR(50) PRIMARY KEY,
  opinion_version_id VARCHAR(50) NOT NULL REFERENCES opinion_versions(id) ON DELETE CASCADE,
  document_hash VARCHAR(64) NOT NULL,
  signature_type VARCHAR(30) NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qtsp_transaction_id VARCHAR(100)
);

CREATE TABLE payments (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  provider_reference VARCHAR(200),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE consent_records (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id),
  consent_type VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_events (
  id VARCHAR(50) PRIMARY KEY,
  actor_id VARCHAR(50) NOT NULL REFERENCES users(id),
  actor_role VARCHAR(20) NOT NULL,
  action VARCHAR(200) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(50),
  case_id VARCHAR(50) REFERENCES medical_cases(id),
  authorization_basis VARCHAR(100),
  request_id VARCHAR(50),
  ip_hash VARCHAR(64),
  success BOOLEAN NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_events_case_id ON audit_events(case_id);
CREATE INDEX idx_audit_events_actor_id ON audit_events(actor_id);
CREATE INDEX idx_audit_events_occurred_at ON audit_events(occurred_at);
CREATE INDEX idx_medical_cases_patient_id ON medical_cases(patient_id);
CREATE INDEX idx_medical_cases_status ON medical_cases(status);
CREATE INDEX idx_medical_cases_assigned_physician ON medical_cases(assigned_physician_id);
CREATE INDEX idx_case_sources_case_id ON case_sources(case_id);
CREATE INDEX idx_case_assignments_case_id ON case_assignments(case_id);
CREATE INDEX idx_case_assignments_physician_id ON case_assignments(physician_id);
CREATE INDEX idx_clinical_messages_case_id ON clinical_messages(case_id);
CREATE INDEX idx_medical_opinions_case_id ON medical_opinions(case_id);
CREATE INDEX idx_medical_opinions_physician_id ON medical_opinions(physician_id);
CREATE INDEX idx_payments_case_id ON payments(case_id);
CREATE INDEX idx_consent_records_case_id ON consent_records(case_id);

CREATE OR REPLACE FUNCTION increment_case_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = COALESCE((SELECT version FROM medical_cases WHERE id = NEW.id), 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;