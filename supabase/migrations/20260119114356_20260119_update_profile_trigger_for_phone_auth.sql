/*
  # Update Profile Trigger for Phone Authentication

  1. Changes
    - Update handle_new_user function to detect synthetic emails
    - Set email to NULL for phone-based auth users
    - Extract phone number from synthetic email if needed
    - Properly set auth_method based on authentication type

  2. Notes
    - Synthetic emails follow format: {phone_without_plus}@phone.local
    - Phone users should have phone_number populated, email should be NULL
    - Email users should have email populated, phone_number can be NULL
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_phone text;
  user_email text;
  is_phone_auth boolean;
BEGIN
  -- Get phone and email from auth.users
  SELECT
    phone,
    email
  INTO user_phone, user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Detect if this is phone-based auth (synthetic email)
  is_phone_auth := user_email LIKE '%@phone.local';

  -- Insert profile with appropriate auth_method
  INSERT INTO public.profiles (id, phone_number, email, auth_method, phone_verified_at, email_verified_at)
  VALUES (
    NEW.id,
    user_phone,
    CASE WHEN is_phone_auth THEN NULL ELSE user_email END,
    CASE
      WHEN is_phone_auth THEN 'phone'
      WHEN user_email IS NOT NULL THEN 'email'
      ELSE 'email'
    END,
    CASE WHEN user_phone IS NOT NULL THEN NOW() ELSE NULL END,
    CASE WHEN user_email IS NOT NULL AND NOT is_phone_auth THEN NOW() ELSE NULL END
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