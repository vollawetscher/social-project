/*
  # Add Missing Session RLS Policies

  1. Security Changes
    - Add UPDATE policy for sessions table allowing users to update their own sessions
    - Add DELETE policy for sessions table allowing users to delete their own sessions
  
  2. Important Notes
    - These policies ensure users can only modify/delete their own sessions
    - Both policies check that the session's user_id matches the authenticated user's ID
    - This completes the CRUD policy set for the sessions table (SELECT and INSERT already exist)
*/

-- Add UPDATE policy for sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sessions' 
    AND policyname = 'Users can update own sessions'
  ) THEN
    CREATE POLICY "Users can update own sessions"
      ON sessions
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Add DELETE policy for sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'sessions' 
    AND policyname = 'Users can delete own sessions'
  ) THEN
    CREATE POLICY "Users can delete own sessions"
      ON sessions
      FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;