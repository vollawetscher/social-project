import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))

    const appState = body?.appState === 'background' ? 'background' : 'foreground'
    const lastRoute = typeof body?.route === 'string' ? body.route.slice(0, 200) : null

    const { error } = await supabase
      .from('call_presence')
      .upsert(
        {
          user_id: user.id,
          app_state: appState,
          last_route: lastRoute,
          last_heartbeat_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      return NextResponse.json({ error: 'Failed to update presence' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
