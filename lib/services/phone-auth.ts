/**
 * Phone Authentication Service
 *
 * Handles OTP generation, storage, validation, and rate limiting
 */

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'crypto';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration is missing');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

interface RateLimitResult {
  allowed: boolean;
  remainingAttempts?: number;
  resetTime?: Date;
}

interface OTPVerificationResult {
  success: boolean;
  error?: string;
  userId?: string;
  phoneNumber?: string;
}

/**
 * Check rate limit for phone number (max 3 requests per hour)
 */
export async function checkPhoneRateLimit(phoneNumber: string): Promise<RateLimitResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('sms_rate_limits')
    .select('*')
    .eq('phone_number', phoneNumber)
    .gte('window_start', oneHourAgo.toISOString());

  if (error) {
    console.error('Rate limit check error:', error);
    return { allowed: false };
  }

  const totalAttempts = data?.reduce((sum, record) => sum + record.attempts, 0) || 0;
  const maxAttempts = 3;

  if (totalAttempts >= maxAttempts) {
    const oldestRecord = data[0];
    const resetTime = new Date(new Date(oldestRecord.window_start).getTime() + 60 * 60 * 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime,
    };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - totalAttempts,
  };
}

/**
 * Check rate limit for IP address (max 10 requests per hour)
 */
export async function checkIPRateLimit(ipAddress: string): Promise<RateLimitResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from('sms_rate_limits')
    .select('*')
    .eq('ip_address', ipAddress)
    .gte('window_start', oneHourAgo.toISOString());

  if (error) {
    console.error('IP rate limit check error:', error);
    return { allowed: false };
  }

  const totalAttempts = data?.reduce((sum, record) => sum + record.attempts, 0) || 0;
  const maxAttempts = 10;

  if (totalAttempts >= maxAttempts) {
    const oldestRecord = data[0];
    const resetTime = new Date(new Date(oldestRecord.window_start).getTime() + 60 * 60 * 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      resetTime,
    };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - totalAttempts,
  };
}

/**
 * Record rate limit attempt
 */
export async function recordRateLimitAttempt(phoneNumber: string, ipAddress: string): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  await supabaseAdmin.from('sms_rate_limits').insert({
    phone_number: phoneNumber,
    ip_address: ipAddress,
    attempts: 1,
    window_start: new Date().toISOString(),
  });
}

/**
 * Hash OTP using SHA-256
 */
function hashOTP(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

/**
 * Store OTP in database (hashed)
 */
export async function storeOTP(phoneNumber: string, otp: string): Promise<boolean> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Delete any existing OTP for this phone number
    await supabaseAdmin
      .from('otp_verifications')
      .delete()
      .eq('phone_number', phoneNumber);

    // Hash the OTP
    const otpHash = hashOTP(otp);

    // Store new OTP with 5 minute expiration
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const { error } = await supabaseAdmin.from('otp_verifications').insert({
      phone_number: phoneNumber,
      otp_hash: otpHash,
      expires_at: expiresAt.toISOString(),
      attempts: 0,
    });

    if (error) {
      console.error('Error storing OTP:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error hashing/storing OTP:', error);
    return false;
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(phoneNumber: string, otp: string): Promise<OTPVerificationResult> {
  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Get the stored OTP
    const { data, error } = await supabaseAdmin
      .from('otp_verifications')
      .select('*')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    if (error || !data) {
      return {
        success: false,
        error: 'No verification code found. Please request a new code.',
      };
    }

    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      await supabaseAdmin
        .from('otp_verifications')
        .delete()
        .eq('phone_number', phoneNumber);

      return {
        success: false,
        error: 'Verification code has expired. Please request a new code.',
      };
    }

    // Check attempts limit
    if (data.attempts >= 5) {
      await supabaseAdmin
        .from('otp_verifications')
        .delete()
        .eq('phone_number', phoneNumber);

      return {
        success: false,
        error: 'Too many failed attempts. Please request a new code.',
      };
    }

    // Verify OTP
    const otpHash = hashOTP(otp);
    const isValid = otpHash === data.otp_hash;

    if (!isValid) {
      // Increment attempts
      await supabaseAdmin
        .from('otp_verifications')
        .update({ attempts: data.attempts + 1 })
        .eq('phone_number', phoneNumber);

      const remainingAttempts = 5 - (data.attempts + 1);
      return {
        success: false,
        error: `Invalid verification code. ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
      };
    }

    // OTP is valid - delete it
    await supabaseAdmin
      .from('otp_verifications')
      .delete()
      .eq('phone_number', phoneNumber);

    // Find or create user profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone_number', phoneNumber)
      .maybeSingle();

    let userId: string;

    if (profile) {
      // Existing user
      userId = profile.id;

      // Update phone_verified_at
      await supabaseAdmin
        .from('profiles')
        .update({ phone_verified_at: new Date().toISOString() })
        .eq('id', userId);
    } else {
      // New user - create profile
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          phone_number: phoneNumber,
          phone_verified_at: new Date().toISOString(),
          auth_method: 'phone',
          display_name: phoneNumber,
        })
        .select('id')
        .single();

      if (createError || !newProfile) {
        console.error('Error creating profile:', createError);
        return {
          success: false,
          error: 'Failed to create user profile.',
        };
      }

      userId = newProfile.id;
    }

    return {
      success: true,
      userId,
      phoneNumber,
    };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      error: 'An error occurred during verification.',
    };
  }
}

/**
 * Cleanup expired OTPs (should be called periodically)
 */
export async function cleanupExpiredOTPs(): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  await supabaseAdmin
    .from('otp_verifications')
    .delete()
    .lt('expires_at', oneHourAgo.toISOString());

  await supabaseAdmin
    .from('sms_rate_limits')
    .delete()
    .lt('window_start', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());
}
