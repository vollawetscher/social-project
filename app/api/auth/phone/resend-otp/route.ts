/**
 * POST /api/auth/phone/resend-otp
 *
 * Phone/OTP authentication is no longer available. Use email sign-in instead.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Phone/OTP authentication is no longer available. Please use email to sign in.' },
    { status: 410 }
  );
}
