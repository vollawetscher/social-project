/**
 * POST /api/auth/phone/resend-otp
 *
 * Resend an OTP code to the provided phone number
 * Same as request-otp but with additional cooldown check
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidPhoneNumber } from '@/lib/services/sms';
import { sendOTPSMS, generateOTP } from '@/lib/services/sms';
import {
  checkPhoneRateLimit,
  checkIPRateLimit,
  recordRateLimitAttempt,
  storeOTP,
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
        { error: 'Invalid phone number format' },
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
          error: `Please wait before requesting another code. Try again at ${resetTime}.`,
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
          error: `Too many requests. Please try again at ${resetTime}.`,
          resetTime: ipRateLimit.resetTime,
        },
        { status: 429 }
      );
    }

    // Generate new OTP
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
      message: 'New verification code sent successfully',
      expiresIn: 300, // 5 minutes in seconds
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { error: 'An error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
