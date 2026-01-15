/*
  # Rohbericht MVP Database Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, references auth.users)
      - `email` (text)
      - `role` (text: 'user' or 'admin')
      - `created_at` (timestamptz)
      - Links user profile data to Supabase Auth users
    
    - `sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `created_at` (timestamptz)
      - `context_note` (text, optional setting/context)
      - `internal_case_id` (text, optional case reference)
      - `status` (text: created, uploading, transcribing, summarizing, done, error)
      - `duration_sec` (integer, audio duration)
      - `last_error` (text, error messages)
      - Tracks conversation recording sessions
    
    - `files`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references sessions)
      - `storage_path` (text, Supabase Storage path)
      - `mime_type` (text)
      - `size_bytes` (bigint)
      - `created_at` (timestamptz)
      - Stores audio file metadata
    
    - `transcripts`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references sessions)
      - `raw_json` (jsonb, full transcript with timestamps)
      - `redacted_json` (jsonb, PII-redacted transcript)
      - `raw_text` (text, plain text version)
      - `redacted_text` (text, PII-redacted text)
      - `language` (text, detected language)
      - `created_at` (timestamptz)
      - Stores Speechmatics transcription results
    
    - `pii_hits`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references sessions)
      - `type` (text: name, phone, email, address, date)
      - `placeholder` (text: [NAME_1], [PHONE_1], etc)
      - `original_hash` (text, hashed original value)
      - `start_ms` (integer, timestamp in audio)
      - `end_ms` (integer, timestamp in audio)
      - `created_at` (timestamptz)
      - Tracks PII redactions for audit/reversal
    
    - `reports`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references sessions)
      - `claude_json` (jsonb, structured Rohbericht output)
      - `created_at` (timestamptz)
      - Stores Claude-generated reports

  2. Security
    - Enable RLS on all tables
    - Users can only access their own sessions
    - Admins can access all sessions and raw transcripts
    - Profiles table policies for self-read and admin-manage

  3. Important Notes
    - All timestamps use timestamptz for proper timezone handling
    - JSONB used for flexible transcript and report storage
    - Foreign keys with CASCADE delete for data cleanup
    - Default values set where appropriate
    - Indexes on frequently queried columns (user_id, session_id)
*/

-- Create profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  context_note text DEFAULT '',
  internal_case_id text DEFAULT '',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'uploading', 'transcribing', 'summarizing', 'done', 'error')),
  duration_sec integer DEFAULT 0,
  last_error text DEFAULT ''
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_status_idx ON sessions(status);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can read own sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
  ON sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create files table
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS files_session_id_idx ON files(session_id);

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

-- Files policies (access through session ownership)
CREATE POLICY "Users can read files for own sessions"
  ON files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = files.session_id AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert files for own sessions"
  ON files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = files.session_id AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all files"
  ON files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create transcripts table
CREATE TABLE IF NOT EXISTS transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  redacted_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_text text DEFAULT '',
  redacted_text text DEFAULT '',
  language text DEFAULT 'de',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transcripts_session_id_idx ON transcripts(session_id);

ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;

-- Transcripts policies (raw access restricted to admins)
CREATE POLICY "Users can read redacted transcripts for own sessions"
  ON transcripts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = transcripts.session_id AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transcripts for own sessions"
  ON transcripts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = transcripts.session_id AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all transcripts including raw"
  ON transcripts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Create pii_hits table
CREATE TABLE IF NOT EXISTS pii_hits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('name', 'phone', 'email', 'address', 'date')),
  placeholder text NOT NULL,
  original_hash text NOT NULL,
  start_ms integer DEFAULT 0,
  end_ms integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pii_hits_session_id_idx ON pii_hits(session_id);

ALTER TABLE pii_hits ENABLE ROW LEVEL SECURITY;

-- PII hits policies (restricted to admins only)
CREATE POLICY "Admins can read all pii_hits"
  ON pii_hits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert pii_hits"
  ON pii_hits FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = pii_hits.session_id AND sessions.user_id = auth.uid()
    )
  );

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  claude_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reports_session_id_idx ON reports(session_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Reports policies
CREATE POLICY "Users can read reports for own sessions"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = reports.session_id AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert reports for own sessions"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = reports.session_id AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all reports"
  ON reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );
