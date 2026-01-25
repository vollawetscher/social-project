import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = createClient()

    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    console.log('Found sessions:', sessions?.length || 0)
    return NextResponse.json(sessions || [])
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = createClient()
    const body = await request.json()
    const { context_note = '', internal_case_id = '', case_id = null } = body

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        case_id,
        context_note,
        internal_case_id,
        status: 'created',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
