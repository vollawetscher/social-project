/**
 * Internal API: Trigger analyze + auto-generate after transcription completes.
 * Called by the transcribe background job when user has after_transcript_template_id set.
 * Requires x-internal-secret header.
 */
import { createServiceRoleClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('x-internal-secret')
    if (secret !== process.env.INTERNAL_API_SECRET || !process.env.INTERNAL_API_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { sessionId } = body
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const supabase = createServiceRoleClient()

    // Get session and user
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      console.error('[Post-Transcribe] Session not found:', sessionId)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const userId = session.user_id
    if (!userId) {
      return NextResponse.json({ error: 'Session has no user' }, { status: 400 })
    }

    // Check if user wants auto-generation
    const { data: profile } = await supabase
      .from('profiles')
      .select('after_transcript_template_id, after_transcript_action')
      .eq('id', userId)
      .single()

    const templateId = (profile as any)?.after_transcript_template_id
    const legacyAction = profile?.after_transcript_action && profile.after_transcript_action !== 'nothing'
    if (!templateId && !legacyAction) {
      console.log('[Post-Transcribe] No auto-generation configured for user')
      return NextResponse.json({ ok: true, skipped: 'no_template' })
    }

    // Trigger analyze (which will update session and trigger auto-generate)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000'
    const analyzeUrl = `${baseUrl}/api/sessions/${sessionId}/analyze`

    const analyzeRes = await fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET!,
        'x-internal-user-id': userId,
      },
    })

    if (!analyzeRes.ok) {
      const err = await analyzeRes.text()
      console.error('[Post-Transcribe] Analyze failed:', analyzeRes.status, err)
      return NextResponse.json(
        { error: 'Analyze failed', details: err },
        { status: 500 }
      )
    }

    console.log('[Post-Transcribe] Analyze triggered successfully for session:', sessionId)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('[Post-Transcribe] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal error' },
      { status: 500 }
    )
  }
}
