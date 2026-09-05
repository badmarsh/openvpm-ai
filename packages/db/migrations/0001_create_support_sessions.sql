-- Migration to create ext_support_sessions table
-- Run this manually in your database if db:push is blocked

CREATE TABLE IF NOT EXISTS ext_support_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id VARCHAR(255) NOT NULL,
  client_id VARCHAR(255),
  created_by VARCHAR(255) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  session_code TEXT NOT NULL UNIQUE,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ext_support_session_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ext_support_sessions(id),
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  action VARCHAR(30) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_support_sessions_code ON ext_support_sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_support_sessions_practice ON ext_support_sessions(practice_id);
CREATE INDEX IF NOT EXISTS idx_support_session_audit_session ON ext_support_session_audit(session_id);
