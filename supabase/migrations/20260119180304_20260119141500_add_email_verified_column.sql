/*
  # Add email_verified_at Column to Profiles
  
  ## Problem
  The handle_new_user trigger references email_verified_at column that doesn't exist,
  causing user creation to fail with a database error.
  
  ## Solution
  Add the email_verified_at column to the profiles table.
  
  ## Changes
  - Add email_verified_at timestamp column (nullable)
*/

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_verified_at timestamptz DEFAULT NULL;
