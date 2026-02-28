import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

function normalizePhone(raw: string): string | null {
  let cleaned = raw.replace(/[\s\-().]/g, '')
  if (cleaned.startsWith('00')) cleaned = `+${cleaned.slice(2)}`
  if (/^\d{7,15}$/.test(cleaned)) cleaned = `+${cleaned}`
  return /^\+[1-9]\d{6,14}$/.test(cleaned) ? cleaned : null
}

/**
 * POST /api/calls/resolve-user
 * Body: { phoneNumber: string }
 * Resolves a profile user by normalized E.164 phone number.
 */
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json().catch(() => ({}))
    const phoneNumber = typeof body?.phoneNumber === 'string' ? body.phoneNumber : ''
    const normalized = normalizePhone(phoneNumber)

    if (!normalized) {
      return NextResponse.json({ matched: false, error: 'Invalid phone number' }, { status: 400 })
    }

    const db = createServiceRoleClient()
    const { data: profile, error } = await db
      .from('profiles')
      .select('id, display_name, email, phone_number')
      .eq('phone_number', normalized)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'Failed to resolve user' }, { status: 500 })
    }

    if (!profile || profile.id === user.id) {
      return NextResponse.json({ matched: false, normalized })
    }

    return NextResponse.json({
      matched: true,
      normalized,
      user: {
        id: profile.id,
        displayName: profile.display_name || profile.email || profile.phone_number || 'User',
      },
    })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
