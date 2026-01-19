/*
  # Fix Phone Authentication Profile Schema

  ## Overview
  This migration fixes the profiles table schema to support phone-only authentication
  by removing dependencies on Supabase Auth and adding missing fields.

  ## 1. Schema Changes to profiles table
    - Drop foreign key constraint on `id` (no longer requires auth.users reference)
    - Add default UUID generation for `id` column
    - Make `email` column nullable (phone users don't have email)
    - Add `display_name` column (referenced by phone auth code)

  ## 2. Rationale
    Phone authentication creates profiles without going through Supabase Auth,
    so profiles must be able to exist independently with phone_number only.

  ## 3. Security Notes
    - RLS policies remain in place (already configured for public access in migration 20260115165013)
    - All existing email-based users remain unaffected
    - Phone users and email users can coexist in the same table
*/

-- Drop the foreign key constraint from profiles.id to auth.users
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_id_fkey' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_id_fkey;
  END IF;
END $$;

-- Add default UUID generation for profiles.id if not already set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' 
    AND column_name = 'id' 
    AND column_default IS NOT NULL
  ) THEN
    ALTER TABLE profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Make email nullable (phone users don't have email)
DO $$
BEGIN
  ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

-- Add display_name column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN display_name text;
  END IF;
END $$;

-- Add constraint to ensure either email or phone_number is present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_email_or_phone_required' AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_email_or_phone_required 
      CHECK (email IS NOT NULL OR phone_number IS NOT NULL);
  END IF;
END $$;
