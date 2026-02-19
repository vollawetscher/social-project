import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/helpers'
import { createClient, createServiceRoleClient } from '@/lib/supabase/server'

/**
 * GET /api/admin/sessions - List all sessions across all users (admin only).
 * Supports ?search=, ?status=, ?limit=, ?offset=
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    const serviceClient = createServiceRoleClient()

    let query = serviceClient
      .from('sessions')
      .select('id, user_id, status, context_note, internal_case_id, duration_sec, language, last_error, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    if (search) {
      query = query.or(
        `context_note.ilike.%${search}%,internal_case_id.ilike.%${search}%,id.ilike.%${search}%`
      )
    }

    const { data: sessions, error, count } = await query

    if (error) {
      console.error('[Admin Sessions] Query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch profiles for all session owners
    const userIds = [...new Set((sessions || []).map((s: any) => s.user_id))]
    let profileMap: Record<string, { display_name: string | null; email: string | null }> = {}
    if (userIds.length > 0) {
      const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, display_name, email')
        .in('id', userIds)
      if (profiles) {
        for (const p of profiles) {
          profileMap[p.id] = { display_name: p.display_name, email: p.email }
        }
      }
    }

    const enriched = (sessions || []).map((s: any) => ({
      ...s,
      profiles: profileMap[s.user_id] || null,
    }))

    return NextResponse.json({ sessions: enriched, count: count || 0 })
  } catch (error: any) {
    console.error('[Admin Sessions] Error:', error)
    return NextResponse.json({ error: error.message || 'Failed to list sessions' }, { status: 500 })
  }
}
