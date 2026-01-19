/*
  # Add Phone Authentication Support

  ## Overview
  This migration adds support for phone number authentication alongside existing email authentication.
  Users can authenticate with either email OR phone number using SMS OTP codes.

  ## 1. Profile Table Updates
    - Add `phone_number` column (text, unique, nullable)
    - Add `phone_verified_at` column (timestamptz, nullable)
    - Add `auth_method` column to track how user registered (email or phone)
    - Add index on phone_number for fast lookups

  ## 2. New Tables
    
    ### otp_verifications
    Stores hashed OTP codes for phone number verification
    - `id` (uuid, primary key)
    - `phone_number` (text, not null)
    - `otp_hash` (text, not null) - bcrypt hashed OTP
    - `expires_at` (timestamptz, not null) - 5 minute expiration
    - `attempts` (integer, default 0) - failed verification attempts
    - `created_at` (timestamptz, default now())
    - Index on phone_number and expires_at

    ### sms_rate_limits
    Tracks SMS sending rate limits per phone and IP
    - `id` (uuid, primary key)
    - `phone_number` (text, nullable)
    - `ip_address` (text, nullable)
    - `attempts` (integer, default 1)
    - `window_start` (timestamptz, not null)
    - `created_at` (timestamptz, default now())
    - Index on phone_number and ip_address

  ## 3. Security (RLS)
    - Enable RLS on all new tables
    - OTP verifications are only accessible via server-side functions
    - Rate limits are only accessible via server-side functions
    - Profile updates restricted to row owners

  ## 4. Cleanup Function
    - Auto-delete expired OTP records older than 1 hour
*/

-- Add phone authentication fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_number text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_verified_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'auth_method'
  ) THEN
    ALTER TABLE profiles ADD COLUMN auth_method text DEFAULT 'email';
  END IF;
END $$;

-- Create index on phone_number for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_phone_number ON profiles(phone_number);

-- Create otp_verifications table
CREATE TABLE IF NOT EXISTS otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for otp_verifications
CREATE INDEX IF NOT EXISTS idx_otp_verifications_phone ON otp_verifications(phone_number);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires ON otp_verifications(expires_at);

-- Enable RLS on otp_verifications
ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

-- Create sms_rate_limits table
CREATE TABLE IF NOT EXISTS sms_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text,
  ip_address text,
  attempts integer DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for sms_rate_limits
CREATE INDEX IF NOT EXISTS idx_rate_limits_phone ON sms_rate_limits(phone_number);
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip ON sms_rate_limits(ip_address);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON sms_rate_limits(window_start);

-- Enable RLS on sms_rate_limits
ALTER TABLE sms_rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for otp_verifications (server-side only, no direct client access)
CREATE POLICY "Service role only access to OTP verifications"
  ON otp_verifications
  FOR ALL
  USING (false);

-- RLS Policies for sms_rate_limits (server-side only)
CREATE POLICY "Service role only access to rate limits"
  ON sms_rate_limits
  FOR ALL
  USING (false);

-- Function to cleanup expired OTP records
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM otp_verifications
  WHERE expires_at < (now() - interval '1 hour');
  
  DELETE FROM sms_rate_limits
  WHERE window_start < (now() - interval '2 hours');
END;
$$;
