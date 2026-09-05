-- Support Sessions tables for remote support functionality
-- Run this in your PostgreSQL database to create the missing tables

-- Create ext_support_sessions table if it doesn't exist
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

-- Create ext_support_session_audit table if it doesn't exist
CREATE TABLE IF NOT EXISTS ext_support_session_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ext_support_sessions(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL,
  action VARCHAR(30) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance if they don't exist
DO $$
BEGIN
  -- Index on session_code for fast lookups
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_support_sessions_code') THEN
    CREATE INDEX idx_support_sessions_code ON ext_support_sessions(session_code);
  END IF;
  
  -- Index on practice_id for filtering by practice
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_support_sessions_practice') THEN
    CREATE INDEX idx_support_sessions_practice ON ext_support_sessions(practice_id);
  END IF;
  
  -- Index on session_id in audit table
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_support_session_audit_session') THEN
    CREATE INDEX idx_support_session_audit_session ON ext_support_session_audit(session_id);
  END IF;
END
$$;

-- Verify tables were created
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('ext_support_sessions', 'ext_support_session_audit')
ORDER BY table_name, ordinal_position;
