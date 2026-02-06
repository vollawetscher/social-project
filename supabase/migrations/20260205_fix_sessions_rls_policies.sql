-- Fix sessions RLS policies
-- Issue: Public policy might be conflicting with authenticated policies
-- Solution: Drop conflicting public policy and ensure authenticated policies are active

-- Drop the public access policy that might be causing conflicts
DROP POLICY IF EXISTS "Allow public access to sessions" ON sessions;

-- Ensure all necessary policies exist for authenticated users
-- These may already exist, but IF NOT EXISTS protects against duplicates

DO $$
BEGIN
  -- INSERT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sessions' 
    AND policyname = 'Users can insert own sessions'
  ) THEN
    CREATE POLICY "Users can insert own sessions"
      ON sessions FOR INSERT
      TO authenticated
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- UPDATE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sessions' 
    AND policyname = 'Users can update own sessions'
  ) THEN
    CREATE POLICY "Users can update own sessions"
      ON sessions FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  -- DELETE policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sessions' 
    AND policyname = 'Users can delete own sessions'
  ) THEN
    CREATE POLICY "Users can delete own sessions"
      ON sessions FOR DELETE
      TO authenticated
      USING (user_id = auth.uid());
  END IF;

  -- SELECT policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sessions' 
    AND policyname = 'Users can read own sessions'
  ) THEN
    CREATE POLICY "Users can read own sessions"
      ON sessions FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
