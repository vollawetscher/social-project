import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (siteUrl) return siteUrl.replace(/\/$/, '')

  return new URL(request.url).origin
}

const ALLOWED_TYPES: readonly EmailOtpType[] = [
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]

/**
 * Server-side magic-link / OTP verification.
 *
 * Verifies a `token_hash` (from `admin.generateLink()`) against Supabase and
 * sets the auth cookies on the response before redirecting to `next`.
 *
 * Server-side is required here: doing the verification client-side caused the
 * session cookie to be missed on the first navigation, leaving the user stuck
 * on "Signing you in…".
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = url.searchParams.get('type') as EmailOtpType | null
  const nextParam = url.searchParams.get('next') || '/sessions'
  const origin = getPublicOrigin(request)

  const safeNext = nextParam.startsWith('/') ? nextParam : '/sessions'

  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent('Invalid verification link')}`
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

  if (error) {
    console.error('[Verify] OTP verification failed:', error)
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${origin}${safeNext}`)
}
