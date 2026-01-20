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
  session?: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
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

    // Create synthetic email for phone-based auth
    const syntheticEmail = `${phoneNumber.replace(/\+/g, '')}@phone.local`;

    // Check if user exists in auth.users by synthetic email
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(u => u.email === syntheticEmail);

    let userId: string;
    let accessToken: string;
    let refreshToken: string;
    let expiresIn: number;

    if (existingUser) {
      // Existing user - update metadata and create session
      userId = existingUser.id;

      // Update phone number in user metadata
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        phone: phoneNumber,
        user_metadata: {
          auth_method: 'phone',
          phone_number: phoneNumber,
        },
      });

      console.log('[PhoneAuth] Creating session for existing user:', userId);
    } else {
      // New user - create auth user with synthetic email
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: syntheticEmail,
        email_confirm: true,
        phone: phoneNumber,
        phone_confirm: true,
        user_metadata: {
          auth_method: 'phone',
          phone_number: phoneNumber,
        },
      });

      if (createError || !newUser.user) {
        console.error('Error creating user:', createError);
        return {
          success: false,
          error: 'Failed to create user account.',
        };
      }

      userId = newUser.user.id;
      console.log('[PhoneAuth] Created new user:', userId);
    }

    // Generate session tokens using magic link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: syntheticEmail,
    });

    if (linkError || !linkData) {
      console.error('[PhoneAuth] Error generating link:', linkError);
      return {
        success: false,
        error: 'Failed to generate session.',
      };
    }

    // Extract token from the generated link
    const actionLink = linkData.properties.action_link;
    const url = new URL(actionLink);
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type') || 'magiclink';

    if (!tokenHash) {
      console.error('[PhoneAuth] No token hash in link');
      return {
        success: false,
        error: 'Failed to generate session.',
      };
    }

    console.log('[PhoneAuth] Verifying token for session creation');

    // Verify the OTP token to create a valid session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'magiclink',
    });

    if (sessionError || !sessionData?.session) {
      console.error('[PhoneAuth] Session creation failed:', sessionError);
      return {
        success: false,
        error: 'Failed to create session. Please try again.',
      };
    }

    accessToken = sessionData.session.access_token;
    refreshToken = sessionData.session.refresh_token;
    expiresIn = sessionData.session.expires_in || 3600;

    console.log('[PhoneAuth] Session created successfully for user:', userId);

    return {
      success: true,
      userId,
      phoneNumber,
      session: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
      },
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
