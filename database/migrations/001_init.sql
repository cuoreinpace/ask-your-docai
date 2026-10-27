-- Ask Your DocAI — schema iniziale
-- PostgreSQL 16. Nessun contenuto clinico nei log di audit.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(30) NOT NULL CHECK (role IN ('PATIENT','PHYSICIAN','CLINICAL_SUPERVISOR','SUPPORT','PRIVACY','ADMIN')),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  identity_level VARCHAR(20) NOT NULL DEFAULT 'BASIC' CHECK (identity_level IN ('BASIC','VERIFIED','STRONG')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patient_profiles (
  user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  birth_date DATE NOT NULL,
  country VARCHAR(3) NOT NULL DEFAULT 'ITA',
  locale VARCHAR(10) NOT NULL DEFAULT 'it-IT'
);

CREATE TABLE IF NOT EXISTS physician_profiles (
  user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  professional_registration VARCHAR(100) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  insurance_expiry DATE NOT NULL,
  signature_provider_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS medical_cases (
  id VARCHAR(50) PRIMARY KEY,
  patient_id VARCHAR(50) NOT NULL REFERENCES users(id),
  service_code VARCHAR(100) NOT NULL DEFAULT 'AI_CONVERSATION_MEDICAL_REVIEW',
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT','READY_FOR_PAYMENT','PAYMENT_AUTHORIZED','SUBMITTED','HUMAN_INTAKE',
    'OUT_OF_SCOPE','CLINICAL_ESCALATION','ACCEPTED','ASSIGNED','IN_REVIEW',
    'NEEDS_INFORMATION','OPINION_DRAFT','SIGNING','SIGNED','DELIVERED','CLOSED','ADDENDUM'
  )),
  patient_summary TEXT,
  assigned_physician_id VARCHAR(50) REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS case_sources (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL DEFAULT 'AI_CONVERSATION',
  declared_provider VARCHAR(100),
  source_type VARCHAR(30) CHECK (source_type IN ('USER_UPLOAD','USER_PASTED_TEXT')),
  pasted_text TEXT,
  media_type VARCHAR(100),
  sha256 VARCHAR(64),
  provenance_verified BOOLEAN NOT NULL DEFAULT FALSE,
  malware_scan_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (malware_scan_status IN ('PENDING','CLEAN','REJECTED')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  object_storage_key VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS case_assignments (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  physician_id VARCHAR(50) NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS clinical_messages (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  sender_id VARCHAR(50) NOT NULL REFERENCES users(id),
  sender_role VARCHAR(30) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_opinions (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  physician_id VARCHAR(50) NOT NULL REFERENCES users(id),
  assessment_of_ai_output VARCHAR(30) NOT NULL CHECK (assessment_of_ai_output IN (
    'AGREE','PARTIALLY_AGREE','DISAGREE','INSUFFICIENT_INFORMATION','CANNOT_ASSESS'
  )),
  clinical_assessment TEXT NOT NULL,
  limitations TEXT[] NOT NULL DEFAULT '{}',
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  requires_in_person_assessment BOOLEAN NOT NULL DEFAULT FALSE,
  physician_assigned_urgency VARCHAR(20) NOT NULL DEFAULT 'ROUTINE' CHECK (physician_assigned_urgency IN (
    'EMERGENCY','URGENT','ROUTINE','UNDETERMINED'
  )),
  clinical_decision_source VARCHAR(30) NOT NULL DEFAULT 'HUMAN_PHYSICIAN'
    CHECK (clinical_decision_source = 'HUMAN_PHYSICIAN'),
  status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT','FINALIZED','SIGNED','SUPERSEDED_BY_ADDENDUM'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS opinion_versions (
  id VARCHAR(50) PRIMARY KEY,
  opinion_id VARCHAR(50) NOT NULL REFERENCES medical_opinions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  assessment VARCHAR(30) NOT NULL,
  clinical_assessment TEXT NOT NULL,
  limitations TEXT[] NOT NULL DEFAULT '{}',
  recommendations TEXT[] NOT NULL DEFAULT '{}',
  requires_in_person_assessment BOOLEAN NOT NULL DEFAULT FALSE,
  physician_assigned_urgency VARCHAR(20) NOT NULL DEFAULT 'ROUTINE',
  content_hash VARCHAR(64) NOT NULL,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signature_artifacts (
  id VARCHAR(50) PRIMARY KEY,
  opinion_version_id VARCHAR(50) NOT NULL REFERENCES opinion_versions(id) ON DELETE CASCADE,
  document_hash VARCHAR(64) NOT NULL,
  signature_type VARCHAR(30) NOT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qtsp_transaction_id VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS payments (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  provider_reference VARCHAR(200),
  amount_cents INTEGER NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_records (
  id VARCHAR(50) PRIMARY KEY,
  case_id VARCHAR(50) NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  user_id VARCHAR(50) NOT NULL REFERENCES users(id),
  consent_type VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(50) PRIMARY KEY,
  actor_id VARCHAR(50) REFERENCES users(id),
  actor_role VARCHAR(30) NOT NULL DEFAULT 'ANONYMOUS',
  action VARCHAR(200) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(50),
  case_id VARCHAR(50) REFERENCES medical_cases(id),
  authorization_basis VARCHAR(100),
  request_id VARCHAR(50),
  ip_hash VARCHAR(64),
  success BOOLEAN NOT NULL DEFAULT TRUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_case_id ON audit_events(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor_id ON audit_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_occurred_at ON audit_events(occurred_at);
CREATE INDEX IF NOT EXISTS idx_medical_cases_patient_id ON medical_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_medical_cases_status ON medical_cases(status);
CREATE INDEX IF NOT EXISTS idx_medical_cases_assigned_physician ON medical_cases(assigned_physician_id);
CREATE INDEX IF NOT EXISTS idx_case_sources_case_id ON case_sources(case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_case_id ON case_assignments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_assignments_physician_id ON case_assignments(physician_id);
CREATE INDEX IF NOT EXISTS idx_clinical_messages_case_id ON clinical_messages(case_id);
CREATE INDEX IF NOT EXISTS idx_medical_opinions_case_id ON medical_opinions(case_id);
CREATE INDEX IF NOT EXISTS idx_medical_opinions_physician_id ON medical_opinions(physician_id);
CREATE INDEX IF NOT EXISTS idx_payments_case_id ON payments(case_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_case_id ON consent_records(case_id);
