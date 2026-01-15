/*
  # Remove authentication requirements from database

  1. Changes
    - Drop all restrictive RLS policies on sessions table
    - Drop all restrictive RLS policies on profiles table  
    - Add public access policies to sessions table
    - Keep RLS enabled but allow anonymous access for MVP

  2. Security
    - This is for MVP testing without authentication
    - In production, proper authentication should be re-enabled
*/

DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own sessions" ON sessions;
  DROP POLICY IF EXISTS "Users can create own sessions" ON sessions;
  DROP POLICY IF EXISTS "Users can update own sessions" ON sessions;
  DROP POLICY IF EXISTS "Users can delete own sessions" ON sessions;
  DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Allow public access to sessions"
  ON sessions
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public access to profiles"
  ON profiles
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);