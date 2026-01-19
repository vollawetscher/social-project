/**
 * POST /api/auth/phone/request-otp
 *
 * Request an OTP code to be sent via SMS to the provided phone number
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidPhoneNumber } from '@/lib/services/sms';
import { sendOTPSMS, generateOTP } from '@/lib/services/sms';
import {
  checkPhoneRateLimit,
  checkIPRateLimit,
  recordRateLimitAttempt,
  storeOTP,
  cleanupExpiredOTPs,
} from '@/lib/services/phone-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    if (!isValidPhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Please use international format (e.g., +49151234567)' },
        { status: 400 }
      );
    }

    // Get IP address for rate limiting
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // Check rate limits
    const phoneRateLimit = await checkPhoneRateLimit(phoneNumber);
    if (!phoneRateLimit.allowed) {
      const resetTime = phoneRateLimit.resetTime
        ? new Date(phoneRateLimit.resetTime).toLocaleTimeString()
        : 'later';
      return NextResponse.json(
        {
          error: `Too many requests for this phone number. Please try again at ${resetTime}.`,
          resetTime: phoneRateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    const ipRateLimit = await checkIPRateLimit(ipAddress);
    if (!ipRateLimit.allowed) {
      const resetTime = ipRateLimit.resetTime
        ? new Date(ipRateLimit.resetTime).toLocaleTimeString()
        : 'later';
      return NextResponse.json(
        {
          error: `Too many requests from your location. Please try again at ${resetTime}.`,
          resetTime: ipRateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    // Cleanup expired OTPs periodically
    await cleanupExpiredOTPs();

    // Generate OTP
    const otp = generateOTP();

    // Store OTP (hashed)
    const stored = await storeOTP(phoneNumber, otp);
    if (!stored) {
      return NextResponse.json(
        { error: 'Failed to generate verification code. Please try again.' },
        { status: 500 }
      );
    }

    // Send SMS
    const smsResult = await sendOTPSMS(phoneNumber, otp);

    if (!smsResult.success) {
      return NextResponse.json(
        {
          error: smsResult.error || 'Failed to send SMS. Please try again.',
        },
        { status: 500 }
      );
    }

    // Record rate limit attempt
    await recordRateLimitAttempt(phoneNumber, ipAddress);

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully',
      expiresIn: 300, // 5 minutes in seconds
    });
  } catch (error) {
    console.error('Request OTP error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
