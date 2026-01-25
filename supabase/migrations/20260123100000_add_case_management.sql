/*
  # Add Case Management Feature (Projects)
  
  1. New Table
    - `cases` table for tracking clients/patients across multiple sessions
    - Note: "cases" is database name, but displayed as "Projekte" in German UI
    
  2. Changes
    - Add `case_id` to sessions table (nullable for backward compatibility)
    - Add foreign key relationship
    - Add RLS policies for cases
  
  3. Security
    - Users can only see their own cases
    - Admins can see all cases
*/

-- Create cases table
CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  client_identifier text DEFAULT '', -- Optional: encrypted/hashed client ID
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on cases
CREATE INDEX IF NOT EXISTS cases_user_id_idx ON cases(user_id);
CREATE INDEX IF NOT EXISTS cases_status_idx ON cases(status);

-- Enable RLS on cases
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

-- Cases policies
CREATE POLICY "Users can read own cases"
  ON cases FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cases"
  ON cases FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cases"
  ON cases FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own cases"
  ON cases FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all cases"
  ON cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add case_id to sessions table
ALTER TABLE sessions
ADD COLUMN case_id uuid REFERENCES cases(id) ON DELETE SET NULL;

-- Create index on sessions.case_id
CREATE INDEX IF NOT EXISTS sessions_case_id_idx ON sessions(case_id);

-- Add updated_at trigger for cases
CREATE OR REPLACE FUNCTION update_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cases_updated_at_trigger
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION update_cases_updated_at();

-- Add comment
COMMENT ON TABLE cases IS 'Tracks clients/patients across multiple sessions for project/case continuity. Displayed as "Projekte" in German UI.';
COMMENT ON COLUMN sessions.case_id IS 'Links session to a project/case. Nullable for backward compatibility with standalone sessions.';
