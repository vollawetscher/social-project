/*
  # Add Profile INSERT Policy

  1. Changes
    - Adds INSERT policy allowing users to create their own profile
    - This is a safety fallback in case the trigger doesn't fire

  2. Security
    - Users can only insert a profile with their own auth.uid()
    - Prevents users from creating profiles for other users
*/

-- Allow users to insert their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'profiles' 
    AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
