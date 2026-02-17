import { createClient, createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Admin endpoint: Generate password reset link (no email sent)
 * POST /api/admin/reset-password-link
 *
 * Body: { email: string }
 *
 * Returns the reset URL. Admin can share it via any channel (chat, phone).
 * User clicks → lands on reset-password/confirm → sets own password.
 * This flow allows user to change password later in settings (unlike admin.updateUserById).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const { email } = await request.json()
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const supabaseAdmin = createServiceRoleClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://notissima.up.railway.app'

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: email.trim(),
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=/reset-password/confirm`,
      },
    })

    if (error) {
      console.error('[Admin reset-link]', error)
      return NextResponse.json(
        { error: error.message || 'Failed to generate link' },
        { status: 500 }
      )
    }

    const actionLink = data.properties?.action_link
    if (!actionLink) {
      return NextResponse.json(
        { error: 'No link returned from Supabase' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      link: actionLink,
      expiresIn: '1 hour',
      message: 'Share this link with the user. They can set their password without receiving an email.',
    })
  } catch (err: unknown) {
    console.error('[Admin reset-link]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
