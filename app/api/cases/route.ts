import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requireAuth, handleAuthError } from '@/lib/auth/helpers'

// GET /api/cases - List all cases for the authenticated user
export async function GET(request: Request) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

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
    const supabase = await createClient()
    const body = await request.json()

    const { title, client_identifier, description, project_type, user_role } = body

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const trimmedProjectType = typeof project_type === 'string' ? project_type.trim() : ''
    const trimmedUserRole = typeof user_role === 'string' ? user_role.trim() : ''

    const { data: newCase, error } = await supabase
      .from('cases')
      .insert({
        user_id: user.id,
        title: title.trim(),
        client_identifier: client_identifier?.trim() || '',
        description: description?.trim() || '',
        status: 'active',
        project_type: trimmedProjectType || null,
        user_role: trimmedUserRole || null,
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
