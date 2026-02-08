import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'
import { toV0Sessions } from '@/lib/adapters/session-adapter'

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    // Check if v0 format is requested
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format')

    // Fetch sessions with output count (filtered by user)
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select(`
        *,
        outputs:outputs(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 })
    }

    // Transform to include output_count
    const sessionsWithCount = sessions?.map(session => {
      const outputCount = session.outputs?.[0]?.count || 0
      const { outputs, ...rest } = session
      return {
        ...rest,
        output_count: outputCount
      }
    })

    console.log('Found sessions:', sessionsWithCount?.length || 0)
    
    // Return v0 format if requested
    if (format === 'v0' && sessionsWithCount) {
      return NextResponse.json(toV0Sessions(sessionsWithCount))
    }
    
    return NextResponse.json(sessionsWithCount || [])
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
    const supabase = await createClient()
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
