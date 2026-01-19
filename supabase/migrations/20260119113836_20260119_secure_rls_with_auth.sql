/*
  # Secure RLS with Supabase Auth (Option A)

  1. Security Changes
    - Drop all public access policies that allow unauthenticated access
    - Restore authentication requirements for all tables

  2. Schema Changes
    - Make sessions.user_id NOT NULL (restore constraint)
    - Update profile creation to work with phone authentication
    - Clean up anonymous sessions from MVP phase

  3. Tables Affected
    - profiles: Remove public access policies
    - sessions: Remove public access policies, restore NOT NULL constraint
    - files: Remove public access policies
    - transcripts: Remove public access policies
    - reports: Remove public access policies
    - pii_hits: Remove public access policies

  4. Important Notes
    - All users (email and phone) will now use Supabase Auth
    - Existing RLS policies based on auth.uid() will work correctly
    - Anonymous access is completely removed for security
    - Anonymous sessions from MVP phase will be deleted
*/

-- Drop all public access policies
DROP POLICY IF EXISTS "Allow public access to profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public access to sessions" ON sessions;
DROP POLICY IF EXISTS "Allow public access to files" ON files;
DROP POLICY IF EXISTS "Allow public access to transcripts" ON transcripts;
DROP POLICY IF EXISTS "Allow public access to reports" ON reports;
DROP POLICY IF EXISTS "Allow public access to pii_hits" ON pii_hits;

-- Delete anonymous sessions from MVP phase (cascade will handle related records)
DELETE FROM sessions WHERE user_id IS NULL;

-- Now make the column NOT NULL
ALTER TABLE sessions ALTER COLUMN user_id SET NOT NULL;

-- Update the profile trigger to handle phone authentication
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_phone text;
  user_email text;
BEGIN
  -- Get phone and email from auth.users
  SELECT
    phone,
    email
  INTO user_phone, user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Insert profile with appropriate auth_method
  INSERT INTO public.profiles (id, phone_number, email, auth_method, phone_verified_at, email_verified_at)
  VALUES (
    NEW.id,
    user_phone,
    user_email,
    CASE
      WHEN user_phone IS NOT NULL THEN 'phone'
      WHEN user_email IS NOT NULL THEN 'email'
      ELSE 'email'
    END,
    CASE WHEN user_phone IS NOT NULL THEN NOW() ELSE NULL END,
    CASE WHEN user_email IS NOT NULL THEN NOW() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    email = COALESCE(EXCLUDED.email, profiles.email),
    phone_verified_at = COALESCE(EXCLUDED.phone_verified_at, profiles.phone_verified_at),
    email_verified_at = COALESCE(EXCLUDED.email_verified_at, profiles.email_verified_at);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();