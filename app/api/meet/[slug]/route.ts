import { NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { getCalleeReachability } from '@/lib/services/call-reachability'

/**
 * GET /api/meet/[slug] - Resolve a meeting slug to public profile info.
 * Public endpoint — no auth required (guests need to see who they're meeting).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    if (!slug || slug.length < 2) {
      return NextResponse.json({ error: 'Invalid meeting link' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, display_name, meeting_slug')
      .eq('meeting_slug', slug.toLowerCase())
      .maybeSingle()

    if (error) {
      console.error('[Meet] Error resolving slug:', error)
      return NextResponse.json({ error: 'Failed to resolve meeting link' }, { status: 500 })
    }

    if (!profile) {
      return NextResponse.json({ error: 'Meeting room not found' }, { status: 404 })
    }

    const reachability = await getCalleeReachability(supabase, profile.id)

    return NextResponse.json({
      ownerId: profile.id,
      displayName: profile.display_name || 'Host',
      slug: profile.meeting_slug,
      reachability: reachability.state,
    })
  } catch (error: any) {
    console.error('[Meet] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
