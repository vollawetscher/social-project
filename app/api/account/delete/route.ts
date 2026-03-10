import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function DELETE(request: Request) {
  try {
    const user = await requireAuth()
    const body = await request.json().catch(() => ({}))
    const confirmText = String(body?.confirmText || '').trim().toUpperCase()

    if (confirmText !== 'DELETE') {
      return NextResponse.json(
        { error: 'Confirmation text must be DELETE' },
        { status: 400 }
      )
    }

    const serviceClient = createServiceRoleClient()
    const { error } = await serviceClient.auth.admin.deleteUser(user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

