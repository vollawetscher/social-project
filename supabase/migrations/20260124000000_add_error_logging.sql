/*
  # Add Error Logging and Bug Reporting System
  
  1. New Table
    - `error_logs` table for comprehensive error tracking
    
  2. Features
    - Captures server-side errors with full context
    - Links to case_id, session_id, file_id for correlation
    - Stores stack traces, request info, and user details
    - Supports client-side bug reports
    - Timestamp and severity tracking
    - AI-ready structure for pattern analysis
  
  3. Security
    - Admins can see all errors
    - Users can only see their own errors
*/

-- Create error_logs table
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Context identifiers (hierarchical for AI analysis)
  case_id uuid REFERENCES cases(id) ON DELETE SET NULL,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  file_id uuid REFERENCES files(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  
  -- Error details
  error_type text NOT NULL, -- 'server_error', 'client_error', 'bug_report', 'api_error'
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  message text NOT NULL,
  stack_trace text,
  error_code text, -- HTTP status code or custom error code
  
  -- Request context
  endpoint text, -- API route or page path
  method text, -- HTTP method (GET, POST, etc.)
  user_agent text,
  ip_address text,
  
  -- Application state
  app_version text,
  environment text DEFAULT 'production', -- 'development', 'staging', 'production'
  
  -- Additional context (flexible JSON for any extra data)
  metadata jsonb DEFAULT '{}',
  
  -- User-provided bug report info
  user_description text, -- For bug reports submitted by users
  reproduction_steps text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  
  -- Resolution tracking
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolution_notes text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS error_logs_case_id_idx ON error_logs(case_id);
CREATE INDEX IF NOT EXISTS error_logs_session_id_idx ON error_logs(session_id);
CREATE INDEX IF NOT EXISTS error_logs_file_id_idx ON error_logs(file_id);
CREATE INDEX IF NOT EXISTS error_logs_user_id_idx ON error_logs(user_id);
CREATE INDEX IF NOT EXISTS error_logs_error_type_idx ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS error_logs_severity_idx ON error_logs(severity);
CREATE INDEX IF NOT EXISTS error_logs_created_at_idx ON error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS error_logs_resolved_idx ON error_logs(resolved) WHERE NOT resolved;

-- Enable RLS on error_logs
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Error logs policies
CREATE POLICY "Users can read own errors"
  ON error_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own errors"
  ON error_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can read all errors"
  ON error_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all errors"
  ON error_logs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Service role can write all errors (for server-side logging)
CREATE POLICY "Service role can write all errors"
  ON error_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE error_logs IS 'Comprehensive error logging system for debugging, support, and AI analysis';
COMMENT ON COLUMN error_logs.case_id IS 'Link to project (case) for high-level pattern analysis';
COMMENT ON COLUMN error_logs.metadata IS 'Flexible JSON field for additional context like browser info, feature flags, etc.';
