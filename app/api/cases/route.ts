import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

// GET /api/cases - List all cases for the authenticated user
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = createClient()

    const { data: cases, error } = await supabase
      .from('cases')
      .select(`
        *,
        sessions:sessions(count)
      `)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform the data to include session count
    const casesWithCount = cases?.map((c: any) => ({
      ...c,
      session_count: c.sessions?.[0]?.count || 0,
      sessions: undefined // Remove the sessions object, we just wanted the count
    }))

    return NextResponse.json(casesWithCount || [])
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/cases - Create a new case
export async function POST(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = createClient()
    const body = await request.json()

    const { title, client_identifier, description } = body

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const { data: newCase, error } = await supabase
      .from('cases')
      .insert({
        user_id: user.id,
        title: title.trim(),
        client_identifier: client_identifier?.trim() || '',
        description: description?.trim() || '',
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(newCase, { status: 201 })
  } catch (error) {
    if (error instanceof Error) {
      const authError = handleAuthError(error)
      return NextResponse.json({ error: authError.message }, { status: authError.status })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
