-- Add preferred_locale column to profiles table for i18n support
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_locale TEXT DEFAULT 'en';

-- Validate values
ALTER TABLE profiles
  ADD CONSTRAINT profiles_preferred_locale_check
  CHECK (preferred_locale IN ('en', 'de', 'es'));
