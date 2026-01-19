/*
  # Fix All Recursive Admin Policies - CRITICAL FIX

  ## Problem
  Multiple tables have admin policies that recursively query the profiles table during
  profile creation, causing infinite recursion and preventing new users from signing up.

  ## Changes
  1. Drop ALL recursive admin policies across all tables:
     - sessions: "Admins can read all sessions"
     - files: "Admins can read all files"
     - transcripts: "Admins can read all transcripts including raw"
     - pii_hits: "Admins can read all pii_hits"
     - reports: "Admins can read all reports"
     - profiles: "Admins can read all profiles" (already fixed, but ensuring)

  2. Optimize handle_new_user() trigger function:
     - Use NEW.phone and NEW.email directly (no need to query auth.users)
     - Simpler, faster, no extra database round-trip

  ## Future Admin Access
  If admin access is needed in the future, use JWT claims instead:
  `auth.jwt()->>'role' = 'admin'`

  This checks the token directly without querying tables, avoiding recursion.

  ## Security Notes
  - RLS remains enabled on all tables
  - Regular user policies remain unchanged and secure
  - Users can only access their own data
  - Admin policies removed temporarily to fix recursion bug
*/

-- Drop all recursive admin policies
DROP POLICY IF EXISTS "Admins can read all sessions" ON sessions;
DROP POLICY IF EXISTS "Admins can read all files" ON files;
DROP POLICY IF EXISTS "Admins can read all transcripts including raw" ON transcripts;
DROP POLICY IF EXISTS "Admins can read all pii_hits" ON pii_hits;
DROP POLICY IF EXISTS "Admins can read all reports" ON reports;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Also drop the storage admin policy if it exists
DO $$
BEGIN
  -- Drop storage policy (may not exist, so use exception handling)
  EXECUTE 'DROP POLICY IF EXISTS "Admins can access all audio files" ON storage.objects';
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Optimize the handle_new_user trigger function
-- Use NEW.phone and NEW.email directly instead of querying auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_phone_auth boolean;
BEGIN
  -- Detect if this is phone-based auth (synthetic email)
  is_phone_auth := NEW.email LIKE '%@phone.local';

  -- Insert profile with appropriate auth_method
  -- Use NEW.phone and NEW.email directly - no need to query!
  INSERT INTO public.profiles (id, phone_number, email, auth_method, phone_verified_at, email_verified_at)
  VALUES (
    NEW.id,
    NEW.phone,
    CASE WHEN is_phone_auth THEN NULL ELSE NEW.email END,
    CASE
      WHEN is_phone_auth THEN 'phone'
      WHEN NEW.email IS NOT NULL THEN 'email'
      ELSE 'email'
    END,
    CASE WHEN NEW.phone IS NOT NULL THEN NOW() ELSE NULL END,
    CASE WHEN NEW.email IS NOT NULL AND NOT is_phone_auth THEN NOW() ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    phone_number = COALESCE(EXCLUDED.phone_number, profiles.phone_number),
    email = CASE
      WHEN EXCLUDED.email LIKE '%@phone.local' THEN profiles.email
      ELSE COALESCE(EXCLUDED.email, profiles.email)
    END,
    phone_verified_at = COALESCE(EXCLUDED.phone_verified_at, profiles.phone_verified_at),
    email_verified_at = CASE
      WHEN EXCLUDED.email LIKE '%@phone.local' THEN profiles.email_verified_at
      ELSE COALESCE(EXCLUDED.email_verified_at, profiles.email_verified_at)
    END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
